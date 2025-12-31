import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";
import { acquireLock, releaseLock } from "../utils/transactions";

/**
 * MESSAGES MUTATIONS
 * Handles message creation and read receipts
 */

// ============================================================================
// CREATE MESSAGE
// ============================================================================

export const createMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.union(
      v.literal("customer"),
      v.literal("ai"),
      v.literal("agent"),
      v.literal("system")
    ),
    content: v.string(),

    // Optional fields
    agentId: v.optional(v.id("users")),
    agentName: v.optional(v.string()),
    aiModel: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    processingTime: v.optional(v.number()),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),
    systemMessageType: v.optional(
      v.union(
        v.literal("handoff"),
        v.literal("agent_joined"),
        v.literal("agent_left"),
        v.literal("issue_resolved")
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get conversation to get companyId
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Create message
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      companyId: conversation.companyId,
      role: args.role,
      content: args.content,
      timestamp: now,

      // Optional fields
      agentId: args.agentId,
      agentName: args.agentName,
      aiModel: args.aiModel,
      tokensUsed: args.tokensUsed,
      processingTime: args.processingTime,
      attachmentUrl: args.attachmentUrl,
      attachmentName: args.attachmentName,
      attachmentSize: args.attachmentSize,
      attachmentType: args.attachmentType,
      systemMessageType: args.systemMessageType,

      // Read receipts start as undefined (unread)
      readByAgentAt: undefined,
      readByCustomerAt: undefined,
    });

    // Update conversation metadata
    await ctx.db.patch(args.conversationId, {
      messageCount: conversation.messageCount + 1,
      lastMessageAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

// ============================================================================
// MARK MESSAGES AS READ BY AGENT
// ============================================================================

export const markMessagesAsReadByAgent = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("users"),
  },
  handler: async (ctx, { conversationId, agentId }) => {
    const now = Date.now();

    // Get all unread customer messages in this conversation
    // Using compound index for fast lookup: by_conversation_role_unread_agent
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_role_unread_agent", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("role", "customer")
          .eq("readByAgentAt", undefined)
      )
      .collect();

    // Mark all as read
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        readByAgentAt: now,
      });
    }

    return {
      markedAsRead: unreadMessages.length,
      readAt: now,
    };
  },
});

// ============================================================================
// MARK MESSAGES AS READ BY CUSTOMER
// ============================================================================

export const markMessagesAsReadByCustomer = mutation({
  args: {
    conversationId: v.id("conversations"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { conversationId, customerId }) => {
    const now = Date.now();

    // Get all unread agent and AI messages in this conversation
    // We need to get both agent and AI messages, so we'll do two queries
    const unreadAgentMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_role_unread_customer", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("role", "agent")
          .eq("readByCustomerAt", undefined)
      )
      .collect();

    const unreadAiMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_role_unread_customer", (q) =>
        q
          .eq("conversationId", conversationId)
          .eq("role", "ai")
          .eq("readByCustomerAt", undefined)
      )
      .collect();

    // Combine both arrays
    const allUnreadMessages = [...unreadAgentMessages, ...unreadAiMessages];

    // Mark all as read
    for (const message of allUnreadMessages) {
      await ctx.db.patch(message._id, {
        readByCustomerAt: now,
      });
    }

    return {
      markedAsRead: allUnreadMessages.length,
      readAt: now,
    };
  },
});

// ============================================================================
// SEND CUSTOMER MESSAGE (convenience mutation)
// ============================================================================

