/**
 * Presence Queries
 *
 * Read-only operations for fetching presence and typing indicators.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Get conversation presence (who's typing?)
 *
 * Returns all users currently typing in a specific conversation.
 * Excludes the current user (don't show "You are typing...").
 * Used for real-time typing indicators in chat interface.
 */
export const getConversationPresence = query({
  args: {
    conversationId: v.id("conversations"),
    excludeUserId: v.optional(v.id("users")),
    requestingUserId: v.optional(v.id("users")), // For authorization
  },
  handler: async (ctx, { conversationId, excludeUserId, requestingUserId }) => {
    // Authorization: Verify conversation exists and user has access
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // If requestingUserId provided, verify they have access to this conversation's company
    if (requestingUserId) {
      const user = await ctx.db.get(requestingUserId);
      if (!user) {
        throw new Error("User not found");
      }
      // Check if user belongs to the conversation's company
      const userCompany = await ctx.db
        .query("user_companies")
        .withIndex("by_user_company", (q) =>
          q.eq("userId", requestingUserId).eq("companyId", conversation.companyId)
        )
        .first();
      if (!userCompany) {
        throw new Error("User does not have access to this conversation");
      }
    }

    const now = Date.now();

    // Get all users typing in this conversation
    let typingUsers = await ctx.db
      .query("presence")
      .withIndex("by_conversation", (q) =>
        q.eq("typingInConversation", conversationId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("isTyping"), true),
          q.gt(q.field("expiresAt"), now) // Not expired
        )
      )
      .collect();

    // Exclude current user if specified
    if (excludeUserId) {
      typingUsers = typingUsers.filter((p) => p.userId !== excludeUserId);
    }

    // Get user details for each typing user
    const typingUsersWithDetails = await Promise.all(
      typingUsers.map(async (presence) => {
        const user = await ctx.db.get(presence.userId);
        return {
          userId: presence.userId,
          userRole: presence.userRole,
          displayName: user?.displayName || "User",
          avatarUrl: user?.avatarUrl,
          typingStartedAt: presence.typingStartedAt,
        };
      })
    );

    return typingUsersWithDetails;
  },
});

/**
 * Get user presence
 *
 * Returns presence info for a specific user.
 * Useful for debugging or showing user status.
 */
export const getUserPresence = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!presence) {
      return null;
    }

    const now = Date.now();
    const isActive = presence.expiresAt > now;

    return {
      userId: presence.userId,
      companyId: presence.companyId,
      userRole: presence.userRole,
      isTyping: presence.isTyping,
      typingInConversation: presence.typingInConversation,
      typingStartedAt: presence.typingStartedAt,
      lastHeartbeat: presence.heartbeatAt,
      isActive,
      expiresAt: presence.expiresAt,
    };
  },
});

/**
 * Get all active presence for a company
 *
 * Returns all active users for a company.
 * Useful for admin dashboards or analytics.
 */
export const getCompanyPresence = query({
  args: {
    companyId: v.id("companies"),
    requestingUserId: v.optional(v.id("users")), // For authorization
  },
  handler: async (ctx, { companyId, requestingUserId }) => {
    // Authorization: If requestingUserId provided, verify they belong to this company
    if (requestingUserId) {
      const userCompany = await ctx.db
        .query("user_companies")
        .withIndex("by_user_company", (q) =>
          q.eq("userId", requestingUserId).eq("companyId", companyId)
        )
        .first();
      if (!userCompany) {
        throw new Error("User does not have access to this company");
      }
    }

    const now = Date.now();

    // Get all non-expired presence records for company
    const activePresence = await ctx.db
      .query("presence")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .collect();

    // Get user details
    const presenceWithDetails = await Promise.all(
      activePresence.map(async (presence) => {
        const user = await ctx.db.get(presence.userId);
        return {
          userId: presence.userId,
          userRole: presence.userRole,
          displayName: user?.displayName || "User",
          isTyping: presence.isTyping,
          typingInConversation: presence.typingInConversation,
          lastHeartbeat: presence.heartbeatAt,
        };
      })
    );

    return presenceWithDetails;
  },
});

/**
 * Get agents viewing a conversation
 *
 * Returns user IDs of agents currently viewing this conversation.
 */
export const getViewingAgents = query({
  args: {
    conversationId: v.id("conversations"),
    requestingUserId: v.optional(v.id("users")), // For authorization
  },
  handler: async (ctx, { conversationId, requestingUserId }) => {
    // Authorization: Verify conversation exists and user has access
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (requestingUserId) {
      const userCompany = await ctx.db
        .query("user_companies")
        .withIndex("by_user_company", (q) =>
          q.eq("userId", requestingUserId).eq("companyId", conversation.companyId)
        )
        .first();
      if (!userCompany) {
        throw new Error("User does not have access to this conversation");
      }
    }

    const now = Date.now();

    const viewingPresence = await ctx.db
      .query("presence")
      .withIndex("by_viewing", (q) =>
        q.eq("viewingConversation", conversationId)
      )
      .filter((q) =>
        q.and(
          q.gt(q.field("expiresAt"), now), // Not expired
          q.neq(q.field("userRole"), "customer") // Only agents
        )
      )
      .collect();

    return viewingPresence.map((p) => p.userId);
  },
});
