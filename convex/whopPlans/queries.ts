/**
 * Whop Plans Queries
 *
 * Queries for retrieving Whop product pricing plans (from whopPlans table)
 * These are different from the app's subscription plans (plans table)
 */

import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Get all Whop plans for a company
 */
export const getCompanyPlans = query({
  args: {
    companyId: v.id("companies"),
    includeHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, { companyId, includeHidden = false }) => {
    let plans = await ctx.db
      .query("whopPlans")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    if (!includeHidden) {
      plans = plans.filter((p) => p.isVisible === true);
    }

    return plans.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Get plans for a specific product
 */
export const getPlansForProduct = query({
  args: {
    productId: v.id("products"),
    includeHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, { productId, includeHidden = false }) => {
    let plans = await ctx.db
      .query("whopPlans")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();

    if (!includeHidden) {
      plans = plans.filter((p) => p.isVisible === true);
    }

    // Sort by price (lowest first)
    return plans.sort((a, b) => {
      const priceA = a.initialPrice || 0;
      const priceB = b.initialPrice || 0;
      return priceA - priceB;
    });
  },
});

/**
 * Get plans by Whop product ID (for linking during sync)
 */
export const getPlansByWhopProductId = query({
  args: {
    companyId: v.id("companies"),
    whopProductId: v.string(),
    includeHidden: v.optional(v.boolean()),
  },
  handler: async (ctx, { companyId, whopProductId, includeHidden = false }) => {
    // Get all plans for this Whop product
    const allPlans = await ctx.db
      .query("whopPlans")
      .withIndex("by_whop_product", (q) => q.eq("whopProductId", whopProductId))
      .collect();

    // Filter by company for multi-tenant safety
    let plans = allPlans.filter((p) => p.companyId === companyId);

    if (!includeHidden) {
      plans = plans.filter((p) => p.isVisible === true);
    }

    // Sort by price (lowest first)
    return plans.sort((a, b) => {
      const priceA = a.initialPrice || 0;
      const priceB = b.initialPrice || 0;
      return priceA - priceB;
    });
  },
});

/**
 * Get visible plans for AI context
 * Returns plans grouped by Whop product ID for easy AI consumption
 */
export const getVisiblePlansForAI = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const plans = await ctx.db
      .query("whopPlans")
      .withIndex("by_company_visible", (q) =>
        q.eq("companyId", companyId).eq("isVisible", true)
      )
      .collect();

    // Group plans by whopProductId
    const plansByProduct: Record<
      string,
      Array<{
        title: string;
        initialPrice: number | undefined;
        renewalPrice: number | undefined;
        currency: string;
        billingPeriod: number | undefined;
        planType: "renewal" | "one_time";
        trialPeriodDays: number | undefined;
        purchaseUrl: string | undefined;
      }>
    > = {};

    for (const plan of plans) {
      if (!plansByProduct[plan.whopProductId]) {
        plansByProduct[plan.whopProductId] = [];
      }
      plansByProduct[plan.whopProductId].push({
        title: plan.title,
        initialPrice: plan.initialPrice,
        renewalPrice: plan.renewalPrice,
        currency: plan.currency,
        billingPeriod: plan.billingPeriod,
        planType: plan.planType,
        trialPeriodDays: plan.trialPeriodDays,
        purchaseUrl: plan.purchaseUrl,
      });
    }

    // Sort plans within each group by price
    for (const productId in plansByProduct) {
      plansByProduct[productId].sort((a, b) => {
        const priceA = a.initialPrice || 0;
        const priceB = b.initialPrice || 0;
        return priceA - priceB;
      });
    }

    return plansByProduct;
  },
});

/**
 * Get a single plan by Whop plan ID
 */
export const getWhopPlanById = query({
  args: {
    companyId: v.id("companies"),
    whopPlanId: v.string(),
  },
  handler: async (ctx, { companyId, whopPlanId }) => {
    return await ctx.db
      .query("whopPlans")
      .withIndex("by_company_whop_plan", (q) =>
        q.eq("companyId", companyId).eq("whopPlanId", whopPlanId)
      )
      .first();
  },
});

/**
 * Get active Whop plan for a subscription tier
 * Used by checkout flow to dynamically find the correct Whop plan
 * Returns the first active (visible) plan assigned to the given tier
 */
export const getActivePlanForTier = query({
  args: {
    companyId: v.id("companies"),
    planTier: v.union(v.literal("pro"), v.literal("elite")),
  },
  handler: async (ctx, { companyId, planTier }) => {
    // Get all plans for this company with this tier
    const plans = await ctx.db
      .query("whopPlans")
      .withIndex("by_company_tier", (q) =>
        q.eq("companyId", companyId).eq("planTier", planTier)
      )
      .collect();

    // Filter to only visible (active) plans
    const activePlans = plans.filter((p) => p.isVisible === true);

    // Return the first active plan (could be extended to prefer certain criteria)
    return activePlans[0] || null;
  },
});

/**
 * Get Whop plan by its Whop plan ID (global lookup)
 * Used by webhook handler to find plan without knowing company
 * Returns the plan with its tier assignment for internal plan lookup
 */
export const getWhopPlanByWhopId = query({
  args: {
    whopPlanId: v.string(),
  },
  handler: async (ctx, { whopPlanId }) => {
    return await ctx.db
      .query("whopPlans")
      .withIndex("by_whop_plan", (q) => q.eq("whopPlanId", whopPlanId))
      .first();
  },
});
