/**
 * User Mutations
 *
 * Operations that create or modify user data.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Create or update user from Whop
 *
 * Used during authentication to ensure user exists and is up-to-date.
 */
export const upsertUserFromWhop = mutation({
  args: {
    whopUserId: v.string(),
    whopUsername: v.string(),
    email: v.string(),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => q.eq("whopUserId", args.whopUserId))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        whopUsername: args.whopUsername,
        displayName: args.displayName,
        avatarUrl: args.avatarUrl || "",
        updatedAt: now,
      });

      // Check if user is already in the company
      const userCompany = await ctx.db
        .query("user_companies")
        .withIndex("by_user_company", (q) =>
          q.eq("userId", existingUser._id).eq("companyId", args.companyId)
        )
        .first();

      if (!userCompany) {
        // Add user to company as customer by default
        await ctx.db.insert("user_companies", {
          userId: existingUser._id,
          companyId: args.companyId,
          role: "customer",
          joinedAt: now,
          lastActiveInCompany: now,
          createdAt: now,
          updatedAt: now,
        });
      }

      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      whopUserId: args.whopUserId,
      whopUsername: args.whopUsername,
      displayName: args.displayName,
      avatarUrl: args.avatarUrl || "",
      timezone: "UTC",
      theme: "dark",
      notificationsEnabled: true,
      roleLastChecked: now,
      lastActiveAt: now,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Add user to company as customer by default
    await ctx.db.insert("user_companies", {
      userId,
      companyId: args.companyId,
      role: "customer",
      joinedAt: now,
      lastActiveInCompany: now,
      createdAt: now,
      updatedAt: now,
    });

    return userId;
  },
});

/**
 * Update user role
 *
 * Used by admins to change user permissions.
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    role: v.union(v.literal("admin"), v.literal("support"), v.literal("customer")),
  },
  handler: async (ctx, { userId, companyId, role }) => {
    // Find the user-company relationship
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!userCompany) {
      throw new Error("User is not associated with this company");
    }

    // Update the role
    await ctx.db.patch(userCompany._id, { role });

    return { success: true };
  },
});

/**
 * Add user to company
 *
 * Used when inviting users to join a company.
 */
export const addUserToCompany = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
    role: v.union(v.literal("admin"), v.literal("support"), v.literal("customer")),
  },
  handler: async (ctx, { userId, companyId, role }) => {
    const now = Date.now();

    // Check if already exists
    const existing = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (existing) {
      // Update role if different
      if (existing.role !== role) {
        await ctx.db.patch(existing._id, { role });
      }
      return existing._id;
    }

    // Create new relationship
    return await ctx.db.insert("user_companies", {
      userId,
      companyId,
      role,
      joinedAt: now,
      lastActiveInCompany: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Remove user from company
 *
 * Used when removing team members.
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
      throw new Error("User is not associated with this company");
    }

    await ctx.db.delete(userCompany._id);
    return { success: true };
  },
});

/**
 * Switch active company
 *
 * Updates the user's last active company timestamp.
 * The frontend will use this to determine the current company context.
 */
export const switchActiveCompany = mutation({
  args: {
    userId: v.id("users"),
    companyId: v.id("companies"),
  },
  handler: async (ctx, { userId, companyId }) => {
    const now = Date.now();

    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify user belongs to this company
    const userCompany = await ctx.db
      .query("user_companies")
      .withIndex("by_user_company", (q) =>
        q.eq("userId", userId).eq("companyId", companyId)
      )
      .first();

    if (!userCompany) {
      throw new Error("User is not a member of this company");
    }

    // Update lastActiveInCompany for the target company
    await ctx.db.patch(userCompany._id, {
      lastActiveInCompany: now,
      updatedAt: now,
    });

    // Also update user's lastActiveAt
    await ctx.db.patch(userId, {
      lastActiveAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      companyId,
      companyName: userCompany.companyId, // Will be resolved on frontend
    };
  },
});

/**
 * Get or create test customer
 *
 * Creates a test customer for testing the support chat from customer perspective
 */
export const getOrCreateTestCustomer = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    // Check if test customer already exists
    const existingTestCustomer = await ctx.db
      .query("users")
      .withIndex("by_whop_user_id", (q) => 
        q.eq("whopUserId", `test_customer_${companyId}`)
      )
      .first();

    if (existingTestCustomer) {
      return existingTestCustomer;
    }

    // Create test customer
    const now = Date.now();
    const testCustomerId = await ctx.db.insert("users", {
      whopUserId: `test_customer_${companyId}`,
      whopUsername: "testcustomer",
      displayName: "Test Customer",
      avatarUrl: "",
      timezone: "UTC",
      theme: "dark",
      notificationsEnabled: true,
      roleLastChecked: now,
      lastActiveAt: now,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Add customer to company
    await ctx.db.insert("user_companies", {
      userId: testCustomerId,
      companyId,
      role: "customer",
      joinedAt: now,
      lastActiveInCompany: now,
      createdAt: now,
      updatedAt: now,
    });

    const testCustomer = await ctx.db.get(testCustomerId);
    return testCustomer;
  },
});