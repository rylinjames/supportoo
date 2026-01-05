/**
 * Products Actions
 *
 * Actions for syncing products from Whop API
 */

"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { getWhopConfig } from "../lib/whop";

/**
 * Sync all products from Whop for a company
 *
 * IMPORTANT: The userToken parameter should be passed when syncing products
 * for companies OTHER than the app owner's company. The App API key only
 * has direct access to products owned by the app owner.
 */
export const syncProducts = action({
  args: {
    companyId: v.id("companies"),
    userToken: v.optional(v.string()), // User's JWT token for API calls on their behalf
  },
  handler: async (ctx, { companyId, userToken }): Promise<any> => {
    console.log(`[syncProducts] Starting sync for company: ${companyId}, hasUserToken: ${!!userToken}`);
    
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

      // Get Whop API credentials
      const { apiKey } = getWhopConfig();

      // Determine which token to use:
      // - If userToken is provided, use it (for accessing products of companies that installed the app)
      // - Otherwise fall back to appApiKey (only works for app owner's company)
      const authToken = userToken || apiKey;
      const tokenType = userToken ? 'user_token' : 'app_api_key';
      console.log(`[syncProducts] Using ${tokenType} for API authentication`);

      // Mark all existing products as outdated before sync
      const outdatedCount = await ctx.runMutation(
        api.products.mutations.markProductsAsOutdated,
        { companyId }
      );
      console.log(`[syncProducts] Marked ${outdatedCount} existing products as outdated`);

      // Fetch products from Whop API
      let allProducts = [];

      try {
        console.log(`[syncProducts] ========================================`);
        console.log(`[syncProducts] 🔄 PRODUCT SYNC STARTED`);
        console.log(`[syncProducts] ----------------------------------------`);
        console.log(`[syncProducts] Company Name: ${company.name}`);
        console.log(`[syncProducts] Company ID (Convex): ${companyId}`);
        console.log(`[syncProducts] Company ID (Whop): ${company.whopCompanyId}`);
        console.log(`[syncProducts] Auth Method: ${tokenType.toUpperCase()}`);
        console.log(`[syncProducts] Has User Token: ${!!userToken}`);
        console.log(`[syncProducts] ----------------------------------------`);

        let page = 1;
        let hasMore = true;

        while (hasMore) {
          // Use /v5/me/products with userToken (returns user's company products)
          // Fall back to v2 API with company_id filter when no userToken
          const url = userToken
            ? `https://api.whop.com/api/v5/me/products?page=${page}&per=50`
            : `https://api.whop.com/api/v2/products?company_id=${company.whopCompanyId}&page=${page}&per_page=50`;

          console.log(`[syncProducts] Fetching from: ${url}`);

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Accept': 'application/json',
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[syncProducts] API error: ${errorText}`);

            // Check if it's a permission/auth error
            if (errorText.includes('forbidden') || errorText.includes('not authorized') || errorText.includes('unauthorized')) {
              console.log(`[syncProducts] ⚠️ AUTH ERROR - Token may be invalid or expired`);

              return {
                success: false,
                syncedCount: 0,
                deletedCount: 0,
                errors: [
                  userToken
                    ? "Authentication failed. Please refresh the page and try again."
                    : "Permission denied: This company needs to re-authorize the app."
                ],
              };
            }

            break;
          }

          const data = await response.json();

          // Handle response format
          const products = data.data || data;
          if (Array.isArray(products)) {
            allProducts.push(...products);
            console.log(`[syncProducts] Fetched ${products.length} products (page ${page})`);
          }

          // Check pagination (v5 and v2 both use similar pagination structure)
          const totalPages = data.pagination?.total_pages || data.pagination?.total_page || 1;
          if (data.pagination && page < totalPages) {
            page++;
            hasMore = true;
          } else {
            hasMore = false;
          }

          // Safety limit
          if (page > 20) {
            console.log(`[syncProducts] Reached page limit of 20`);
            break;
          }
        }
        
        console.log(`[syncProducts] ----------------------------------------`);
        console.log(`[syncProducts] Total products fetched: ${allProducts.length}`);

        // Log company IDs of fetched products to verify multi-tenancy
        if (allProducts.length > 0) {
          const companyIds = [...new Set(allProducts.map((p: any) => p.company_id || p.companyId || 'unknown'))];
          console.log(`[syncProducts] 🏢 Product Company IDs: ${companyIds.join(', ')}`);
          console.log(`[syncProducts] Expected Company ID: ${company.whopCompanyId}`);

          const allMatch = companyIds.every(id => id === company.whopCompanyId);
          if (allMatch) {
            console.log(`[syncProducts] ✅ MULTI-TENANCY CHECK PASSED - All products belong to correct company`);
          } else {
            console.log(`[syncProducts] ⚠️ MULTI-TENANCY WARNING - Some products may belong to different companies`);
            console.log(`[syncProducts] This is expected when using app_api_key without user_token`);
          }

          // Log first 3 products for debugging
          console.log(`[syncProducts] Sample products:`);
          allProducts.slice(0, 3).forEach((p: any, i: number) => {
            console.log(`[syncProducts]   ${i + 1}. "${p.title || p.name}" (company: ${p.company_id || p.companyId})`);
          });
        }
        console.log(`[syncProducts] ========================================`);
        
      } catch (error) {
        console.error(`[syncProducts] Error fetching products:`, error);
        
        // Don't throw on empty response - this is expected if no products exist
        if (error instanceof Error && 
            (error.message.includes('404') || 
             error.message.includes('not found') ||
             error.message.includes('no products'))) {
          console.log(`[syncProducts] No products found`);
        } else {
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
        if (!whopProduct) continue; // Skip null entries
        
        try {
          const productId = await syncSingleProduct(ctx, companyId, whopProduct);
          syncedProductIds.push(whopProduct.id);
          console.log(`[syncProducts] Synced product: ${whopProduct.id} -> ${productId}`);
        } catch (error) {
          const errorMsg = `Failed to sync product ${whopProduct?.id || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`;
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
  
  // Look for "Features:" section - using case-insensitive flag only
  const featuresMatch = description.match(/features?:\s*\n?(.*?)(?:\n\n|benefits?:|$)/i);
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
  
  // Look for "Benefits:" section - using case-insensitive flag only
  const benefitsMatch = description.match(/benefits?:\s*\n?(.*?)(?:\n\n|features?:|$)/i);
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
    userToken: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, userToken }): Promise<any> => {
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

      const { apiKey } = getWhopConfig();
      const authToken = userToken || apiKey;
      const tokenType = userToken ? 'user_token' : 'app_api_key';

      // Try to fetch products using appropriate API based on token type
      // Use /v5/me/products with user token to get products the user's company owns
      const url = userToken
        ? `https://api.whop.com/api/v5/me/products?page=1&per=5`
        : `https://api.whop.com/api/v2/products?company_id=${company.whopCompanyId}&page=1&per_page=5`;

      console.log(`[testWhopConnection] Using ${tokenType}, URL: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${errorText}`);
      }
      
      const data = await response.json();
      const products = data.data || [];

      return {
        success: true,
        message: `Successfully connected to Whop using ${tokenType}. Found ${products.length} products (total: ${data.pagination?.total_count || 0}).`,
        tokenType,
        companyId: company.whopCompanyId,
        sampleProducts: products.map((p: any) => ({
          id: p.id,
          title: p.title || p.name || "Untitled",
          type: p.product_type || p.type || "product",
          visible: p.visibility || "unknown",
          company_id: p.company_id || p.companyId || "unknown",
        })),
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

/**
 * Sync products for ALL companies (used by cron job)
 *
 * This internal action iterates through all companies and syncs their products.
 * Runs periodically to keep product data fresh.
 */
export const syncAllCompaniesProducts = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    totalCompanies: number;
    successCount: number;
    errorCount: number;
    errors: string[];
  }> => {
    console.log("[syncAllCompaniesProducts] Starting scheduled product sync...");

    try {
      // Get all companies
      const companies = await ctx.runQuery(api.companies.queries.getAllCompanies, {});

      console.log(`[syncAllCompaniesProducts] Found ${companies.length} companies to sync`);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Sync each company's products
      for (const company of companies) {
        try {
          console.log(`[syncAllCompaniesProducts] Syncing products for company: ${company._id} (${company.name})`);

          const result = await ctx.runAction(api.products.actions.syncProducts, {
            companyId: company._id,
          });

          if (result.success) {
            successCount++;
            console.log(`[syncAllCompaniesProducts] ✅ Company ${company.name}: synced ${result.syncedCount} products`);
          } else {
            errorCount++;
            const errorMsg = `Company ${company.name}: ${result.errors.join(", ")}`;
            errors.push(errorMsg);
            console.error(`[syncAllCompaniesProducts] ❌ ${errorMsg}`);
          }
        } catch (error) {
          errorCount++;
          const errorMsg = `Company ${company.name}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[syncAllCompaniesProducts] ❌ ${errorMsg}`);
        }

        // Small delay between companies to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`[syncAllCompaniesProducts] Sync complete. Success: ${successCount}, Errors: ${errorCount}`);

      return {
        totalCompanies: companies.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10), // Limit errors returned
      };
    } catch (error) {
      console.error("[syncAllCompaniesProducts] Failed:", error);
      return {
        totalCompanies: 0,
        successCount: 0,
        errorCount: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  },
});