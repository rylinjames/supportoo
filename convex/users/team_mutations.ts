/**
 * Team Management Mutations
 *
 * Mutations for team member management functionality.
 * Updated to use junction table for multi-company support.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Add team member (without verification - for backwards compatibility)
 * 
 * Note: Use addVerifiedTeamMember for the new flow with Whop verification
 */
export const addTeamMember = mutation({
  args: {
    whopUsername: v.string(),
    role: v.union(v.literal("admin"), v.literal("support")),
    companyId: v.id("companies"),
    callerWhopUserId: v.string(),
  },
  handler: async (
    ctx,
    { whopUsername, role, companyId, callerWhopUserId }
  ): Promise<{
    userId: string;
    isNew: boolean;
    isPending: boolean;
    notificationSent: boolean | null;
    notificationError: string | null;
    whopUserId?: string;
  }> => {
    // Get caller by whopUserId (no ctx.auth needed)
    const caller = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", callerWhopUserId))
      .first();

    if (!caller) throw new Error("Caller not found");

    // Check if caller is admin in their current company
    const callerRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      {
        userId: caller._id,
        companyId: companyId,
      }
    );

    if (callerRole !== "admin") {
      throw new Error("Only admins can add team members");
    }

    // Clean username
    const cleanUsername = whopUsername.replace('@', '').trim();

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_whop_username", (q) => q.eq("whopUsername", cleanUsername))
      .first();

    if (existingUser) {
      // Check if user is already in this company
      const existingRole = await ctx.runQuery(
        api.users.multi_company_helpers.getUserRoleInCompany,
        {
          userId: existingUser._id,
          companyId: companyId,
        }
      );

      if (existingRole) {
        throw new Error("User is already on your team");
      }

      // Add existing user to this company
      await ctx.runMutation(
        api.users.multi_company_helpers.createUserCompanyRelationship,
        {
          userId: existingUser._id,
          companyId: companyId,
          role,
        }
      );

      return {
        userId: existingUser._id,
        isNew: false,
        isPending: false,
        notificationSent: null,
        notificationError: null,
        whopUserId: existingUser.whopUserId,
      };
    } else {
      // Create new pending user (old flow - for backwards compatibility)
      const userId = await ctx.db.insert("users", {
        whopUsername: cleanUsername,
        whopUserId: `pending_${cleanUsername}_${Date.now()}`,
        companyId: companyId,
        role,
        displayName: cleanUsername,
        timezone: "America/New_York",
        theme: "system",
        roleLastChecked: Date.now(),
        notificationsEnabled: true,
        lastActiveAt: Date.now(),
        lastLoginAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create junction table relationship
      await ctx.runMutation(
        api.users.multi_company_helpers.createUserCompanyRelationship,
        {
          userId,
          companyId: companyId,
          role,
        }
      );

      return {
        userId,
        isNew: true,
        isPending: true,
        notificationSent: false,
        notificationError: null,
      };
    }
  },
});

/**
 * Add verified team member
 * 
 * Called after Whop verification is complete
 */
export const addVerifiedTeamMember = mutation({
  args: {
    whopUsername: v.string(),
    whopUserId: v.string(),
    displayName: v.string(),
    role: v.union(v.literal("admin"), v.literal("support")),
    companyId: v.id("companies"),
    callerWhopUserId: v.string(),
  },
  handler: async (
    ctx,
    { whopUsername, whopUserId, displayName, role, companyId, callerWhopUserId }
  ): Promise<{
    userId: string;
    isNew: boolean;
    isPending: boolean;
    notificationSent: boolean | null;
    notificationError: string | null;
    whopUserId: string;
    displayName: string;
  }> => {
    // Get caller by whopUserId
    const caller = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", callerWhopUserId))
      .first();

    if (!caller) throw new Error("Caller not found");

    // Check if caller is admin
    const callerRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      {
        userId: caller._id,
        companyId: companyId,
      }
    );

    if (callerRole !== "admin") {
      throw new Error("Only admins can add team members");
    }

    // Check if user already exists by Whop ID
    let existingUser = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", whopUserId))
      .first();

    // If not found by ID, check by username (might be pending)
    if (!existingUser) {
      existingUser = await ctx.db
        .query("users")
        .withIndex("by_whop_username", (q) => q.eq("whopUsername", whopUsername))
        .first();

      // If found as pending, update to real Whop ID
      if (existingUser && existingUser.whopUserId.startsWith("pending_")) {
        await ctx.db.patch(existingUser._id, {
          whopUserId,
          displayName,
          updatedAt: Date.now(),
        });
      }
    }

    if (existingUser) {
      // Check if already in company
      const existingRole = await ctx.runQuery(
        api.users.multi_company_helpers.getUserRoleInCompany,
        {
          userId: existingUser._id,
          companyId: companyId,
        }
      );

      if (existingRole) {
        throw new Error(`@${whopUsername} is already on your team`);
      }

      // Add to company
      await ctx.runMutation(
        api.users.multi_company_helpers.createUserCompanyRelationship,
        {
          userId: existingUser._id,
          companyId: companyId,
          role,
        }
      );

      return {
        userId: existingUser._id,
        isNew: false,
        isPending: false,
        notificationSent: null,
        notificationError: null,
        whopUserId: existingUser.whopUserId,
        displayName: existingUser.displayName,
      };
    } else {
      // Create new user - check if it's pending or verified
      const isPending = whopUserId.startsWith("pending_");
      
      const userId = await ctx.db.insert("users", {
        whopUsername,
        whopUserId,
        companyId: companyId,
        role,
        displayName,
        timezone: "America/New_York",
        theme: "system",
        roleLastChecked: Date.now(),
        notificationsEnabled: true,
        lastActiveAt: Date.now(),
        lastLoginAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create junction table relationship
      await ctx.runMutation(
        api.users.multi_company_helpers.createUserCompanyRelationship,
        {
          userId,
          companyId: companyId,
          role,
        }
      );

      return {
        userId,
        isNew: true,
        isPending, // Will be true for pending_ users
        notificationSent: null,
        notificationError: null,
        whopUserId,
        displayName,
      };
    }
  },
});

/**
 * Remove team member
 *
 * Removes a user from the team. Prevents removing the last admin.
 */
export const removeTeamMember = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    callerWhopUserId: v.string(), // NEW: receive from frontend
  },
  handler: async (ctx, { userId, companyId, callerWhopUserId }) => {
    // Get caller by whopUserId
    const caller = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", callerWhopUserId))
      .first();

    if (!caller) throw new Error("Caller not found");

    // Check if caller is admin in their current company
    const callerRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      {
        userId: caller._id,
        companyId: companyId,
      }
    );

    if (callerRole !== "admin") {
      throw new Error("Only admins can remove team members");
    }

    // Get target user's role in this company
    const targetUserRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      {
        userId,
        companyId: companyId,
      }
    );

    if (!targetUserRole) {
      throw new Error("User not found in your company");
    }

    // Count admins in this company
    const teamMembers = await ctx.db
      .query("user_companies")
      .withIndex("by_company_role", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    // Prevent removing last admin
    if (teamMembers.length === 1 && targetUserRole === "admin") {
      throw new Error("Cannot remove the last admin");
    }

    // Get the user to check if they're pending
    const targetUser = await ctx.db.get(userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    const isPending = targetUser.whopUserId.startsWith("pending_");

    // Remove user from company (junction table)
    await ctx.runMutation(
      api.users.multi_company_helpers.removeUserFromCompany,
      {
        userId,
        companyId: companyId,
      }
    );

    // If user is pending, delete them entirely from database
    if (isPending) {
      await ctx.db.delete(userId);
      return { success: true, deleted: true };
    }

    return { success: true, deleted: false };
  },
});

