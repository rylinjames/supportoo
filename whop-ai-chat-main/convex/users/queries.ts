/**
 * User Queries
 *
 * Read-only operations for fetching user data.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Get user by Whop User ID
 *
 * Used during login to check if user exists.
 */
export const getUserByWhopUserId = query({
  args: {
    whopUserId: v.string(),
  },
  handler: async (ctx, { whopUserId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", whopUserId))
      .first();
  },
});

/**
 * Get user by Whop username
 *
 * Used for pending user matching when someone logs in for the first time.
 */
export const getUserByWhopUsername = query({
  args: {
    whopUsername: v.string(),
  },
  handler: async (ctx, { whopUsername }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_whop_username", (q) => q.eq("whopUsername", whopUsername))
      .first();
  },
});

/**
 * Get user by internal ID
 */
export const getUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

/**
 * List all users in a company
 *
 * Used in admin dashboard to show team members.
 */
export const listUsersByCompany = query({
  args: {
    companyId: v.id("companies"),
    role: v.optional(
      v.union(v.literal("admin"), v.literal("support"), v.literal("customer"))
    ),
  },
  handler: async (ctx, { companyId, role }) => {
    // Get all user-company relationships for this company
    const userCompanies = await ctx.db
      .query("user_companies")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    // Filter by role if provided
    let filteredUserCompanies = userCompanies;
    if (role !== undefined) {
      filteredUserCompanies = userCompanies.filter((uc) => uc.role === role);
    }

    // Get the actual user objects
    const users = await Promise.all(
      filteredUserCompanies.map(async (uc) => {
        const user = await ctx.db.get(uc.userId);
        if (!user) return null;
        return {
          ...user,
          role: uc.role, // Override with company-specific role
        };
      })
    );

    return users.filter(Boolean);
  },
});

/**
 * List all team members (admin + support)
 *
 * Used to show who can handle conversations.
 */
export const listTeamMembersByCompany = query({
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
 * Get user with company data
 *
 * Note: This function now requires a companyId parameter since users can belong to multiple companies
 */
export const getUserWithCompany = query({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { userId, companyId }): Promise<any> => {
    const user = await ctx.db.get(userId);

    if (!user) {
      return null;
    }

    const company = await ctx.db.get(companyId);

    // Get user's role in this specific company
    const userRole: any = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId, companyId }
    );

    return {
      ...user,
      company,
      role: userRole, // Company-specific role
    };
  },
});

/**
 * Get current authenticated user with company data
 *
 * Uses Convex's built-in authentication to get the current user.
 * Note: This function now requires a companyId parameter since users can belong to multiple companies
 */
export const getCurrentUser = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();

    console.log("identity", identity);
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    const company = await ctx.db.get(companyId);

    // Get user's role in this specific company
    const userRole: any = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId: user._id, companyId }
    );

    return {
      ...user,
      company,
      role: userRole, // Company-specific role
    };
  },
});

