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

      // Fetch plans from Whop API
      let allPlans: any[] = [];
      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        // Use v1 /plans endpoint with company_id filter
        // The v5/app/plans endpoint doesn't exist - use v1/plans instead
        let url = `https://api.whop.com/api/v1/plans?company_id=${company.whopCompanyId}&first=100`;
        if (cursor) {
          url += `&after=${cursor}`;
        }

        console.log(`[syncPlans] Fetching from: ${url}`);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[syncPlans] API error: ${errorText}`);

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
        // v1 API returns plans directly in data array, already filtered by company_id
        const fetchedPlans = data.data || [];

        if (fetchedPlans.length > 0) {
          allPlans.push(...fetchedPlans);
        }

        // Check for pagination (v1 API uses page_info with edges/nodes format)
        if (data.page_info?.has_next_page && data.page_info?.end_cursor) {
          cursor = data.page_info.end_cursor;
        } else {
          hasMore = false;
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

      // Use v1 /plans endpoint with company_id filter
      const response = await fetch(
        `https://api.whop.com/api/v1/plans?company_id=${company.whopCompanyId}&first=10`,
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
      // v1 API already filters by company_id
      const companyPlans = data.data || [];

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