/**
 * Change user's role in the company
 *
 * Allows admins to promote/demote team members.
 */
export const changeUserRole = mutation({
  args: {
    userId: v.id("users"),
    newRole: v.union(v.literal("admin"), v.literal("support")),
    companyId: v.id("companies"),
    callerWhopUserId: v.string(), // NEW: receive from frontend
  },
  handler: async (ctx, { userId, newRole, companyId, callerWhopUserId }) => {
    // Get caller by whopUserId
    const caller = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", callerWhopUserId))
      .first();

    if (!caller) throw new Error("Caller not found");

    // Check if caller is admin in their current company
    const callerRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      {
        userId: caller._id,
        companyId: companyId,
      }
    );

    if (callerRole !== "admin") {
      throw new Error("Only admins can change user roles");
    }

    // Get target user's current role
    const currentRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      {
        userId,
        companyId: companyId,
      }
    );

    if (!currentRole) {
      throw new Error("User not found in your company");
    }

    // Prevent self-demotion if last admin
    if (userId === caller._id && newRole === "support") {
      const adminCount = await ctx.db
        .query("user_companies")
        .withIndex("by_company_role", (q) => q.eq("companyId", companyId))
        .filter((q) => q.eq(q.field("role"), "admin"))
        .collect();

      if (adminCount.length === 1) {
        throw new Error(
          "Cannot demote the last admin. Promote another user first."
        );
      }
    }

    // Update role in junction table
    await ctx.runMutation(
      api.users.multi_company_helpers.updateUserRoleInCompany,
      {
        userId,
        companyId: companyId,
        newRole,
      }
    );

    return { success: true };
  },
});
