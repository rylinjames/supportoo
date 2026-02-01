/**
 * User Sync Mutations
 *
 * Handles creating and updating users in our database based on Whop data.
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Create a new user
 *
 * Called during onboarding when we need to create a user for the first time.
 */
export const createUser = mutation({
  args: {
    whopUserId: v.string(),
    whopUsername: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      whopUserId: args.whopUserId,
      whopUsername: args.whopUsername,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      roleLastChecked: now,

      // Default preferences
      timezone: args.timezone || "America/New_York",
      theme: "system",
      notificationsEnabled: true,

      // Activity tracking
      lastActiveAt: now,
      lastLoginAt: now,

      // Metadata
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

/**
 * Create or update user from Whop data
 *
 * Called after successful Whop authentication to sync user data to our DB.
 */
export const createOrUpdateUser = mutation({
  args: {
    whopUserId: v.string(),
    whopUsername: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", args.whopUserId))
      .first();

    const now = Date.now();

    if (existingUser) {
      // Update existing user (no role/companyId updates here)
      await ctx.db.patch(existingUser._id, {
        whopUsername: args.whopUsername,
        displayName: args.displayName,
        avatarUrl: args.avatarUrl,
        roleLastChecked: now,
        lastLoginAt: now,
        lastActiveAt: now,
        updatedAt: now,
      });

      return {
        userId: existingUser._id,
        isNewUser: false,
      };
    }

    // Create new user (without companyId/role - these go in junction table)
    const userId = await ctx.db.insert("users", {
      whopUserId: args.whopUserId,
      whopUsername: args.whopUsername,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      roleLastChecked: now,

      // Default preferences
      timezone: args.timezone || "America/New_York",
      theme: "system",
      notificationsEnabled: true,

      // Activity tracking
      lastActiveAt: now,
      lastLoginAt: now,

      // Metadata
      createdAt: now,
      updatedAt: now,
    });

    return {
      userId,
      isNewUser: true,
    };
  },
});

// updateUserRole removed - roles are now managed in user_companies junction table

/**
 * Upgrade pending user to real user
 *
 * Called when a pending user (invited before login) logs in for the first time.
 * Updates their whopUserId from "pending_*" to real Whop ID and syncs profile data.
 */
export const upgradePendingUser = mutation({
  args: {
    userId: v.id("users"),
    whopUserId: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.userId, {
      whopUserId: args.whopUserId,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl,
      roleLastChecked: now,
      lastLoginAt: now,
      lastActiveAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Check if user's role needs refreshing
 *
 * Returns true if the role was last checked more than 15 minutes ago.
 */
export const shouldRefreshRole = query({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { userId, companyId }) => {
    const user = await ctx.db.get(userId);

    if (!user) {
      return { shouldRefresh: false };
    }

    // Get user's role in this specific company
    const userRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId, companyId }
    );

    // Don't refresh customers (their role rarely changes)
    if (userRole === "customer") {
      return { shouldRefresh: false };
    }

    // Refresh if last checked > 15 minutes ago
    const fifteenMinutes = 15 * 60 * 1000;
    const isStale = Date.now() - user.roleLastChecked > fifteenMinutes;

    return {
      shouldRefresh: isStale,
      whopUserId: user.whopUserId,
    };
  },
});

/**
 * Get user by Whop user ID
 */
export const getUserByWhopId = query({
  args: {
    whopUserId: v.string(),
  },
  handler: async (ctx, { whopUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", whopUserId))
      .first();

    return user;
  },
});

/**
 * Get current user (by ID)
 */
export const getCurrentUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user;
  },
});

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
  },
});

/**
 * Get all team members for a company
 */
export const getTeamMembers = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<any[]> => {
    // Use the helper function that works with junction table
    return await ctx.runQuery(
      api.users.multi_company_helpers.getTeamMembersForCompany,
      { companyId }
    );
  },
});

/**
 * Promote a support user to admin
 *
 * Only existing admins can promote support users to admin.
 * This gives us control over who gets admin access in our app.
 */
export const promoteUserToAdmin = mutation({
  args: {
    targetUserId: v.id("users"),
    promotedByUserId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { targetUserId, promotedByUserId, companyId }) => {
    // Verify the person doing the promotion is an admin in this company
    const promoterRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId: promotedByUserId, companyId }
    );

    if (promoterRole !== "admin") {
      throw new Error("Only admins can promote users to admin");
    }

    // Get the target user's current role in this company
    const targetUserRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId: targetUserId, companyId }
    );

    if (!targetUserRole) {
      throw new Error("Target user not found in this company");
    }

    // Only support users can be promoted (not customers)
    if (targetUserRole !== "support") {
      throw new Error("Only support users can be promoted to admin");
    }

    // Promote the user using the junction table
    await ctx.runMutation(
      api.users.multi_company_helpers.updateUserRoleInCompany,
      {
        userId: targetUserId,
        companyId,
        newRole: "admin",
      }
    );

    return { success: true, message: "User promoted to admin successfully" };
  },
});
