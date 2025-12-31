import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * CONVERSATIONS MUTATIONS
 * Handles conversation creation, status updates, and metadata management
 */

// ============================================================================
// CREATE CONVERSATION
// ============================================================================

export const createConversation = mutation({
  args: {
    companyId: v.id("companies"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { companyId, customerId }) => {
    const now = Date.now();

    // Check if customer already has an active conversation
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_company_customer", (q) =>
        q.eq("companyId", companyId).eq("customerId", customerId)
      )
      .first();

    // If conversation exists, return it
    if (existingConversation) {
      return existingConversation._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      companyId,
      customerId,
      status: "ai_handling",
      messageCount: 0,
      lastMessageAt: now,
      firstMessageAt: now,
      participatingAgents: [],
      aiProcessing: false,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

// ============================================================================
// CUSTOMER CONVERSATION MANAGEMENT
// ============================================================================

/**
 * Create THE ONLY conversation for customer
 *
 * Creates a single conversation that persists forever for this customer.
 * This conversation handles all future interactions and never gets deleted.
 * NOTE: In test mode, we always create a new conversation for isolation.
 */
export const createCustomerConversation = mutation({
  args: {
    customerId: v.id("users"),
    companyId: v.id("companies"),
    forceNew: v.optional(v.boolean()), // For test mode to create new conversations
  },
  handler: async (ctx, { customerId, companyId, forceNew = false }) => {
    // Check if this is a test customer
    const customer = await ctx.db.get(customerId);
    const isTestCustomer = customer?.whopUserId?.startsWith("test_customer_");
    
    // Only check for existing conversation if:
    // 1. It's NOT a test customer AND
    // 2. forceNew is false
    // Test customers with forceNew=true should always get new conversations
    if (!isTestCustomer && !forceNew) {
      // Safety: Check if already exists (only for real customers)
      const existing = await ctx.db
        .query("conversations")
        .withIndex("by_company_customer", (q) =>
          q.eq("companyId", companyId).eq("customerId", customerId)
        )
        .first();

      if (existing) return existing._id;
    }
    
    // For test customers when NOT forcing new, also check for existing
    if (isTestCustomer && !forceNew) {
      const existing = await ctx.db
        .query("conversations")
        .withIndex("by_company_customer", (q) =>
          q.eq("companyId", companyId).eq("customerId", customerId)
        )
        .first();

      if (existing) return existing._id;
    }

    const now = Date.now();

    return await ctx.db.insert("conversations", {
      companyId,
      customerId,
      status: "ai_handling",
      messageCount: 0,
      lastMessageAt: now,
      firstMessageAt: now,
      participatingAgents: [],
      aiProcessing: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Request human support
 *
 * Customer requests to speak with a human agent.
 * Changes conversation status from "ai_handling" to "available".
 */
export const requestHumanSupport = mutation({
  args: {
    conversationId: v.id("conversations"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { conversationId, customerId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.customerId !== customerId) throw new Error("Unauthorized");

    const now = Date.now();

    await ctx.db.patch(conversationId, {
      status: "available",
      handoffTriggeredAt: now,
      handoffReason: "Customer requested human support",
      updatedAt: now,
    });

    await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "system",
      content: "Conversation handed off to support staff.",
      timestamp: now,
      systemMessageType: "handoff",
    });

    return { success: true };
  },
});

// ============================================================================
// UPDATE CONVERSATION STATUS
// ============================================================================

export const updateStatus = mutation({
  args: {
    conversationId: v.id("conversations"),
    status: v.union(
      v.literal("ai_handling"),
      v.literal("available"),
      v.literal("support_staff_handling")
    ),
    handoffReason: v.optional(v.string()),
    agentId: v.optional(v.id("users")),
    agentName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { conversationId, status, handoffReason, agentId, agentName }
  ) => {
    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const updates: any = {
      status,
      updatedAt: now,
    };

    // If transitioning to available (handoff), record when and why
    if (status === "available") {
      updates.handoffTriggeredAt = now;
      if (handoffReason) {
        updates.handoffReason = handoffReason;
      }
    } else {
      // Clear handoff reason when no longer available
      updates.handoffReason = undefined;
    }

    // Create system message for status changes
    let systemMessageContent = "";
    let systemMessageType:
      | "handoff"
      | "agent_joined"
      | "agent_left"
      | undefined;

    if (
      status === "ai_handling" &&
      conversation.status === "support_staff_handling"
    ) {
      // Check if company has reached usage limit before allowing handback to AI
      const company = await ctx.db.get(conversation.companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      const plan = await ctx.db.get(company.planId);
      if (!plan) {
        throw new Error("Plan not found");
      }

      const hasReachedLimit =
        company.aiResponsesThisMonth >= plan.aiResponsesPerMonth;

      if (hasReachedLimit) {
        throw new Error(
          "Cannot hand back to AI: Company has reached AI usage limit"
        );
      }

      // Handing back to AI - clear participating agents
      updates.participatingAgents = [];
      systemMessageContent = "Conversation handed back to support bot.";
      systemMessageType = "handoff";
    } else if (
      status === "support_staff_handling" &&
      conversation.status === "available"
    ) {
      // Agent taking over
      systemMessageContent = `${agentName?.split(" ")[0] || "Support staff"} has joined the conversation.`;
      systemMessageType = "agent_joined";
    } else if (
      status === "available" &&
      conversation.status === "support_staff_handling"
    ) {
      // Handing off to available queue
      systemMessageContent = "Conversation handed off to support staff.";
      systemMessageType = "handoff";
    }

    // Update conversation
    await ctx.db.patch(conversationId, updates);

    // Create system message if needed
    if (systemMessageContent && systemMessageType) {
      await ctx.db.insert("messages", {
        conversationId,
        companyId: conversation.companyId,
        role: "system",
        content: systemMessageContent,
        timestamp: now,
        systemMessageType,
        agentId,
        agentName,
      });
    }

    return { success: true, updatedAt: now };
  },
});

// ============================================================================
// TRIGGER AI HANDOFF
// ============================================================================

export const triggerHandoff = mutation({
  args: {
    conversationId: v.id("conversations"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, reason }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    // Update conversation status
    await ctx.db.patch(conversationId, {
      status: "available",
      handoffTriggeredAt: now,
      handoffReason: reason,
      updatedAt: now,
    });

    // Create system message
    const messageContent = "Conversation handed off to support staff.";

    await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "system",
      content: messageContent,
      timestamp: now,
      systemMessageType: "handoff",
    });

    return { success: true, handoffAt: now };
  },
});

// ============================================================================
// AGENT TAKES OVER CONVERSATION
// ============================================================================

export const supportTakeover = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("users"),
  },
  handler: async (ctx, { conversationId, agentId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const agent = await ctx.db.get(agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const now = Date.now();

    // Check if agent is already participating
    const isAlreadyParticipating =
      conversation.participatingAgents.includes(agentId);

    const updates: any = {
      status: "support_staff_handling" as const,
      updatedAt: now,
    };

    // Add agent to participating agents if not already there
    if (!isAlreadyParticipating) {
      updates.participatingAgents = [
        ...conversation.participatingAgents,
        agentId,
      ];

      // Create system message for new agent joining
      await ctx.db.insert("messages", {
        conversationId,
        companyId: conversation.companyId,
        role: "system",
        content: `${agent.displayName} joined the conversation`,
        timestamp: now,
        systemMessageType: "agent_joined",
      });

      // Send automatic greeting if enabled
      if (agent.autoGreetingEnabled !== false && agent.agentGreeting) {
        await ctx.db.insert("messages", {
          conversationId,
          companyId: conversation.companyId,
          role: "agent",
          content: agent.agentGreeting,
          agentId: agentId,
          agentName: agent.displayName,
          timestamp: now + 1, // Slightly after the join message
        });
      }
    }

    await ctx.db.patch(conversationId, updates);

    return { success: true, joinedAt: now };
  },
});

// ============================================================================
// SET AI PROCESSING STATE
// ============================================================================

export const setAiProcessing = mutation({
  args: {
    conversationId: v.id("conversations"),
    isProcessing: v.boolean(),
  },
  handler: async (ctx, { conversationId, isProcessing }) => {
    const now = Date.now();

    await ctx.db.patch(conversationId, {
      aiProcessing: isProcessing,
      aiProcessingStartedAt: isProcessing ? now : undefined,
      updatedAt: now,
    });

    return { success: true };
  },
});

// ============================================================================
// MARK ISSUE AS RESOLVED (System Message)
// ============================================================================

export const markIssueResolved = mutation({
  args: {
    conversationId: v.id("conversations"),
    resolvedBy: v.union(v.literal("ai"), v.literal("agent")),
    agentId: v.optional(v.id("users")),
  },
  handler: async (ctx, { conversationId, resolvedBy, agentId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    // Create system message
    let messageContent = "Conversation marked as resolved";
    if (resolvedBy === "agent" && agentId) {
      const agent = await ctx.db.get(agentId);
      if (agent) {
        messageContent = `Conversation marked as resolved by ${agent.displayName.split(" ")[0]} (Support Staff)`;
      }
    } else if (resolvedBy === "ai") {
      messageContent = "Conversation marked as resolved by AI";
    }

    await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "system",
      content: messageContent,
      timestamp: now,
      systemMessageType: "issue_resolved",
    });

    // Update conversation status to resolved
    await ctx.db.patch(conversationId, {
      status: "resolved",
      updatedAt: now,
    });

    return { success: true, resolvedAt: now };
  },
});

// ============================================================================
// CLEAR PENDING AI JOB
// ============================================================================

export const clearPendingAIJob = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      pendingAIJobId: undefined,
    });
  },
});

// ============================================================================
// UPDATE CONVERSATION SUMMARY
// ============================================================================

export const updateConversationSummary = mutation({
  args: {
    conversationId: v.id("conversations"),
    summary: v.string(),
    messageCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      summary: args.summary,
      lastSummaryAt: Date.now(),
      lastSummaryMessageCount: args.messageCount,
    });
  },
});

// ============================================================================
// UPDATE OPENAI THREAD ID
// ============================================================================

export const updateThreadId = mutation({
  args: {
    conversationId: v.id("conversations"),
    openaiThreadId: v.string(),
  },
  handler: async (ctx, { conversationId, openaiThreadId }) => {
    await ctx.db.patch(conversationId, {
      openaiThreadId,
      updatedAt: Date.now(),
    });
  },
});
