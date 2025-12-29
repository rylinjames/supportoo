/**
 * User Activity Tracking
 * 
 * Updates and queries user activity timestamps
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

/**
 * Update user's last active timestamp
 */
export const updateLastActive = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, {
      lastActiveAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Get user's last active timestamp  
 */
export const getLastActive = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    try {
      const user = await ctx.db.get(userId);
      return user?.lastActiveAt || null;
    } catch (error) {
      console.warn(`Failed to get last active for user ${userId}:`, error);
      return null;
    }
  },
});

/**
 * Get multiple users' last active timestamps
 */
export const getBulkLastActive = query({
  args: {
    userIds: v.array(v.id("users")),
  },
  handler: async (ctx, { userIds }) => {
    const users = await Promise.all(
      userIds.map(id => ctx.db.get(id))
    );
    
    return users.reduce((acc, user) => {
      if (user) {
        acc[user._id] = user.lastActiveAt;
      }
      return acc;
    }, {} as Record<string, number>);
  },
});