import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Plan Queries
 *
 * Query subscription plans and their features.
 */

/**
 * Get plan by Whop plan ID
 */
export const getPlanByWhopId = query({
  args: {
    whopPlanId: v.string(),
  },
  handler: async (ctx, { whopPlanId }) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_whop_plan_id", (q) => q.eq("whopPlanId", whopPlanId))
      .first();

    return plan;
  },
});

/**
 * Get plan by name
 */
export const getPlanByName = query({
  args: {
    name: v.union(v.literal("free"), v.literal("pro"), v.literal("elite")),
  },
  handler: async (ctx, { name }) => {
    const plan = await ctx.db
      .query("plans")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();

    return plan;
  },
});

/**
 * List all plans
 */
export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    return plans;
  },
});

/**
 * Get plan by ID
 */
export const getPlanById = query({
  args: {
    planId: v.id("plans"),
  },
  handler: async (ctx, { planId }) => {
    return await ctx.db.get(planId);
  },
});

/**
 * Get all plans
 */
export const getAllPlans = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("plans").collect();
  },
});
