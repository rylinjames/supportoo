/**
 * Products Queries
 * 
 * Queries for retrieving Whop product data
 */

import { v } from "convex/values";
import { query } from "../_generated/server";
type CatalogPlan = {
  _id: string;
  whopPlanId: string;
  title: string;
  initialPrice: number | undefined;
  renewalPrice: number | undefined;
  currency: string;
  billingPeriod: number | undefined;
  planType: "renewal" | "one_time";
  trialPeriodDays: number | undefined;
  purchaseUrl: string | undefined;
};

function getEffectivePlanPrice(plan: {
  initialPrice?: number;
  renewalPrice?: number;
  planType: "renewal" | "one_time";
}) {
  if (plan.planType === "renewal") {
    return plan.renewalPrice ?? plan.initialPrice ?? 0;
  }
  return plan.initialPrice ?? plan.renewalPrice ?? 0;
}

async function buildCompanyProductCatalog(
  ctx: any,
  companyId: string,
  includeHidden: boolean,
  includeInactive: boolean
) {
  let products = await ctx.db
    .query("products")
    .withIndex("by_company", (q: any) => q.eq("companyId", companyId))
    .collect();

  if (!includeHidden) {
    products = products.filter((product: any) => product.isVisible === true);
  }
  if (!includeInactive) {
    products = products.filter((product: any) => product.isActive === true);
  }

  const plans = await ctx.db
    .query("whopPlans")
    .withIndex("by_company", (q: any) => q.eq("companyId", companyId))
    .collect();

  const visiblePlansByProduct = plans.reduce((acc: Record<string, CatalogPlan[]>, plan: any) => {
    if (plan.visibility === "archived" || plan.isVisible !== true) {
      return acc;
    }
    const key = plan.whopProductId;
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      _id: plan._id,
      whopPlanId: plan.whopPlanId,
      title: plan.title,
      initialPrice: plan.initialPrice,
      renewalPrice: plan.renewalPrice,
      currency: plan.currency,
      billingPeriod: plan.billingPeriod,
      planType: plan.planType,
      trialPeriodDays: plan.trialPeriodDays,
      purchaseUrl: plan.purchaseUrl,
    });
    return acc;
  }, {});

  return products
    .sort((a: any, b: any) => b.updatedAt - a.updatedAt)
    .map((product: any) => ({
      ...product,
      pricingOptions: (visiblePlansByProduct[product.whopProductId] || []).sort((a: CatalogPlan, b: CatalogPlan) => {
        const priceA = getEffectivePlanPrice(a);
        const priceB = getEffectivePlanPrice(b);
        return priceA - priceB;
      }),
    }));
}

/**
 * Get all products for a company with optional visibility filters
 * By default, shows only visible and active products
 */
export const getCompanyProducts = query({
  args: {
    companyId: v.id("companies"),
    includeHidden: v.optional(v.boolean()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, { companyId, includeHidden = false, includeInactive = false }) => {
    let products = await ctx.db
      .query("products")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    if (!includeHidden) {
      products = products.filter(p => p.isVisible === true);
    }
    if (!includeInactive) {
      products = products.filter(p => p.isActive === true);
    }

    return products.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Get active products for a company (legacy - use getVisibleActiveProducts for AI context)
 */
export const getActiveProducts = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_company_active", (q) =>
        q.eq("companyId", companyId).eq("isActive", true)
      )
      .collect();

    return products.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Get visible and active products for a company (for AI context)
 * Only returns products that are visible, active, AND included in AI
 */
export const getVisibleActiveProducts = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_company_active", (q) =>
        q.eq("companyId", companyId).eq("isActive", true)
      )
      .collect();

    // Filter for visible products AND included in AI (default true if not set)
    return products
      .filter(p => p.isVisible === true && p.includeInAI !== false)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Canonical product catalog for UI rendering.
 *
 * This joins products and visible, non-archived plans in the backend so the
 * UI does not need to make its own visibility decisions.
 */
export const getCompanyProductCatalog = query({
  args: {
    companyId: v.id("companies"),
    includeHidden: v.optional(v.boolean()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, { companyId, includeHidden = false, includeInactive = false }) => {
    return await buildCompanyProductCatalog(ctx, companyId, includeHidden, includeInactive);
  },
});

/**
 * Canonical product catalog for AI context.
 *
 * Only visible, active, AI-included products are returned.
 */
export const getVisibleProductCatalogForAI = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const catalog = await buildCompanyProductCatalog(ctx, companyId, false, false);
    return catalog.filter((product: any) => product.includeInAI !== false);
  },
});

/**
 * Get a specific product by Whop product ID for a specific company
 * (Multi-tenant safe - requires companyId to prevent cross-company data leakage)
 */
export const getProductByWhopId = query({
  args: {
    companyId: v.id("companies"),
    whopProductId: v.string(),
  },
  handler: async (ctx, { companyId, whopProductId }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_company_whop_product", (q) =>
        q.eq("companyId", companyId).eq("whopProductId", whopProductId)
      )
      .first();

    return product;
  },
});

/**
 * Get products that need syncing (older than 1 hour or have errors)
 */
export const getProductsNeedingSync = query({
  args: {
    companyId: v.optional(v.id("companies")),
  },
  handler: async (ctx, { companyId }) => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour ago
    
    let productsQuery;
    
    if (companyId) {
      productsQuery = ctx.db.query("products").withIndex("by_company", (q) => 
        q.eq("companyId", companyId)
      );
    } else {
      productsQuery = ctx.db.query("products");
    }
    
    const allProducts = await productsQuery.collect();
    
    // Filter products that need syncing
    return allProducts.filter(product => 
      product.syncStatus === "error" || 
      product.syncStatus === "outdated" ||
      product.lastSyncedAt < oneHourAgo
    );
  },
});

/**
 * Get products by type for a company
 */
export const getProductsByType = query({
  args: {
    companyId: v.id("companies"),
    productType: v.union(
      v.literal("membership"),
      v.literal("digital_product"),
      v.literal("course"),
      v.literal("community"),
      v.literal("software"),
      v.literal("other")
    ),
  },
  handler: async (ctx, { companyId, productType }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_company_type", (q) => 
        q.eq("companyId", companyId).eq("productType", productType)
      )
      .collect();

    return products.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});
