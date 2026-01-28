/**
 * Products Mutations
 * 
 * Mutations for creating, updating, and deleting product records
 */

import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Create or update a product from Whop data
 */
export const upsertProduct = mutation({
  args: {
    companyId: v.id("companies"),
    whopProductId: v.string(),
    whopCompanyId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    currency: v.optional(v.string()),
    productType: v.union(
      v.literal("membership"),
      v.literal("digital_product"), 
      v.literal("course"),
      v.literal("community"),
      v.literal("software"),
      v.literal("other")
    ),
    accessType: v.union(
      v.literal("one_time"),
      v.literal("subscription"),
      v.literal("lifetime")
    ),
    billingPeriod: v.optional(v.union(
      v.literal("monthly"),
      v.literal("yearly"),
      v.literal("weekly"),
      v.literal("daily")
    )),
    isActive: v.boolean(),
    isVisible: v.boolean(),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    features: v.optional(v.array(v.string())),
    benefits: v.optional(v.array(v.string())),
    targetAudience: v.optional(v.string()),
    rawWhopData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if product already exists FOR THIS COMPANY (multi-tenant isolation)
    // Using compound index to ensure each company has its own copy of products
    const existingProduct = await ctx.db
      .query("products")
      .withIndex("by_company_whop_product", (q) =>
        q.eq("companyId", args.companyId).eq("whopProductId", args.whopProductId)
      )
      .first();

    const productData = {
      companyId: args.companyId,
      whopProductId: args.whopProductId,
      whopCompanyId: args.whopCompanyId,
      title: args.title,
      description: args.description,
      price: args.price,
      currency: args.currency,
      productType: args.productType,
      accessType: args.accessType,
      billingPeriod: args.billingPeriod,
      isActive: args.isActive,
      isVisible: args.isVisible,
      category: args.category,
      tags: args.tags,
      imageUrl: args.imageUrl,
      features: args.features,
      benefits: args.benefits,
      targetAudience: args.targetAudience,
      lastSyncedAt: now,
      syncStatus: "synced" as const,
      syncError: undefined,
      rawWhopData: args.rawWhopData,
      updatedAt: now,
    };

    if (existingProduct) {
      // Update existing product
      await ctx.db.patch(existingProduct._id, productData);
      return existingProduct._id;
    } else {
      // Create new product
      const productId = await ctx.db.insert("products", {
        ...productData,
        createdAt: now,
      });
      return productId;
    }
  },
});

/**
 * Mark products as outdated for a company (before sync)
 */
export const markProductsAsOutdated = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    const updatePromises = products.map(product =>
      ctx.db.patch(product._id, {
        syncStatus: "outdated" as const,
        updatedAt: Date.now(),
      })
    );

    await Promise.all(updatePromises);
    return products.length;
  },
});

/**
 * Mark a product as having a sync error
 */
export const markProductSyncError = mutation({
  args: {
    productId: v.id("products"),
    error: v.string(),
  },
  handler: async (ctx, { productId, error }) => {
    await ctx.db.patch(productId, {
      syncStatus: "error",
      syncError: error,
      lastSyncedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete products that are no longer in Whop (cleanup after sync)
 */
export const cleanupDeletedProducts = mutation({
  args: {
    companyId: v.id("companies"),
    syncedProductIds: v.array(v.string()), // Whop product IDs that were synced
  },
  handler: async (ctx, { companyId, syncedProductIds }) => {
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    // Find products that are no longer in Whop
    const productsToDelete = allProducts.filter(product => 
      !syncedProductIds.includes(product.whopProductId)
    );

    // Delete them
    const deletePromises = productsToDelete.map(product =>
      ctx.db.delete(product._id)
    );

    await Promise.all(deletePromises);
    return productsToDelete.length;
  },
});

/**
 * Delete all products for a company
 */
export const deleteAllCompanyProducts = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    const deletePromises = products.map(product =>
      ctx.db.delete(product._id)
    );

    await Promise.all(deletePromises);
    return products.length;
  },
});

/**
 * Toggle whether a product is included in AI context
 */
export const toggleProductAIInclusion = mutation({
  args: {
    productId: v.id("products"),
    includeInAI: v.boolean(),
  },
  handler: async (ctx, { productId, includeInAI }) => {
    await ctx.db.patch(productId, {
      includeInAI,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});