import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Billing Queries
 *
 * Read-only queries for billing data.
 */

/**
 * Get active subscription for a company
 * Returns null if on free plan (no active subscription)
 */
export const getActiveSubscription = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_company_active", (q) =>
        q.eq("companyId", companyId).eq("active", true)
      )
      .first();
  },
});

/**
 * Get billing history for a company
 */
export const getBillingHistory = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db
      .query("billing_events")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .order("desc")
      .take(50); // Last 50 payments
  },
});
