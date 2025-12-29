/**
 * Multi-Company Helper Functions
 *
 * Core helper functions for managing user-company relationships.
 * These functions provide a single source of truth for role lookups,
 * company membership, and permission checks.
 */

import { query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id, Doc } from "../_generated/dataModel";
import { api } from "../_generated/api";

// Type definitions
export type UserRole = "admin" | "support" | "customer";
export type UserCompany = {
  companyId: Id<"companies">;
  role: UserRole;
  companyName: string;
  joinedAt: number;
  lastActiveInCompany: number;
};

/**
 * Get user's role in a specific company
 *
 * This is the MOST USED helper function. Use this instead of user.role
 * throughout the codebase for permission checks.
 */
export const getUserRoleInCompany = query({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { userId, companyId }) => {
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    return userCompany?.role || null;
  },
});

/**
 * Get all companies a user belongs to
 *
 * Used in frontend context to show company switcher and user's companies.
 */
export const getUserCompanies = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const userCompanies = await ctx.db
      .query("user_companies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Enrich with company names
    const enriched = await Promise.all(
      userCompanies.map(async (uc) => {
        const company = await ctx.db.get(uc.companyId);
        return {
          companyId: uc.companyId,
          role: uc.role,
          companyName: company?.name || "Unknown Company",
          joinedAt: uc.joinedAt,
          lastActiveInCompany: uc.lastActiveInCompany,
        };
      })
    );

    // Sort by last active (most recent first)
    return enriched.sort(
      (a, b) => b.lastActiveInCompany - a.lastActiveInCompany
    );
  },
});

/**
 * Check if user has required access level in a company
 *
 * Used for permission checks in mutations and actions.
 * Role hierarchy: admin > support > customer
 */
export const checkUserAccess = query({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    requiredRole: v.union(
      v.literal("admin"),
      v.literal("support"),
      v.literal("customer")
    ),
  },
  handler: async (
    ctx,
    { userId, companyId, requiredRole }
  ): Promise<boolean> => {
    const userRole: UserRole | null = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId, companyId }
    );
    if (!userRole) return false;

    // Role hierarchy check
    const roleHierarchy = { admin: 3, support: 2, customer: 1 };
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  },
});

/**
 * Get user's default company (most recently active)
 *
 * Used during login to determine which company to show by default.
 */
export const getUserDefaultCompany = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const userCompanies = await ctx.db
      .query("user_companies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    if (userCompanies.length === 0) return null;

    const mostRecent = userCompanies[0];
    const company = await ctx.db.get(mostRecent.companyId);

    return {
      companyId: mostRecent.companyId,
      role: mostRecent.role,
      companyName: company?.name || "Unknown Company",
    };
  },
});

/**
 * Update user's last active timestamp in a company
 *
 * Called when user performs actions in a specific company context.
 */
export const updateLastActiveInCompany = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { userId, companyId }) => {
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!userCompany) {
      throw new Error("User not found in company");
    }

    await ctx.db.patch(userCompany._id, {
      lastActiveInCompany: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Create user-company relationship
 *
 * Used when adding users to companies (team invites, new company joins).
 */
export const createUserCompanyRelationship = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    role: v.union(
      v.literal("admin"),
      v.literal("support"),
      v.literal("customer")
    ),
  },
  handler: async (ctx, { userId, companyId, role }) => {
    // Check if relationship already exists
    const existing = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (existing) {
      // Update existing relationship
      await ctx.db.patch(existing._id, {
        role,
        updatedAt: Date.now(),
      });
      return { relationshipId: existing._id, isNew: false };
    }

    // Create new relationship
    const now = Date.now();
    const relationshipId = await ctx.db.insert("user_companies", {
      userId,
      companyId,
      role,
      joinedAt: now,
      lastActiveInCompany: now,
      createdAt: now,
      updatedAt: now,
    });

    return { relationshipId, isNew: true };
  },
});

/**
 * Remove user from company
 *
 * Used when removing team members. Does NOT delete the user record.
 */
export const removeUserFromCompany = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { userId, companyId }) => {
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!userCompany) {
      throw new Error("User not found in company");
    }

    await ctx.db.delete(userCompany._id);
    return { success: true };
  },
});

/**
 * Update user's role in a company
 *
 * Used for role changes (promote/demote team members).
 */
export const updateUserRoleInCompany = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("support"),
      v.literal("customer")
    ),
  },
  handler: async (ctx, { userId, companyId, newRole }) => {
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!userCompany) {
      throw new Error("User not found in company");
    }

    await ctx.db.patch(userCompany._id, {
      role: newRole,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Get team members for a company (admin + support)
 *
 * Replaces the old listUsersByCompany query with junction table approach.
 */
export const getTeamMembersForCompany = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const userCompanies = await ctx.db
      .query("user_companies")
      .withIndex("by_company_role", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("role"), "support"))
      )
      .collect();

    // Enrich with user details
    const enriched = await Promise.all(
      userCompanies.map(async (uc) => {
        const user = await ctx.db.get(uc.userId);
        if (!user) return null;

        return {
          ...user,
          role: uc.role, // Role from junction table
          joinedAt: uc.joinedAt,
          lastActiveInCompany: uc.lastActiveInCompany,
        };
      })
    );

    // Filter out null users and sort by role (admins first), then by join date
    return enriched.filter(Boolean).sort((a, b) => {
      if (a!.role === "admin" && b!.role !== "admin") return -1;
      if (a!.role !== "admin" && b!.role === "admin") return 1;
      return a!.joinedAt - b!.joinedAt; // Oldest first
    });
  },
});

/**
 * Check if user is admin in any company
 *
 * Used for global admin checks (e.g., system-wide settings).
 */
export const isUserAdminAnywhere = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const adminRelationships = await ctx.db
      .query("user_companies")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .collect();

    return adminRelationships.length > 0;
  },
});