export const sendCustomerMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),
    experienceId: v.string(), // Passed from route params
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();
    let extraMessages = 0;

    // ⭐ CRITICAL: Auto-unresolve if conversation was resolved
    if (conversation.status === "resolved") {
      await ctx.db.patch(args.conversationId, {
        status: "ai_handling", // Back to AI
        participatingAgents: [], // Clear agents
        updatedAt: now,
      });

      // System message for unresolve
      await ctx.db.insert("messages", {
        conversationId: args.conversationId,
        companyId: conversation.companyId,
        role: "system",
        content: "Your conversation has been reopened.",
        timestamp: now - 1,
        systemMessageType: "handoff",
      });

      extraMessages = 1;
    }

    // Create customer message
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      companyId: conversation.companyId,
      role: "customer",
      content: args.content,
      timestamp: now,
      attachmentUrl: args.attachmentUrl,
      attachmentName: args.attachmentName,
      attachmentSize: args.attachmentSize,
      attachmentType: args.attachmentType,

      // Read receipts start as undefined (unread)
      readByAgentAt: undefined,
      readByCustomerAt: undefined,
    });

    // Update conversation
    await ctx.db.patch(args.conversationId, {
      messageCount: conversation.messageCount + 1 + extraMessages,
      lastMessageAt: now,
      updatedAt: now,
    });

    // Update customer's last active timestamp
    await ctx.db.patch(conversation.customerId, {
      lastActiveAt: now,
    });

    // ⭐ AUTO-TRIGGER AI RESPONSE WITH 1s DEBOUNCE
    if (conversation.status === "ai_handling" && !conversation.aiProcessing) {
      // Cancel any pending AI trigger from previous messages
      if (conversation.pendingAIJobId) {
        try {
          await ctx.scheduler.cancel(conversation.pendingAIJobId);
          console.log("🔄 Debounce: cancelled previous AI job");
        } catch (error) {
          // Job may have already started, that's fine
          console.log("⚠️  Could not cancel previous job (may have started)");
        }
      }

      // Fetch company for AI config
      const company = await ctx.db.get(conversation.companyId);

      if (!company) {
        throw new Error("Company not found");
      }

      const aiConfig = {
        aiPersonality: company.aiPersonality,
        aiResponseLength: company.aiResponseLength,
        aiSystemPrompt: company.aiSystemPrompt,
        aiHandoffTriggers: company.aiHandoffTriggers,
        companyContext:
          company.companyContextOriginal ||
          company.companyContextProcessed ||
          "",
        selectedAiModel: company.selectedAiModel,
      };

      // Schedule AI response with 1 second delay (debounce)
      console.log("🔴 SCHEDULING AI RESPONSE FOR MESSAGE:", {
        conversationId: args.conversationId,
        messageId,
        customerMessage: args.content,
        timestamp: new Date().toISOString()
      });
      
      const jobId = await ctx.scheduler.runAfter(
        500, // 0.5 second debounce
        api.ai.chatCompletions.generateChatResponse,
        {
          conversationId: args.conversationId,
          messageId,
        }
      );

      // Store job ID so we can cancel it if more messages arrive
      await ctx.db.patch(args.conversationId, {
        pendingAIJobId: jobId,
      });

      console.log(`🔴 AI RESPONSE SCHEDULED! JobId: ${jobId}, Will run in 0.5 seconds`);
    }

    return messageId;
  },
});

// ============================================================================
// SEND AGENT MESSAGE (convenience mutation)
// ============================================================================

export const sendAgentMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("users"),
    content: v.string(),
    attachmentUrl: v.optional(v.string()),
    attachmentName: v.optional(v.string()),
    attachmentSize: v.optional(v.number()),
    attachmentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Acquire lock to prevent race conditions when multiple agents join simultaneously
    let lockId = null;
    try {
      const lock = await ctx.runMutation(api.utils.transactions.acquireLock, {
        resourceType: "conversation",
        resourceId: args.conversationId,
        userId: args.agentId,
        operation: "sendAgentMessage",
        timeoutMs: 3000, // 3 second timeout
      });
      lockId = lock.lockId;

      // Get conversation and agent info
      const conversation = await ctx.db.get(args.conversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const agent = await ctx.db.get(args.agentId);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const now = Date.now();

      // Re-check if this is the agent's first join (after acquiring lock)
      const isFirstJoin = !conversation.participatingAgents.includes(
        args.agentId
      );

    // Create system message FIRST if this is the agent's first message (they just joined)
    if (isFirstJoin) {
      await ctx.db.insert("messages", {
        conversationId: args.conversationId,
        companyId: conversation.companyId,
        role: "system",
        content: `${agent.displayName.split(" ")[0]} (Support Staff) has joined the conversation.`,
        timestamp: now - 1, // Ensure system message comes before agent message
        systemMessageType: "agent_joined",
        agentId: args.agentId,
        agentName: agent.displayName,
      });
    }

    // Create agent message
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      companyId: conversation.companyId,
      role: "agent",
      content: args.content,
      timestamp: now,
      agentId: args.agentId,
      agentName: agent.displayName,
      attachmentUrl: args.attachmentUrl,
      attachmentName: args.attachmentName,
      attachmentSize: args.attachmentSize,
      attachmentType: args.attachmentType,

      // Read receipts start as undefined (unread)
      readByAgentAt: undefined,
      readByCustomerAt: undefined,
    });

    // Update conversation status to support_staff_handling
    const updates: any = {
      status: "support_staff_handling" as const,
      messageCount: conversation.messageCount + 1 + (isFirstJoin ? 1 : 0), // +1 for system message if first join
      lastMessageAt: now,
      lastAgentMessage: now,
      updatedAt: now,
    };

    // Add agent to participating agents if not already there
    if (isFirstJoin) {
      updates.participatingAgents = [
        ...conversation.participatingAgents,
        args.agentId,
      ];
    }

    await ctx.db.patch(args.conversationId, updates);

    // Add agent message to OpenAI thread (non-blocking, async)
    // This ensures AI sees agent messages when it takes over again
    if (conversation.openaiThreadId) {
      ctx.scheduler.runAfter(0, api.ai.assistants.addAgentMessageToThread, {
        conversationId: args.conversationId,
        content: args.content,
        agentName: agent.displayName,
      });
    }

      // Release lock before returning
      if (lockId) {
        await ctx.runMutation(api.utils.transactions.releaseLock, { lockId, userId: args.agentId });
      }

      return messageId;
    } catch (error) {
      // Always release lock on error
      if (lockId) {
        try {
          await ctx.runMutation(api.utils.transactions.releaseLock, { lockId, userId: args.agentId });
        } catch {
          // Ignore release errors
        }
      }
      throw error;
    }
  },
});
