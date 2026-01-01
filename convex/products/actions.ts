/**
 * Products Actions
 * 
 * Actions for syncing products from Whop API
 */

"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { getWhopSdk } from "../lib/whop";

/**
 * Sync all products from Whop for a company
 */
export const syncProducts = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<any> => {
    console.log(`[syncProducts] Starting sync for company: ${companyId}`);
    
    try {
      // Get company data to find Whop company ID
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!company.whopCompanyId) {
        throw new Error("No Whop company ID found for this company");
      }

      console.log(`[syncProducts] Fetching products for Whop company: ${company.whopCompanyId}`);

      // Get Whop SDK
      const whopSdk = getWhopSdk();

      // Mark all existing products as outdated before sync
      const outdatedCount = await ctx.runMutation(
        api.products.mutations.markProductsAsOutdated,
        { companyId }
      );
      console.log(`[syncProducts] Marked ${outdatedCount} existing products as outdated`);

      // Fetch products from Whop
      let allProducts = [];
      let hasMore = true;
      let page = 1;
      
      while (hasMore) {
        try {
          console.log(`[syncProducts] Fetching page ${page} of products...`);
          
          // Fetch products for this company
          // Note: The exact API endpoint may vary based on Whop SDK version
          // @ts-ignore - listProducts method exists on Whop SDK
          const response = await whopSdk.companies.listProducts({
            companyId: company.whopCompanyId,
            page: page,
            per: 50, // Adjust based on Whop API limits
          });

          if (response.data && response.data.length > 0) {
            allProducts.push(...response.data);
            page++;
            
            // Check if there are more pages
            hasMore = response.data.length === 50; // If we got a full page, there might be more
          } else {
            hasMore = false;
          }
        } catch (error) {
          console.error(`[syncProducts] Error fetching page ${page}:`, error);
          // If it's a 404 or "no products" error, break the loop
          if (error instanceof Error && 
              (error.message.includes('404') || 
               error.message.includes('not found') ||
               error.message.includes('no products'))) {
            hasMore = false;
            break;
          }
          throw error; // Re-throw other errors
        }
      }

      console.log(`[syncProducts] Found ${allProducts.length} products from Whop`);

      if (allProducts.length === 0) {
        console.log(`[syncProducts] No products found for company ${company.whopCompanyId}`);
        return {
          success: true,
          syncedCount: 0,
          deletedCount: 0,
          errors: [],
        };
      }

      // Process each product
      const syncedProductIds: string[] = [];
      const errors: string[] = [];

      for (const whopProduct of allProducts) {
        try {
          const productId = await syncSingleProduct(ctx, companyId, whopProduct);
          syncedProductIds.push(whopProduct.id);
          console.log(`[syncProducts] Synced product: ${whopProduct.id} -> ${productId}`);
        } catch (error) {
          const errorMsg = `Failed to sync product ${whopProduct.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[syncProducts] ${errorMsg}`);
        }
      }

      // Clean up products that no longer exist in Whop
      const deletedCount: number = await ctx.runMutation(
        api.products.mutations.cleanupDeletedProducts,
        { companyId, syncedProductIds }
      );

      console.log(`[syncProducts] Sync complete. Synced: ${syncedProductIds.length}, Deleted: ${deletedCount}, Errors: ${errors.length}`);

      return {
        success: true,
        syncedCount: syncedProductIds.length,
        deletedCount,
        errors,
      };

    } catch (error) {
      console.error(`[syncProducts] Sync failed:`, error);
      return {
        success: false,
        syncedCount: 0,
        deletedCount: 0,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  },
});

/**
 * Sync a single product from Whop data
 */
async function syncSingleProduct(
  ctx: any,
  companyId: string,
  whopProduct: any
) {
  // Map Whop product data to our schema
  const productData = {
    companyId,
    whopProductId: whopProduct.id,
    whopCompanyId: whopProduct.company_id || whopProduct.companyId,
    title: whopProduct.title || whopProduct.name || "Untitled Product",
    description: whopProduct.description,
    
    // Price handling - Whop usually provides price in cents
    price: whopProduct.price ? Math.round(whopProduct.price) : undefined,
    currency: whopProduct.currency || "USD",
    
    // Map product type from Whop categories
    productType: mapWhopProductType(whopProduct.category || whopProduct.type),
    
    // Map access type from Whop subscription info
    accessType: mapWhopAccessType(whopProduct),
    
    // Map billing period if it's a subscription
    billingPeriod: mapWhopBillingPeriod(whopProduct),
    
    // Status
    isActive: whopProduct.is_active !== false, // Default to true if not specified
    isVisible: whopProduct.is_visible !== false, // Default to true if not specified
    
    // Additional metadata
    category: whopProduct.category,
    tags: whopProduct.tags || [],
    imageUrl: whopProduct.image_url || whopProduct.image || whopProduct.thumbnail,
    
    // Extract features and benefits from description or dedicated fields
    features: whopProduct.features || extractFeaturesFromText(whopProduct.description),
    benefits: whopProduct.benefits || extractBenefitsFromText(whopProduct.description),
    targetAudience: whopProduct.target_audience || whopProduct.audience,
    
    // Store raw data for debugging
    rawWhopData: whopProduct,
  };

  // Create or update the product
  const productId = await ctx.runMutation(
    api.products.mutations.upsertProduct,
    productData
  );

  return productId;
}

