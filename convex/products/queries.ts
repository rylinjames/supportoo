/**
 * Products Queries
 * 
 * Queries for retrieving Whop product data
 */

import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * Get all products for a company
 */
export const getCompanyProducts = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    return products.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Get active products for a company (for AI context)
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
 * Get a specific product by Whop product ID
 */
export const getProductByWhopId = query({
  args: {
    whopProductId: v.string(),
  },
  handler: async (ctx, { whopProductId }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_whop_product_id", (q) => q.eq("whopProductId", whopProductId))
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