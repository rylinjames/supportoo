/**
 * Conversation Export Functionality
 * 
 * Exports conversations and their messages to CSV format
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * Export a single conversation to CSV format
 */
export const exportConversationToCSV = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, { conversationId }) => {
    // Get conversation
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Get customer info
    const customer = await ctx.db.get(conversation.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    // Get all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => 
        q.eq("conversationId", conversationId)
      )
      .order("asc")
      .collect();

    // Get agent names for agent messages
    const agentIds = [...new Set(messages
      .filter(m => m.agentId)
      .map(m => m.agentId!)
    )];
    
    const agents = await Promise.all(
      agentIds.map(id => ctx.db.get(id))
    );
    
    const agentMap = new Map(
      agents.map(agent => [agent?._id, agent?.displayName || "Unknown Agent"])
    );

    // Create CSV header
    const headers = [
      "Timestamp",
      "Sender",
      "Role",
      "Message",
      "Attachment",
      "Read By Customer",
      "Read By Agent"
    ];

    // Create CSV rows
    const rows = messages.map(msg => {
      const timestamp = new Date(msg.timestamp).toISOString();
      let sender = "";
      
      switch (msg.role) {
        case "customer":
          sender = customer.displayName || customer.whopUsername;
          break;
        case "agent":
          sender = msg.agentId ? agentMap.get(msg.agentId) || "Agent" : "Agent";
          break;
        case "ai":
          sender = "AI Assistant";
          break;
        case "system":
          sender = "System";
          break;
      }

      return [
        timestamp,
        sender,
        msg.role,
        msg.content.replace(/"/g, '""'), // Escape quotes
        msg.attachmentUrl || "",
        msg.readByCustomerAt ? new Date(msg.readByCustomerAt).toISOString() : "",
        msg.readByAgentAt ? new Date(msg.readByAgentAt).toISOString() : ""
      ];
    });

    // Combine into CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Return CSV data and metadata
    return {
      csv: csvContent,
      metadata: {
        conversationId,
        customerName: customer.displayName || customer.whopUsername,
        messageCount: messages.length,
        createdAt: conversation.createdAt,
        status: conversation.status,
        exportedAt: Date.now()
      }
    };
  },
});

/**
 * Export multiple conversations to CSV
 */
export const exportConversationsToCSV = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(v.union(
      v.literal("ai_handling"),
      v.literal("available"),
      v.literal("support_staff_handling"),
      v.literal("resolved")
    )),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, { companyId, status, startDate, endDate }) => {
    // Build query
    let conversationsQuery = ctx.db
      .query("conversations")
      .withIndex("by_company_updated", (q) => 
        q.eq("companyId", companyId)
      );

    // Apply filters
    if (status) {
      conversationsQuery = conversationsQuery.filter((q) =>
        q.eq(q.field("status"), status)
      );
    }

    let conversations = await conversationsQuery.collect();

    // Filter by date if provided
    if (startDate || endDate) {
      conversations = conversations.filter(conv => {
        if (startDate && conv.createdAt < startDate) return false;
        if (endDate && conv.createdAt > endDate) return false;
        return true;
      });
    }

    // Get all customer IDs
    const customerIds = [...new Set(conversations.map(c => c.customerId))];
    const customers = await Promise.all(
      customerIds.map(id => ctx.db.get(id))
    );
    const customerMap = new Map(
      customers.map(customer => [
        customer?._id, 
        customer?.displayName || customer?.whopUsername || "Unknown"
      ])
    );

    // Create CSV header
    const headers = [
      "Conversation ID",
      "Customer",
      "Status",
      "Created At",
      "Last Message At",
      "Message Count",
      "Participating Agents",
      "Handoff Reason"
    ];

    // Create CSV rows
    const rows = conversations.map(conv => {
      return [
        conv._id,
        customerMap.get(conv.customerId) || "Unknown",
        conv.status,
        new Date(conv.createdAt).toISOString(),
        new Date(conv.lastMessageAt).toISOString(),
        conv.messageCount.toString(),
        conv.participatingAgents.length.toString(),
        conv.handoffReason || ""
      ];
    });

    // Combine into CSV string
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    return {
      csv: csvContent,
      metadata: {
        companyId,
        conversationCount: conversations.length,
        filters: { status, startDate, endDate },
        exportedAt: Date.now()
      }
    };
  },
});