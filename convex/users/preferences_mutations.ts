/**
 * User Preferences Mutations
 *
 * Mutations for updating user preferences (theme, timezone, notifications).
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Update user preferences
 *
 * Allows users to update their theme, timezone, and notification preferences.
 */
export const updateUserPreferences = mutation({
  args: {
    userId: v.id("users"),
    timezone: v.optional(v.string()),
    theme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system"))
    ),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, timezone, theme, notificationsEnabled }) => {
    // Get the user to ensure they exist
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Build update object with only provided fields
    const update: {
      timezone?: string;
      theme?: "light" | "dark" | "system";
      notificationsEnabled?: boolean;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (timezone !== undefined) {
      update.timezone = timezone;
    }

    if (theme !== undefined) {
      update.theme = theme;
    }

    if (notificationsEnabled !== undefined) {
      update.notificationsEnabled = notificationsEnabled;
    }

    // Update the user document
    await ctx.db.patch(userId, update);

    return { success: true };
  },
});
