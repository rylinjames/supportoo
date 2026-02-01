import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * CONVERSATIONS QUERIES
 * Handles fetching conversations with filters and real-time subscriptions
 */

// ============================================================================
// GET CONVERSATION BY ID
// ============================================================================

export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db.get(conversationId);
  },
});

// ============================================================================
// GET LATEST CONVERSATION FOR TEST CUSTOMER
// ============================================================================

export const getLatestTestConversation = query({
  args: {
    customerId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { customerId, companyId }) => {
    // Get the most recent conversation for this test customer
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_customer", (q) =>
        q.eq("companyId", companyId).eq("customerId", customerId)
      )
      .order("desc") // Most recent first
      .take(1);
    
    return conversations[0]?._id || null;
  },
});

// ============================================================================
// LIST CONVERSATIONS FOR AGENTS (Support/Admin)
// ============================================================================

/**
 * Get customer's THE ONE conversation
 *
 * Returns the latest active (non-resolved) conversation for this customer,
 * or null if none exist.
 */
export const getCustomerConversation = query({
  args: {
    customerId: v.id("users"),
    companyId: v.id("companies"), // Add companyId parameter
  },
  handler: async (ctx, { customerId, companyId }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) return null;

    // Get the latest active conversation (non-resolved) for this customer
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_customer", (q) =>
        q.eq("companyId", companyId).eq("customerId", customerId)
      )
      .order("desc")
      .collect();

    const conversation = conversations.find(
      (conv) => conv.status !== "resolved"
    );

    if (!conversation) return null;

    // Get last 50 messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversation._id)
      )
      .order("desc")
      .take(50);

    return {
      ...conversation,
      messages: messages.reverse(),
    };
  },
});

export const listConversationsForAgents = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(
      v.union(
        v.literal("ai_handling"),
        v.literal("available"),
        v.literal("support_staff_handling")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { companyId, status, limit = 50 }) => {
    let conversationsQuery;

    if (status) {
      // Filter by status
      conversationsQuery = ctx.db
        .query("conversations")
        .withIndex("by_company_status", (q) =>
          q.eq("companyId", companyId).eq("status", status)
        )
        .order("desc"); // Most recent first
    } else {
      // All conversations
      conversationsQuery = ctx.db
        .query("conversations")
        .withIndex("by_company_updated", (q) => q.eq("companyId", companyId))
        .order("desc");
    }

    const conversations = await conversationsQuery.take(limit);

    // OPTIMIZATION: Batch load all customers upfront to avoid N+1 queries
    const customerIds = [...new Set(conversations.map((c) => c.customerId))];
    const customersArray = await Promise.all(
      customerIds.map((id) => ctx.db.get(id))
    );
    const customerMap = new Map(
      customersArray.filter(Boolean).map((c) => [c!._id, c])
    );

    // OPTIMIZATION: Batch load all participating agents upfront
    const allAgentIds = [
      ...new Set(conversations.flatMap((c) => c.participatingAgents)),
    ];
    const agentsArray = await Promise.all(
      allAgentIds.map((id) => ctx.db.get(id))
    );
    const agentMap = new Map(
      agentsArray.filter(Boolean).map((a) => [a!._id, a])
    );

    // Enrich with customer info, latest message, and agent details
    const enriched = await Promise.all(
      conversations.map(async (conversation) => {
        // Use cached customer from map
        const customer = customerMap.get(conversation.customerId);

        // Get latest message for preview
        const latestMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .take(1);

        // Get last 50 messages for instant display
        const recentMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .take(50);

        // Collect all agent IDs from messages for batch loading
        const messageAgentIds = [
          ...new Set(
            recentMessages.filter((m) => m.agentId).map((m) => m.agentId!)
          ),
        ];
        // Batch load message agents not already in agentMap
        const newAgentIds = messageAgentIds.filter((id) => !agentMap.has(id));
        if (newAgentIds.length > 0) {
          const newAgents = await Promise.all(
            newAgentIds.map((id) => ctx.db.get(id))
          );
          newAgents.filter(Boolean).forEach((a) => agentMap.set(a!._id, a));
        }

        // Enrich messages with agent avatar URLs using cached agents
        const enrichedMessages = recentMessages.map((message) => {
          if (message.agentId) {
            const agent = agentMap.get(message.agentId);
            return {
              ...message,
              agentAvatar: agent?.avatarUrl,
            };
          }
          return message;
        });

        // Return in chronological order (oldest first) for chat display
        const messagesForDisplay = enrichedMessages.reverse();

        // Check if conversation has unread customer messages
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_role_unread_agent", (q) =>
            q
              .eq("conversationId", conversation._id)
              .eq("role", "customer")
              .eq("readByAgentAt", undefined)
          )
          .take(1);

        // Enrich participating agents with full details using cached agents
        const participatingAgentsEnriched = conversation.participatingAgents
          .map((agentId) => {
            const agent = agentMap.get(agentId);
            if (!agent) return null;

            const initials = agent.displayName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return {
              id: agent._id,
              name: agent.displayName,
              initials,
              avatar: agent.avatarUrl,
            };
          })
          .filter(Boolean);

        // Determine delivery status from latest message
        const now = Date.now();
        let deliveryStatus: "sent" | "delivered" | "seen" | undefined =
          undefined;

        if (latestMessage[0]) {
          const message = latestMessage[0];

          if (message.role === "ai" || message.role === "agent") {
            // Agent/AI message: Check if customer has read it
            if (message.readByCustomerAt) {
              deliveryStatus = "seen";
            } else if (message.timestamp < now - 5 * 60 * 1000) {
              // 5 minutes ago
              deliveryStatus = "delivered";
            } else {
              deliveryStatus = "sent";
            }
          } else if (message.role === "customer") {
            // Customer message: Check if agent has read it
            if (message.readByAgentAt) {
              deliveryStatus = "seen";
            } else {
              deliveryStatus = "sent";
            }
          }
        }

        return {
          ...conversation,
          customer: customer
            ? {
                _id: customer._id,
                displayName: customer.displayName,
                avatarUrl: customer.avatarUrl,
                whopUsername: customer.whopUsername, // For customerEmail
              }
            : null,
          latestMessage: latestMessage[0] || null,
          hasUnreadMessages: unreadMessages.length > 0,
          messages: messagesForDisplay, // Pre-fetched messages for instant display

          // Enhanced fields for frontend
          lastMessageFrom: latestMessage[0]?.role || null,
          deliveryStatus,
          participatingAgentsEnriched,
          handoffReason: conversation.handoffReason,
        };
      })
    );

    return enriched;
  },
});

