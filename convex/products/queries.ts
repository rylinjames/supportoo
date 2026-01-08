/**
 * Products Queries
 * 
 * Queries for retrieving Whop product data
 */

import { v } from "convex/values";
import { query } from "../_generated/server";

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
 * Only returns products that are both visible AND active
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

    // Filter for visible products (no compound index, so filter in-memory)
    return products
      .filter(p => p.isVisible === true)
      .sort((a, b) => b.updatedAt - a.updatedAt);
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