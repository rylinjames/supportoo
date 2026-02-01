import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * MESSAGES QUERIES
 * Handles fetching messages with pagination and real-time subscriptions
 */

// ============================================================================
// GET MESSAGES (Paginated with Infinite Scroll)
// ============================================================================

export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()), // Default 50
    before: v.optional(v.number()), // Timestamp to load messages before (for infinite scroll)
  },
  handler: async (ctx, { conversationId, limit = 50, before }) => {
    let messagesQuery = ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("desc"); // Most recent first

    // If loading older messages (infinite scroll), filter by timestamp
    if (before) {
      messagesQuery = messagesQuery.filter((q) =>
        q.lt(q.field("timestamp"), before)
      );
    }

    const messages = await messagesQuery.take(limit);

    // Enrich messages with agent avatar URLs
    const enrichedMessages = await Promise.all(
      messages.map(async (message) => {
        if (message.agentId) {
          const agent = await ctx.db.get(message.agentId);
          return {
            ...message,
            agentAvatar: agent?.avatarUrl,
          };
        }
        return message;
      })
    );

    // Return in chronological order (oldest first) for chat display
    return enrichedMessages.reverse();
  },
});

// ============================================================================
// GET LATEST MESSAGE (for conversation list preview)
// ============================================================================

export const getLatestMessage = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("desc")
      .take(1);

    return messages[0] || null;
  },
});

// ============================================================================
// GET MESSAGE BY ID
// ============================================================================

export const getMessageById = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    return await ctx.db.get(messageId);
  },
});

// ============================================================================
// GET UNREAD COUNT FOR AGENTS
// ============================================================================

export const getUnreadCountForAgents = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    // Count unread customer messages
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_role_unread_agent", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("role", "customer")
          .eq("readByAgentAt", undefined)
      )
      .collect();

    return unreadMessages.length;
  },
});

// ============================================================================
// GET UNREAD COUNT FOR CUSTOMER
// ============================================================================

export const getUnreadCountForCustomer = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    // Count unread agent messages
    const unreadAgentMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_role_unread_customer", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("role", "agent")
          .eq("readByCustomerAt", undefined)
      )
      .collect();

    // Count unread AI messages
    const unreadAiMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_role_unread_customer", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("role", "ai")
          .eq("readByCustomerAt", undefined)
      )
      .collect();

    return unreadAgentMessages.length + unreadAiMessages.length;
  },
});

// ============================================================================
// CHECK IF CONVERSATION HAS UNREAD MESSAGES
// ============================================================================

export const hasUnreadMessages = query({
  args: {
    conversationId: v.id("conversations"),
    forRole: v.union(v.literal("agent"), v.literal("customer")),
  },
  handler: async (ctx, { conversationId, forRole }) => {
    if (forRole === "agent") {
      // Check if any customer messages are unread
      const unreadMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_role_unread_agent", (q) =>
          q
            .eq("conversationId", conversationId)
            .eq("role", "customer")
            .eq("readByAgentAt", undefined)
        )
        .take(1); // Only need to know if at least one exists

      return unreadMessages.length > 0;
    } else {
      // Check if any agent/AI messages are unread
      const unreadAgentMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_role_unread_customer", (q) =>
          q
            .eq("conversationId", conversationId)
            .eq("role", "agent")
            .eq("readByCustomerAt", undefined)
        )
        .take(1);

      if (unreadAgentMessages.length > 0) {
        return true;
      }

      const unreadAiMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation_role_unread_customer", (q) =>
          q
            .eq("conversationId", conversationId)
            .eq("role", "ai")
            .eq("readByCustomerAt", undefined)
        )
        .take(1);

      return unreadAiMessages.length > 0;
    }
  },
});

// ============================================================================
// GET MESSAGE BY ID
// ============================================================================

export const getMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    return await ctx.db.get(messageId);
  },
});