// ============================================================================
// GET AVAILABLE CONVERSATIONS (for agent assignment)
// ============================================================================

export const getAvailableConversations = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_status", (q) =>
        q.eq("companyId", companyId).eq("status", "available")
      )
      .order("desc")
      .collect();

    // Enrich with customer info and latest message (same as main query)
    return await Promise.all(
      conversations.map(async (conversation) => {
        const customer = await ctx.db.get(conversation.customerId);

        // Get latest message for preview
        const latestMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .take(1);

        // Check if conversation has unread customer messages
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_role_unread_agent", (q) =>
            q
              .eq("conversationId", conversation._id)
              .eq("role", "customer")
              .eq("readByAgentAt", undefined)
          )
          .take(1);

        // Enrich participating agents with full details
        const participatingAgentsEnriched = await Promise.all(
          conversation.participatingAgents.map(async (agentId) => {
            const agent = await ctx.db.get(agentId);
            if (!agent) return null;

            const initials = agent.displayName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return {
              id: agent._id,
              name: agent.displayName,
              initials,
              avatar: agent.avatarUrl,
            };
          })
        );

        // Filter out null agents
        const validAgents = participatingAgentsEnriched.filter(Boolean);

        return {
          ...conversation,
          customer: customer
            ? {
                _id: customer._id,
                displayName: customer.displayName,
                avatarUrl: customer.avatarUrl,
                whopUsername: customer.whopUsername,
              }
            : null,
          latestMessage: latestMessage[0] || null,
          hasUnreadMessages: unreadMessages.length > 0,

          // Enhanced fields for frontend
          lastMessageFrom: latestMessage[0]?.role || null,
          participatingAgentsEnriched: validAgents,
          handoffReason: conversation.handoffReason,
        };
      })
    );
  },
});

// ============================================================================
// SEARCH CONVERSATIONS
// ============================================================================

export const searchConversations = query({
  args: {
    companyId: v.id("companies"),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { companyId, searchTerm, limit = 20 }) => {
    // Get all conversations for the company
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_updated", (q) => q.eq("companyId", companyId))
      .take(limit * 3); // Get more to account for filtering

    // Filter by customer name (simple text match for now)
    const filtered = await Promise.all(
      allConversations.map(async (conversation) => {
        const customer = await ctx.db.get(conversation.customerId);
        if (!customer) return null;

        const matchesSearch = customer.displayName
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

        if (!matchesSearch) return null;

        // Get latest message for preview
        const latestMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .take(1);

        // Check if conversation has unread customer messages
        const unreadMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_role_unread_agent", (q) =>
            q
              .eq("conversationId", conversation._id)
              .eq("role", "customer")
              .eq("readByAgentAt", undefined)
          )
          .take(1);

        return {
          ...conversation,
          customer: {
            _id: customer._id,
            displayName: customer.displayName,
            avatarUrl: customer.avatarUrl,
            whopUsername: customer.whopUsername,
          },
          latestMessage: latestMessage[0] || null,
          hasUnreadMessages: unreadMessages.length > 0,

          // Enhanced fields for frontend
          lastMessageFrom: latestMessage[0]?.role || null,
          handoffReason: conversation.handoffReason,
        };
      })
    );

    // Remove nulls and limit results
    return filtered.filter((c) => c !== null).slice(0, limit);
  },
});

// ============================================================================
// GET CONVERSATION COUNT BY STATUS
// ============================================================================

export const getConversationCountByStatus = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_updated", (q) => q.eq("companyId", companyId))
      .collect();

    const counts = {
      ai_handling: 0,
      available: 0,
      support_staff_handling: 0,
      resolved: 0,
      total: allConversations.length,
    };

    for (const conversation of allConversations) {
      counts[conversation.status]++;
    }

    return counts;
  },
});
