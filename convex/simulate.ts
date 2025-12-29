/**
 * CONVERSATION SIMULATION
 *
 * Test functions to simulate the complete conversation lifecycle:
 * 1. Customer sends initial message
 * 2. AI handling stage
 * 3. Handoff to support staff
 * 4. Agent takeover
 * 5. Support staff handling
 * 6. Resolution
 */

import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// ============================================================================
// COMPANY CONTEXT: ADD TECHFLOW SAMPLE DATA
// ============================================================================

export const addTechFlowContext = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const techFlowContext = `TechFlow SaaS - Cloud-Based Project Management Platform

About TechFlow:
TechFlow is a cloud-based project management platform designed for remote teams. Founded in 2021, we help companies manage workflows, track progress, and collaborate seamlessly across time zones.

Core Products:
1. TechFlow Dashboard - Central hub for project oversight with real-time analytics and reporting
2. TechFlow Tasks - Task management with kanban boards, gantt charts, and sprint planning
3. TechFlow Connect - Video conferencing and screen sharing integrated into the platform
4. TechFlow Mobile - iOS and Android apps for on-the-go project management

Pricing Plans:
- Starter Plan: $15/month per user - Up to 10 projects, 5GB storage
- Professional Plan: $29/month per user - Unlimited projects, 50GB storage, advanced reporting
- Enterprise Plan: $49/month per user - Everything in Pro plus SSO, priority support, custom integrations

Key Features:
- Real-time collaboration with live cursors and updates
- Custom workflows and automation rules
- Time tracking and invoicing capabilities
- 200+ third-party integrations (Slack, GitHub, Jira, etc.)
- Advanced security with 2FA and end-to-end encryption

Company Policies:
- 30-day free trial on all plans, no credit card required
- 14-day money-back guarantee after trial
- Annual billing saves 20% compared to monthly
- Free migration assistance from competitor platforms
- 99.9% uptime SLA on Professional and Enterprise plans

Support Channels:
- In-app chat support (you're currently using it!)
- Email support: support@techflow.io
- Knowledge base with 500+ articles
- Video tutorials and webinars
- Professional plan includes phone support
- Enterprise plan includes dedicated account manager

Common Questions:
- Data is hosted on AWS in US-East and EU-West regions
- GDPR and SOC 2 Type II compliant
- Automatic daily backups with 90-day retention
- Team size limits: Starter (up to 25 users), Pro (up to 100 users), Enterprise (unlimited)
- Mobile apps work offline with automatic sync when back online

Recent Updates:
- AI-powered task suggestions launched in March 2024
- New kanban board templates added in February 2024
- Gantt chart improvements in January 2024`;

    await ctx.db.patch(companyId, {
      companyContextOriginal: techFlowContext,
      companyContextProcessed: techFlowContext,
      companyContextLastUpdated: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`✅ Added TechFlow context to company ${companyId}`);
    return { success: true, message: "TechFlow context added successfully" };
  },
});

// ============================================================================
// STAGE 1: CREATE TEST CONVERSATION
// ============================================================================

export const createTestConversation = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const now = Date.now();

    // Get or create a test customer
    let customer = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) =>
        q.eq("whopUserId", "test_customer_1")
      )
      .first();

    if (!customer) {
      const customerId = await ctx.db.insert("users", {
        whopUserId: "test_customer_1",
        companyId,
        whopUsername: "test.customer",
        displayName: "Test Customer",
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
        role: "customer",
        roleLastChecked: now,
        timezone: "America/New_York",
        theme: "system",
        notificationsEnabled: true,
        lastActiveAt: now,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      });

      customer = await ctx.db.get(customerId);
    }

    if (!customer) {
      throw new Error("Failed to create test customer");
    }

    // Create a new conversation
    const conversationId = await ctx.db.insert("conversations", {
      companyId,
      customerId: customer._id,
      status: "ai_handling",
      aiProcessing: false,
      participatingAgents: [],
      messageCount: 0,
      firstMessageAt: now,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial message
    await ctx.db.insert("messages", {
      conversationId,
      companyId,
      role: "customer",
      content: "Hello, I need help with my account!",
      timestamp: now,
    });

    console.log(`✅ Created test conversation ${conversationId}`);
    return {
      conversationId,
      customerId: customer._id,
      customerName: customer.displayName,
    };
  },
});

// ============================================================================
// STAGE 2: SIMULATE AI RESPONSE
// ============================================================================

export const simulateAIResponse = mutation({
  args: {
    conversationId: v.id("conversations"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, message }) => {
    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const aiMessage =
      message ||
      "Hello! I'm here to help. Could you please provide more details about the issue you're experiencing?";

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "ai",
      content: aiMessage,
      timestamp: now,
      aiModel: "gpt-4o",
      tokensUsed: 150,
      processingTime: 1200,
    });

    console.log(`✅ AI response sent: ${messageId}`);
    return { messageId, content: aiMessage };
  },
});

