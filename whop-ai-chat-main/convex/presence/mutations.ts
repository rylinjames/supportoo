/**
 * Presence Mutations
 *
 * Manage user presence and typing indicators.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update user presence (heartbeat)
 *
 * Called every 30 seconds from frontend to keep presence alive.
 * Upserts presence record with updated heartbeat and expiry.
 */
export const updatePresence = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    userRole: v.union(
      v.literal("customer"),
      v.literal("support"),
      v.literal("admin")
    ),
    viewingConversation: v.optional(v.id("conversations")), // NEW
  },
  handler: async (
    ctx,
    { userId, companyId, userRole, viewingConversation }
  ) => {
    const now = Date.now();
    const expiresAt = now + 60 * 1000; // 60 seconds TTL

    // Check if presence record exists
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        heartbeatAt: now,
        expiresAt,
        companyId, // Update in case user changed company
        userRole, // Update in case role changed
        viewingConversation, // NEW - updated with every heartbeat
      });
      return existing._id; // RETURN ID
    } else {
      // Create new presence record
      const presenceId = await ctx.db.insert("presence", {
        userId,
        companyId,
        userRole,
        isTyping: false,
        heartbeatAt: now,
        expiresAt,
        viewingConversation, // NEW
      });
      return presenceId; // RETURN ID
    }
  },
});

/**
 * Lightweight heartbeat update
 *
 * Updates only timestamp and viewing conversation.
 * Much faster than full updatePresence.
 */
export const heartbeat = mutation({
  args: {
    presenceId: v.id("presence"),
    viewingConversation: v.optional(v.id("conversations")),
  },
  handler: async (ctx, { presenceId, viewingConversation }) => {
    const now = Date.now();
    const expiresAt = now + 60 * 1000;

    try {
      await ctx.db.patch(presenceId, {
        heartbeatAt: now,
        expiresAt,
        viewingConversation,
      });
    } catch (error) {
      // If presence record was deleted, caller should re-initialize with updatePresence
      throw new Error(
        "Presence record not found. Re-initialize with updatePresence."
      );
    }
  },
});

/**
 * Set typing status
 *
 * Called when user starts/stops typing in a conversation.
 * Debounced on frontend (300ms) to reduce DB writes.
 */
export const setTyping = mutation({
  args: {
    userId: v.id("users"),
    conversationId: v.optional(v.id("conversations")),
    isTyping: v.boolean(),
  },
  handler: async (ctx, { userId, conversationId, isTyping }) => {
    const now = Date.now();

    // Get existing presence record
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!presence) {
      // No presence record yet - user needs to call updatePresence first
      throw new Error("Presence record not found. Call updatePresence first.");
    }

    // Update typing status
    const updates: any = {
      isTyping,
      heartbeatAt: now, // Update heartbeat
      expiresAt: now + 60 * 1000, // Extend TTL
    };

    if (isTyping && conversationId) {
      updates.typingInConversation = conversationId;
      updates.typingStartedAt = now;
    } else {
      // Clear typing state
      updates.typingInConversation = undefined;
      updates.typingStartedAt = undefined;
    }

    await ctx.db.patch(presence._id, updates);
  },
});

/**
 * Clear typing status
 *
 * Called when user sends a message or explicitly stops typing.
 * Immediately removes typing indicator.
 */
export const clearTyping = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (presence && presence.isTyping) {
      await ctx.db.patch(presence._id, {
        isTyping: false,
        typingInConversation: undefined,
        typingStartedAt: undefined,
        heartbeatAt: Date.now(),
      });
    }
  },
});

/**
 * Cleanup stale presence records
 *
 * Called by cron job hourly.
 * Removes records where expiresAt < now.
 * Limited to 100 records per run to prevent timeouts.
 */
export const cleanupStalePresence = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired presence records (limit batch size)
    const expired = await ctx.db
      .query("presence")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(100); // Limit batch size to prevent timeouts

    // Delete expired records
    for (const record of expired) {
      await ctx.db.delete(record._id);
    }

    return {
      deleted: expired.length,
    };
  },
});