/**
 * Map Whop product category/type to our product type enum
 */
function mapWhopProductType(whopType: string | undefined): "membership" | "digital_product" | "course" | "community" | "software" | "other" {
  if (!whopType) return "other";
  
  const type = whopType.toLowerCase();
  
  if (type.includes("membership") || type.includes("subscription")) {
    return "membership";
  }
  if (type.includes("course") || type.includes("training") || type.includes("education")) {
    return "course";
  }
  if (type.includes("community") || type.includes("discord") || type.includes("telegram")) {
    return "community";
  }
  if (type.includes("software") || type.includes("app") || type.includes("tool")) {
    return "software";
  }
  if (type.includes("digital") || type.includes("download") || type.includes("ebook") || type.includes("template")) {
    return "digital_product";
  }
  
  return "other";
}

/**
 * Map Whop access type from product data
 */
function mapWhopAccessType(whopProduct: any): "one_time" | "subscription" | "lifetime" {
  // Check for subscription indicators
  if (whopProduct.recurring || 
      whopProduct.subscription ||
      whopProduct.billing_period ||
      whopProduct.interval) {
    return "subscription";
  }
  
  // Check for lifetime indicators
  if (whopProduct.lifetime || 
      whopProduct.permanent ||
      (whopProduct.access_type && whopProduct.access_type.toLowerCase().includes("lifetime"))) {
    return "lifetime";
  }
  
  return "one_time";
}

/**
 * Map Whop billing period to our enum
 */
function mapWhopBillingPeriod(whopProduct: any): "monthly" | "yearly" | "weekly" | "daily" | undefined {
  const period = whopProduct.billing_period || whopProduct.interval || whopProduct.frequency;
  
  if (!period) return undefined;
  
  const periodStr = period.toLowerCase();
  
  if (periodStr.includes("month")) return "monthly";
  if (periodStr.includes("year") || periodStr.includes("annual")) return "yearly";
  if (periodStr.includes("week")) return "weekly";
  if (periodStr.includes("day")) return "daily";
  
  return undefined;
}

/**
 * Extract features from product description
 */
function extractFeaturesFromText(description: string | undefined): string[] {
  if (!description) return [];
  
  const features: string[] = [];
  
  // Look for bullet points or numbered lists
  const bulletPoints = description.match(/[•\-\*]\s*([^\n\r]+)/g);
  if (bulletPoints) {
    features.push(...bulletPoints.map(point => point.replace(/[•\-\*]\s*/, "").trim()));
  }
  
  // Look for "Features:" section
  const featuresMatch = description.match(/features?:\s*\n?(.*?)(?:\n\n|benefits?:|$)/is);
  if (featuresMatch && featuresMatch[1]) {
    const featureLines = featuresMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 10); // Limit to 10 features
    features.push(...featureLines);
  }
  
  return [...new Set(features)]; // Remove duplicates
}

/**
 * Extract benefits from product description
 */
function extractBenefitsFromText(description: string | undefined): string[] {
  if (!description) return [];
  
  const benefits: string[] = [];
  
  // Look for "Benefits:" section
  const benefitsMatch = description.match(/benefits?:\s*\n?(.*?)(?:\n\n|features?:|$)/is);
  if (benefitsMatch && benefitsMatch[1]) {
    const benefitLines = benefitsMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 10); // Limit to 10 benefits
    benefits.push(...benefitLines);
  }
  
  return [...new Set(benefits)]; // Remove duplicates
}

/**
 * Test the Whop API connection and fetch a small sample of products
 */
export const testWhopConnection = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<any> => {
    try {
      const company: any = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!company.whopCompanyId) {
        throw new Error("No Whop company ID found");
      }

      const whopSdk = getWhopSdk();

      // Try to fetch just one page of products to test connection
      // @ts-ignore - listProducts method exists on Whop SDK
      const response = await whopSdk.companies.listProducts({
        companyId: company.whopCompanyId,
        page: 1,
        per: 5,
      });

      return {
        success: true,
        message: `Successfully connected to Whop. Found ${response.data?.length || 0} products (showing first 5).`,
        sampleProducts: response.data?.map((p: any) => ({
          id: p.id,
          title: p.title || p.name,
          type: p.category || p.type,
          price: p.price,
        })) || [],
      };

    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to Whop: ${error instanceof Error ? error.message : String(error)}`,
        sampleProducts: [],
      };
    }
  },
});