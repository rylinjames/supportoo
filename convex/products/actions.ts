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
 * Fetch with retry and exponential backoff
 *
 * Retries on server errors (5xx) and network failures.
 * Does NOT retry on client errors (4xx) as those are permanent failures.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) - those are permanent
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx)
      if (response.status >= 500) {
        const errorText = await response.text();
        throw new Error(`Server error ${response.status}: ${errorText}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 3s, 9s
        const delay = baseDelayMs * Math.pow(3, attempt);
        console.log(
          `[fetchWithRetry] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[fetchWithRetry] All ${maxRetries} attempts failed`);
  throw lastError || new Error("Max retries exceeded");
}

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

      // CRITICAL: Verify this company's whopCompanyId is unique before syncing
      // This prevents cross-contamination if duplicate whopCompanyIds exist
      const uniquenessCheck = await ctx.runQuery(
        api.companies.queries.verifyWhopCompanyIdUnique,
        { companyId }
      );

      if (!uniquenessCheck.valid) {
        console.error(`[syncProducts] ❌ DUPLICATE whopCompanyId DETECTED!`);
        console.error(`[syncProducts] ${uniquenessCheck.error}`);
        return {
          success: false,
          syncedCount: 0,
          deletedCount: 0,
          errors: [
            `Data integrity error: ${uniquenessCheck.error}. ` +
            `Please resolve duplicate whopCompanyIds before syncing. ` +
            `Use findDuplicateWhopCompanyIds query to identify and clean up duplicates.`
          ],
        };
      }

      console.log(`[syncProducts] ✅ whopCompanyId uniqueness verified`);
      console.log(`[syncProducts] Fetching products for Whop company: ${company.whopCompanyId}`);

      // Get App API key for multi-tenant product access
      // Per Whop docs: "Use app api keys when you are building an app and need to access data on companies that have installed your app"
      // Access company-specific data by specifying company_id parameter
      const { apiKey } = getWhopConfig();
      console.log(`[syncProducts] Using App API key with v1/products endpoint`);

      // Mark all existing products as outdated before sync
      const outdatedCount = await ctx.runMutation(
        api.products.mutations.markProductsAsOutdated,
        { companyId }
      );
      console.log(`[syncProducts] Marked ${outdatedCount} existing products as outdated`);

      // Fetch products from Whop v1 API (v1 returns sellable products with headlines)
      let allProducts: any[] = [];

      try {
        console.log(`[syncProducts] ========================================`);
        console.log(`[syncProducts] 🔄 PRODUCT SYNC STARTED`);
        console.log(`[syncProducts] ----------------------------------------`);
        console.log(`[syncProducts] Company Name: ${company.name}`);
        console.log(`[syncProducts] Company ID (Convex): ${companyId}`);
        console.log(`[syncProducts] Company ID (Whop): ${company.whopCompanyId}`);
        console.log(`[syncProducts] Auth Method: APP_API_KEY with v1/products`);
        console.log(`[syncProducts] ----------------------------------------`);

        let cursor: string | null = null;
        let pageNum = 0;

        while (true) {
          // Use v1 /products endpoint with company_id — returns the company's sellable products
          // v1 includes headline field and uses the same product IDs as v1 plans
          const params = new URLSearchParams({
            company_id: company.whopCompanyId,
            first: "50",
          });
          if (cursor) params.set("after", cursor);
          const url: string = `https://api.whop.com/api/v1/products?${params.toString()}`;

          console.log(`[syncProducts] Fetching from: ${url}`);

          // Use fetchWithRetry for resilience against transient failures
          const response: Response = await fetchWithRetry(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json',
            }
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[syncProducts] API error: ${errorText}`);

            // Check if it's a permission/auth error
            if (errorText.includes('forbidden') || errorText.includes('not authorized') || errorText.includes('unauthorized') || errorText.includes('invalid') || errorText.includes('Bot API key')) {
              console.log(`[syncProducts] ⚠️ AUTH ERROR - Make sure you're using an App API Key, not a Company/Bot API Key`);

              return {
                success: false,
                syncedCount: 0,
                deletedCount: 0,
                errors: [
                  "API Key error: Make sure WHOP_API_KEY is set to your App API Key from the developer dashboard, not a Company API Key."
                ],
              };
            }

            break;
          }

          const data: any = await response.json();
          const fetchedProducts: any[] = data.data || [];

          // v1 results are already scoped to company_id — no post-filtering needed
          allProducts.push(...fetchedProducts);
          console.log(`[syncProducts] Fetched ${fetchedProducts.length} products (page ${pageNum + 1})`);

          // v1 cursor-based pagination
          const endCursor = data.page_info?.end_cursor;
          if (endCursor && fetchedProducts.length > 0) {
            cursor = endCursor;
            pageNum++;
          } else {
            break;
          }

          // Safety limit
          if (pageNum >= 20) {
            console.log(`[syncProducts] Reached page limit of 20`);
            break;
          }
        }

        console.log(`[syncProducts] ----------------------------------------`);
        console.log(`[syncProducts] Total products fetched: ${allProducts.length}`);

        if (allProducts.length > 0) {
          // Quick multi-tenancy check: v1 scopes by company_id, but verify
          const wrongCompany = allProducts.filter((p: any) => p.company_id && p.company_id !== company.whopCompanyId);
          if (wrongCompany.length > 0) {
            console.error(`[syncProducts] ❌ Found ${wrongCompany.length} products from wrong company — aborting`);
            return {
              success: false,
              syncedCount: 0,
              deletedCount: 0,
              errors: [`Multi-tenancy violation: ${wrongCompany.length} products belong to wrong company`],
            };
          }
          console.log(`[syncProducts] ✅ All products belong to ${company.whopCompanyId}`);

          // Log sample products for debugging
          allProducts.slice(0, 3).forEach((p: any, i: number) => {
            console.log(`[syncProducts]   ${i + 1}. "${p.title || p.name}" (${p.id})`);
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

      // Get company's excluded product IDs
      const excludedProductIds = company.excludedProductIds || [];
      if (excludedProductIds.length > 0) {
        console.log(`[syncProducts] Company has ${excludedProductIds.length} excluded products`);
      }

      // Process each product
      const syncedProductIds: string[] = [];
      const errors: string[] = [];
      let skippedCheckoutLinks = 0;
      let skippedArchived = 0;
      let skippedExcluded = 0;

      for (const whopProduct of allProducts) {
        if (!whopProduct) continue; // Skip null entries

        // Skip products that are in the exclusion list
        if (excludedProductIds.includes(whopProduct.id)) {
          skippedExcluded++;
          console.log(`[syncProducts] Skipped excluded product: ${whopProduct.id} (${whopProduct.title || whopProduct.name})`);
          continue;
        }

        // Skip checkout links (they have visibility: "quick_link")
        if (whopProduct.visibility === "quick_link") {
          skippedCheckoutLinks++;
          console.log(`[syncProducts] Skipped checkout link: ${whopProduct.id} (${whopProduct.title || whopProduct.name})`);
          continue;
        }

        // Skip archived products/checkout links - these are old and shouldn't be synced
        if (whopProduct.visibility === "archived") {
          skippedArchived++;
          console.log(`[syncProducts] Skipped archived item: ${whopProduct.id} (${whopProduct.title || whopProduct.name})`);
          continue;
        }

        try {
          const productId = await syncSingleProduct(ctx, companyId, company.whopCompanyId, whopProduct);
          syncedProductIds.push(whopProduct.id);
          console.log(`[syncProducts] Synced product: ${whopProduct.id} -> ${productId}`);
        } catch (error) {
          const errorMsg = `Failed to sync product ${whopProduct?.id || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`[syncProducts] ${errorMsg}`);
        }
      }

      if (skippedCheckoutLinks > 0) {
        console.log(`[syncProducts] Skipped ${skippedCheckoutLinks} checkout links`);
      }
      if (skippedArchived > 0) {
        console.log(`[syncProducts] Skipped ${skippedArchived} archived items`);
      }
      if (skippedExcluded > 0) {
        console.log(`[syncProducts] Skipped ${skippedExcluded} excluded products`);
      }

      // Clean up products that no longer exist in Whop
      const deletedCount: number = await ctx.runMutation(
        api.products.mutations.cleanupDeletedProducts,
        { companyId, syncedProductIds }
      );

      console.log(`[syncProducts] Sync complete. Synced: ${syncedProductIds.length}, Deleted: ${deletedCount}, Errors: ${errors.length}`);

      // After syncing products, also sync plans to get accurate pricing
      // Plans contain the actual pricing info (products API doesn't return prices)
      console.log(`[syncProducts] Now syncing plans for pricing data...`);
      try {
        const plansSyncResult = await ctx.runAction(
          api.whopPlans.actions.syncPlans,
          { companyId }
        );
        console.log(
          `[syncProducts] Plans sync complete: ${plansSyncResult.syncedCount} plans synced`
        );
      } catch (plansError) {
        console.error(`[syncProducts] Plans sync failed:`, plansError);
        errors.push(`Plans sync failed: ${plansError instanceof Error ? plansError.message : String(plansError)}`);
      }

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
  whopCompanyId: string,
  whopProduct: any
) {
  // STRICT VALIDATION: Product MUST have a company_id
  if (!whopProduct.company_id) {
    throw new Error(
      `Product ${whopProduct.id} is missing company_id field. ` +
      `Cannot sync product without knowing which company it belongs to.`
    );
  }

  // STRICT VALIDATION: Product MUST belong to the expected company
  if (whopProduct.company_id !== whopCompanyId) {
    throw new Error(
      `Product ${whopProduct.id} belongs to company ${whopProduct.company_id}, ` +
      `not ${whopCompanyId}. Refusing to sync to prevent cross-contamination.`
    );
  }

  // Map Whop product data to our schema
  // Note: Whop API uses "headline" for description, not "description"
  const description = whopProduct.headline || whopProduct.description || "";

  const productData = {
    companyId,
    whopProductId: whopProduct.id,
    whopCompanyId: whopProduct.company_id, // Use the verified company_id directly, no fallback
    title: whopProduct.title || whopProduct.name || "Untitled Product",
    description,

    // Price handling - Note: Whop Products API doesn't return pricing
    // Pricing comes from the Plans API which should be synced separately
    price: whopProduct.price ? Math.round(whopProduct.price) : undefined,
    currency: whopProduct.currency || "USD",

    // Map product type from Whop categories
    productType: mapWhopProductType(whopProduct.business_type || whopProduct.category || whopProduct.type),

    // Map access type from Whop subscription info
    accessType: mapWhopAccessType(whopProduct),

    // Map billing period if it's a subscription
    billingPeriod: mapWhopBillingPeriod(whopProduct),

    // Status - Whop API uses "visibility" field
    isActive: whopProduct.visibility !== "archived",
    isVisible: whopProduct.visibility === "visible",

    // Additional metadata
    category: whopProduct.category || whopProduct.business_type,
    tags: whopProduct.tags || [],
    imageUrl: whopProduct.image_url || whopProduct.image || whopProduct.thumbnail,

    // Extract features and benefits from description or dedicated fields
    features: whopProduct.features || extractFeaturesFromText(description),
    benefits: whopProduct.benefits || extractBenefitsFromText(description),
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
 * Test the Whop API connection and fetch products (with pagination)
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

      // Get App API key for multi-tenant product access
      const { apiKey } = getWhopConfig();

      console.log(`[testWhopConnection] Using App API key with v1/products`);
      console.log(`[testWhopConnection] Looking for company_id: ${company.whopCompanyId}`);

      // Fetch this company's products via v1 API
      let allCompanyProducts: any[] = [];
      let cursor: string | null = null;
      let pageNum = 0;

      while (pageNum < 10) { // Limit to 10 pages for test
        const params = new URLSearchParams({
          company_id: company.whopCompanyId,
          first: "50",
        });
        if (cursor) params.set("after", cursor);
        const url = `https://api.whop.com/api/v1/products?${params.toString()}`;

        // Use fetchWithRetry for resilience against transient failures
        const response = await fetchWithRetry(url, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          // Check for API key type error
          if (errorText.includes('Bot API key')) {
            throw new Error(`Wrong API Key type: You're using a Company/Bot API Key. Please use the App API Key from your app's developer page at https://whop.com/dashboard/developer`);
          }
          throw new Error(`API error: ${errorText}`);
        }

        const data = await response.json();
        const fetchedProducts = data.data || [];

        // v1 results are already scoped to company_id
        allCompanyProducts.push(...fetchedProducts);

        // v1 cursor-based pagination
        const endCursor = data.page_info?.end_cursor;
        if (endCursor && fetchedProducts.length > 0) {
          cursor = endCursor;
          pageNum++;
        } else {
          break;
        }
      }

      console.log(`[testWhopConnection] Total fetched for this company: ${allCompanyProducts.length}`);

      return {
        success: true,
        message: `Successfully connected to Whop. Found ${allCompanyProducts.length} products for this company.`,
        companyId: company.whopCompanyId,
        tokenType: "APP_API_KEY",
        sampleProducts: allCompanyProducts.slice(0, 10).map((p: any) => ({
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