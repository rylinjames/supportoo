/**
 * Whop Plans Actions
 *
 * Actions for syncing pricing plans from Whop API
 */

"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
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
 * Sync all plans from Whop for a company
 *
 * Plans contain the actual pricing information for products.
 * Each product can have multiple plans (e.g., monthly, yearly, lifetime).
 */
export const syncPlans = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }): Promise<{
    success: boolean;
    syncedCount: number;
    deletedCount: number;
    errors: string[];
  }> => {
    console.log(`[syncPlans] Starting sync for company: ${companyId}`);

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

      console.log(`[syncPlans] Fetching plans for Whop company: ${company.whopCompanyId}`);

      // Get App API key
      const { apiKey } = getWhopConfig();

      // Fetch plans from Whop API using v5 endpoint (same as products)
      let allPlans: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        // Use v5 /app/plans endpoint - returns plans from all installed companies
        const url = `https://api.whop.com/api/v5/app/plans?page=${page}&per=100`;

        console.log(`[syncPlans] Fetching from: ${url}`);

        // Use fetchWithRetry for resilience against transient failures
        const response = await fetchWithRetry(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[syncPlans] API error (${response.status}): ${errorText}`);

          if (
            errorText.includes("forbidden") ||
            errorText.includes("not authorized") ||
            errorText.includes("unauthorized")
          ) {
            return {
              success: false,
              syncedCount: 0,
              deletedCount: 0,
              errors: [
                "API Key error: Make sure WHOP_API_KEY is set to your App API Key.",
              ],
            };
          }

          break;
        }

        const data = await response.json();
        const fetchedPlans = data.data || [];

        // Filter plans for THIS company only (same pattern as products)
        const companyPlans = fetchedPlans.filter(
          (p: any) => p.company_id === company.whopCompanyId
        );

        if (companyPlans.length > 0) {
          allPlans.push(...companyPlans);
          console.log(`[syncPlans] Fetched ${fetchedPlans.length} total, ${companyPlans.length} for this company (page ${page})`);
        } else {
          console.log(`[syncPlans] Fetched ${fetchedPlans.length} total, 0 for this company (page ${page})`);
        }

        // Check pagination
        if (data.pagination?.next_page) {
          page++;
        } else {
          hasMore = false;
        }

        // Safety limit
        if (page > 20) {
          console.log(`[syncPlans] Reached page limit of 20`);
          break;
        }
      }

      console.log(
        `[syncPlans] Found ${allPlans.length} plans for company ${company.whopCompanyId}`
      );

      // Get existing products to link plans
      const products = await ctx.runQuery(
        api.products.queries.getCompanyProducts,
        { companyId, includeHidden: true, includeInactive: true }
      );

      // Create a map of whopProductId -> productId for linking
      const productMap = new Map<string, string>();
      for (const product of products) {
        productMap.set(product.whopProductId, product._id);
      }

      // Sync each plan
      let syncedCount = 0;
      const errors: string[] = [];
      const syncedPlanIds: string[] = [];

      for (const whopPlan of allPlans) {
        try {
          // Get the Whop product ID from the plan
          const whopProductId =
            whopPlan.product?.id || whopPlan.product_id || "";

          // Find our internal product ID
          const productId = productMap.get(whopProductId);

          // Map plan data to our schema
          // Note: Convert null values to undefined for Convex compatibility
          const planData = {
            companyId,
            productId: productId as any, // Can be undefined
            whopPlanId: whopPlan.id,
            whopProductId,
            whopCompanyId: company.whopCompanyId,
            title: whopPlan.title || whopPlan.name || "Untitled Plan",
            description: whopPlan.description || undefined,
            // Handle prices - keep 0 as 0 (for Free plans), only undefined if not present
            initialPrice: whopPlan.initial_price !== undefined && whopPlan.initial_price !== null
              ? Math.round(whopPlan.initial_price)
              : undefined,
            renewalPrice: whopPlan.renewal_price !== undefined && whopPlan.renewal_price !== null
              ? Math.round(whopPlan.renewal_price)
              : undefined,
            currency: (whopPlan.currency || "usd").toLowerCase(),
            billingPeriod: whopPlan.billing_period || undefined,
            planType: (whopPlan.plan_type === "one_time"
              ? "one_time"
              : "renewal") as "renewal" | "one_time",
            trialPeriodDays: whopPlan.trial_period_days || undefined,
            expirationDays: whopPlan.expiration_days || undefined,
            visibility: whopPlan.visibility || "visible",
            stock: whopPlan.stock ?? undefined,
            unlimitedStock: whopPlan.unlimited_stock ?? undefined,
            memberCount: whopPlan.member_count ?? undefined,
            purchaseUrl: whopPlan.purchase_url || undefined,
            rawWhopData: whopPlan,
          };

          await ctx.runMutation(api.whopPlans.mutations.upsertPlan, planData);
          syncedPlanIds.push(whopPlan.id);
          syncedCount++;
        } catch (err) {
          const errorMsg = `Failed to sync plan ${whopPlan.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[syncPlans] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Delete plans that are no longer in Whop
      const deletedCount = await ctx.runMutation(
        api.whopPlans.mutations.deleteStalePlans,
        { companyId, activeWhopPlanIds: syncedPlanIds }
      );

      console.log(
        `[syncPlans] Sync complete. Synced: ${syncedCount}, Deleted: ${deletedCount}, Errors: ${errors.length}`
      );

      return {
        success: errors.length === 0,
        syncedCount,
        deletedCount,
        errors,
      };
    } catch (err) {
      const errorMsg = `Plan sync failed: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[syncPlans] ${errorMsg}`);
      return {
        success: false,
        syncedCount: 0,
        deletedCount: 0,
        errors: [errorMsg],
      };
    }
  },
});

/**
 * Test connection to Whop Plans API
 */
export const testPlansConnection = action({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (
    ctx,
    { companyId }
  ): Promise<{
    success: boolean;
    message: string;
    samplePlans: any[];
  }> => {
    try {
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company || !company.whopCompanyId) {
        return {
          success: false,
          message: "Company not found or missing Whop company ID",
          samplePlans: [],
        };
      }

      const { apiKey } = getWhopConfig();

      // Use v5 /app/plans endpoint (same as products)
      const response = await fetchWithRetry(
        `https://api.whop.com/api/v5/app/plans?page=1&per=100`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `API error (${response.status}): ${errorText}`,
          samplePlans: [],
        };
      }

      const data = await response.json();
      // Filter plans for this company only
      const companyPlans = (data.data || []).filter(
        (p: any) => p.company_id === company.whopCompanyId
      );

      return {
        success: true,
        message: `Found ${companyPlans.length} plans for this company`,
        samplePlans: companyPlans.slice(0, 5).map((p: any) => ({
          id: p.id,
          title: p.title || p.name,
          price: p.initial_price,
          currency: p.currency,
          type: p.plan_type,
          visibility: p.visibility,
          productId: p.product?.id || p.product_id,
        })),
      };
    } catch (err) {
      return {
        success: false,
        message: `Connection test failed: ${err instanceof Error ? err.message : String(err)}`,
        samplePlans: [],
      };
    }
  },
});