// ============================================================================
// STAGE 3: TRIGGER HANDOFF TO SUPPORT
// ============================================================================

export const simulateHandoff = mutation({
  args: {
    conversationId: v.id("conversations"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, reason }) => {
    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Update conversation status to "available" (waiting for support staff)
    await ctx.db.patch(conversationId, {
      status: "available",
      handoffTriggeredAt: now,
      handoffReason: reason || "Customer requested human support",
      updatedAt: now,
    });

    // Create system message
    await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "system",
      content: "Conversation handed off to support staff.",
      timestamp: now,
      systemMessageType: "handoff",
    });

    console.log(`✅ Handoff triggered for conversation ${conversationId}`);
    return { success: true, status: "available" };
  },
});

// ============================================================================
// STAGE 4: AGENT TAKEOVER
// ============================================================================

export const simulateAgentTakeover = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("users"),
  },
  handler: async (ctx, { conversationId, agentId }) => {
    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);
    const agent = await ctx.db.get(agentId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Update conversation status to "support_staff_handling"
    await ctx.db.patch(conversationId, {
      status: "support_staff_handling",
      participatingAgents: [agentId],
      handoffReason: undefined,
      handoffTriggeredAt: undefined,
      updatedAt: now,
    });

    // Create system message
    const firstName = agent.displayName.split(" ")[0];
    await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "system",
      content: `${firstName} (Support Staff) has joined the conversation.`,
      timestamp: now - 1,
      systemMessageType: "agent_joined",
      agentId,
    });

    console.log(`✅ Agent ${agent.displayName} took over conversation`);
    return { success: true, agentName: agent.displayName };
  },
});

// ============================================================================
// STAGE 5: AGENT SENDS MESSAGE
// ============================================================================

export const simulateAgentMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("users"),
    message: v.string(),
  },
  handler: async (ctx, { conversationId, agentId, message }) => {
    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);
    const agent = await ctx.db.get(agentId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (!agent) {
      throw new Error("Agent not found");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "agent",
      content: message,
      timestamp: now,
      agentId,
      agentName: agent.displayName,
    });

    // Update conversation's last message timestamp
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      lastAgentMessage: now,
      updatedAt: now,
    });

    console.log(`✅ Agent message sent: ${messageId}`);
    return { messageId };
  },
});

// ============================================================================
// STAGE 6: CUSTOMER REPLY
// ============================================================================

export const simulateCustomerReply = mutation({
  args: {
    conversationId: v.id("conversations"),
    message: v.string(),
  },
  handler: async (ctx, { conversationId, message }) => {
    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "customer",
      content: message,
      timestamp: now,
    });

    // Update conversation's last message timestamp
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      updatedAt: now,
    });

    console.log(`✅ Customer reply sent: ${messageId}`);
    return { messageId };
  },
});

// ============================================================================
// STAGE 7: RESOLVE CONVERSATION
// ============================================================================

export const simulateResolve = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.optional(v.id("users")),
  },
  handler: async (ctx, { conversationId, agentId }) => {
    const now = Date.now();
    const conversation = await ctx.db.get(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    let agent;
    if (agentId) {
      agent = await ctx.db.get(agentId);
    }

    // Update conversation status to "resolved"
    await ctx.db.patch(conversationId, {
      status: "resolved",
      updatedAt: now,
    });

    // Create system message
    const content = agent
      ? `Conversation marked as resolved by ${agent.displayName.split(" ")[0]}.`
      : "Conversation marked as resolved.";

    await ctx.db.insert("messages", {
      conversationId,
      companyId: conversation.companyId,
      role: "system",
      content,
      timestamp: now,
      systemMessageType: "issue_resolved",
      agentId,
    });

    console.log(`✅ Conversation resolved: ${conversationId}`);
    return { success: true };
  },
});

// ============================================================================
// UTILITY: GET CONVERSATION STATUS
// ============================================================================

export const getConversationStatus = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("desc")
      .take(10);

    return {
      status: conversation.status,
      aiProcessing: conversation.aiProcessing,
      participatingAgents: conversation.participatingAgents,
      handoffReason: conversation.handoffReason,
      messageCount: messages.length,
      lastMessage: messages[0]?.content || "No messages",
    };
  },
});

// ============================================================================
// AGENT TEST FUNCTIONS
// ============================================================================

/**
 * Create a test agent user
 */
