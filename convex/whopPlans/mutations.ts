/**
 * Plans Mutations
 *
 * Mutations for managing Whop pricing plans
 */

import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Upsert a plan (create or update)
 */
export const upsertPlan = mutation({
  args: {
    companyId: v.id("companies"),
    productId: v.optional(v.id("products")),
    whopPlanId: v.string(),
    whopProductId: v.string(),
    whopCompanyId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    initialPrice: v.optional(v.number()),
    renewalPrice: v.optional(v.number()),
    currency: v.string(),
    billingPeriod: v.optional(v.number()),
    planType: v.union(v.literal("renewal"), v.literal("one_time")),
    trialPeriodDays: v.optional(v.number()),
    expirationDays: v.optional(v.number()),
    visibility: v.string(),
    stock: v.optional(v.number()),
    unlimitedStock: v.optional(v.boolean()),
    memberCount: v.optional(v.number()),
    purchaseUrl: v.optional(v.string()),
    rawWhopData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if plan already exists for this company
    const existingPlan = await ctx.db
      .query("whopPlans")
      .withIndex("by_company_whop_plan", (q) =>
        q.eq("companyId", args.companyId).eq("whopPlanId", args.whopPlanId)
      )
      .first();

    // Compute isVisible from visibility string
    const isVisible = args.visibility === "visible";

    if (existingPlan) {
      // Update existing plan
      await ctx.db.patch(existingPlan._id, {
        productId: args.productId,
        whopProductId: args.whopProductId,
        whopCompanyId: args.whopCompanyId,
        title: args.title,
        description: args.description,
        internalNotes: args.internalNotes,
        initialPrice: args.initialPrice,
        renewalPrice: args.renewalPrice,
        currency: args.currency,
        billingPeriod: args.billingPeriod,
        planType: args.planType,
        trialPeriodDays: args.trialPeriodDays,
        expirationDays: args.expirationDays,
        visibility: args.visibility,
        isVisible,
        stock: args.stock,
        unlimitedStock: args.unlimitedStock,
        memberCount: args.memberCount,
        purchaseUrl: args.purchaseUrl,
        rawWhopData: args.rawWhopData,
        lastSyncedAt: now,
        syncStatus: "synced" as const,
        updatedAt: now,
      });
      return existingPlan._id;
    } else {
      // Create new plan
      const planId = await ctx.db.insert("whopPlans", {
        companyId: args.companyId,
        productId: args.productId,
        whopPlanId: args.whopPlanId,
        whopProductId: args.whopProductId,
        whopCompanyId: args.whopCompanyId,
        title: args.title,
        description: args.description,
        internalNotes: args.internalNotes,
        initialPrice: args.initialPrice,
        renewalPrice: args.renewalPrice,
        currency: args.currency,
        billingPeriod: args.billingPeriod,
        planType: args.planType,
        trialPeriodDays: args.trialPeriodDays,
        expirationDays: args.expirationDays,
        visibility: args.visibility,
        isVisible,
        stock: args.stock,
        unlimitedStock: args.unlimitedStock,
        memberCount: args.memberCount,
        purchaseUrl: args.purchaseUrl,
        rawWhopData: args.rawWhopData,
        lastSyncedAt: now,
        syncStatus: "synced" as const,
        createdAt: now,
        updatedAt: now,
      });
      return planId;
    }
  },
});

/**
 * Delete plans that are no longer in Whop (cleanup after sync)
 */
export const deleteStalePlans = mutation({
  args: {
    companyId: v.id("companies"),
    activeWhopPlanIds: v.array(v.string()),
  },
  handler: async (ctx, { companyId, activeWhopPlanIds }) => {
    // Get all plans for this company
    const allPlans = await ctx.db
      .query("whopPlans")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    // Find plans that are no longer in Whop
    const stalePlans = allPlans.filter(
      (plan) => !activeWhopPlanIds.includes(plan.whopPlanId)
    );

    // Delete stale plans
    for (const plan of stalePlans) {
      await ctx.db.delete(plan._id);
    }

    return stalePlans.length;
  },
});

/**
 * Link a plan to a product (after product sync)
 */
export const linkPlanToProduct = mutation({
  args: {
    planId: v.id("whopPlans"),
    productId: v.id("products"),
  },
  handler: async (ctx, { planId, productId }) => {
    await ctx.db.patch(planId, {
      productId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Assign a subscription tier to a Whop plan
 * This links a synced Whop plan to an internal subscription tier (pro/elite)
 * Used by admin UI to configure which Whop plans map to which tiers
 */
export const assignPlanTier = mutation({
  args: {
    whopPlanId: v.id("whopPlans"),
    planTier: v.optional(v.union(v.literal("pro"), v.literal("elite"))),
  },
  handler: async (ctx, { whopPlanId, planTier }) => {
    await ctx.db.patch(whopPlanId, {
      planTier,
      updatedAt: Date.now(),
    });
  },
});