export const createTestAgent = mutation({
  args: {
    companyId: v.id("companies"),
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, username, displayName }) => {
    const now = Date.now();
    const testUsername = username || `test.agent.${Date.now()}`;
    const testDisplayName = displayName || "Test Agent";

    const agentId = await ctx.db.insert("users", {
      whopUserId: `test_agent_${Date.now()}`,
      companyId,
      whopUsername: testUsername,
      displayName: testDisplayName,
      avatarUrl:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      role: "support",
      roleLastChecked: now,
      timezone: "America/New_York",
      theme: "system",
      notificationsEnabled: true,
      lastActiveAt: now,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✅ Created test agent ${agentId}`);
    return { agentId, username: testUsername, displayName: testDisplayName };
  },
});

/**
 * Add test agent to conversation (as participating agent)
 */
export const addAgentToConversation = mutation({
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

    // Add agent to participating agents if not already there
    const participatingAgents = conversation.participatingAgents || [];
    if (!participatingAgents.includes(agentId)) {
      participatingAgents.push(agentId);
    }

    await ctx.db.patch(conversationId, {
      participatingAgents,
      updatedAt: Date.now(),
    });

    console.log(`✅ Added agent ${agent.displayName} to conversation`);
    return { success: true, agentName: agent.displayName };
  },
});

/**
 * Remove test agent from conversation
 */
export const removeAgentFromConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("users"),
  },
  handler: async (ctx, { conversationId, agentId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participatingAgents = (conversation.participatingAgents || []).filter(
      (id) => id !== agentId
    );

    await ctx.db.patch(conversationId, {
      participatingAgents,
      updatedAt: Date.now(),
    });

    console.log(`✅ Removed agent from conversation`);
    return { success: true };
  },
});

/**
 * List all test agents for a company
 */
export const listTestAgents = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const agents = await ctx.db
      .query("users")
      .withIndex("by_company_role", (q) =>
        q.eq("companyId", companyId).eq("role", "support")
      )
      .filter((q) => q.eq(q.field("whopUserId"), "test_agent"))
      .collect();

    return agents.map((agent) => ({
      id: agent._id,
      username: agent.whopUsername,
      displayName: agent.displayName,
      createdAt: agent.createdAt,
    }));
  },
});

/**
 * Delete a test agent
 */
export const deleteTestAgent = mutation({
  args: {
    agentId: v.id("users"),
  },
  handler: async (ctx, { agentId }) => {
    await ctx.db.delete(agentId);
    console.log(`🗑️ Deleted test agent ${agentId}`);
    return { success: true };
  },
});

// ============================================================================
// CUSTOMER TEST FUNCTIONS
// ============================================================================

/**
 * Create a test customer user
 */
export const createTestCustomer = mutation({
  args: {
    companyId: v.id("companies"),
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, username, displayName }) => {
    const now = Date.now();
    const testUsername = username || `test.customer.${Date.now()}`;
    const testDisplayName = displayName || "Test Customer";

    const customerId = await ctx.db.insert("users", {
      whopUserId: `test_customer_${Date.now()}`,
      companyId,
      whopUsername: testUsername,
      displayName: testDisplayName,
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      role: "customer",
      roleLastChecked: now,
      timezone: "America/New_York",
      theme: "system",
      notificationsEnabled: true,
      lastActiveAt: now,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✅ Created test customer ${customerId}`);
    return {
      customerId,
      username: testUsername,
      displayName: testDisplayName,
    };
  },
});

/**
 * Get test customer by ID
 */
export const getTestCustomer = query({
  args: {
    customerId: v.id("users"),
  },
  handler: async (ctx, { customerId }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    return {
      id: customer._id,
      username: customer.whopUsername,
      displayName: customer.displayName,
      role: customer.role,
      createdAt: customer.createdAt,
    };
  },
});

/**
 * Delete a test customer (and cleanup related data)
 */
export const deleteTestCustomer = mutation({
  args: {
    customerId: v.id("users"),
  },
  handler: async (ctx, { customerId }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    if (!customer.companyId) {
      throw new Error("Customer has no companyId");
    }

    // Get all conversations for this customer
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_customer", (q) =>
        q.eq("companyId", customer.companyId!).eq("customerId", customerId)
      )
      .collect();

    // Delete all messages in these conversations
    for (const conversation of conversations) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conversation._id)
        )
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      await ctx.db.delete(conversation._id);
    }

    // Delete any presence records
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", customerId))
      .collect();

    for (const p of presence) {
      await ctx.db.delete(p._id);
    }

    await ctx.db.delete(customerId);

    console.log(`🗑️ Cleaned up test customer ${customerId}`);
    return { success: true };
  },
});

/**
 * Simulate customer reading messages (mark as read by customer)
 */
export const simulateCustomerReadMessages = mutation({
  args: {
    conversationId: v.id("conversations"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { conversationId, customerId }) => {
    const now = Date.now();

    // Get all unread agent/AI messages in this conversation
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field("role"), "agent"), q.eq(q.field("role"), "ai")),
          q.eq(q.field("readByCustomerAt"), undefined)
        )
      )
      .collect();

    // Mark all as read by customer
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        readByCustomerAt: now,
      });
    }

    console.log(
      `✅ Marked ${unreadMessages.length} messages as read by customer`
    );
    return { success: true, messagesMarkedRead: unreadMessages.length };
  },
});
