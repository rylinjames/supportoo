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
        // Use v5 /app/plans endpoint
        let url = `https://api.whop.com/api/v5/app/plans?per=100`;
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
        const fetchedPlans = data.data || [];

        // Filter plans for THIS company only
        // Plans have a nested product object with company info
        const companyPlans = fetchedPlans.filter((plan: any) => {
          const planCompanyId =
            plan.company?.id ||
            plan.company_id ||
            plan.product?.company_id ||
            plan.product?.company?.id;
          return planCompanyId === company.whopCompanyId;
        });

        if (companyPlans.length > 0) {
          allPlans.push(...companyPlans);
        }

        // Check for pagination
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
          const planData = {
            companyId,
            productId: productId as any, // Can be undefined
            whopPlanId: whopPlan.id,
            whopProductId,
            whopCompanyId: company.whopCompanyId,
            title: whopPlan.title || whopPlan.name || "Untitled Plan",
            description: whopPlan.description,
            initialPrice: whopPlan.initial_price
              ? Math.round(whopPlan.initial_price)
              : undefined,
            renewalPrice: whopPlan.renewal_price
              ? Math.round(whopPlan.renewal_price)
              : undefined,
            currency: (whopPlan.currency || "usd").toLowerCase(),
            billingPeriod: whopPlan.billing_period || undefined,
            planType: (whopPlan.plan_type === "one_time"
              ? "one_time"
              : "renewal") as "renewal" | "one_time",
            trialPeriodDays: whopPlan.trial_period_days,
            expirationDays: whopPlan.expiration_days,
            visibility: whopPlan.visibility || "visible",
            stock: whopPlan.stock,
            unlimitedStock: whopPlan.unlimited_stock,
            memberCount: whopPlan.member_count,
            purchaseUrl: whopPlan.purchase_url,
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

      const response = await fetch(
        "https://api.whop.com/api/v5/app/plans?per=10",
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
          message: `API error: ${errorText}`,
          samplePlans: [],
        };
      }

      const data = await response.json();
      const allPlans = data.data || [];

      // Filter for this company's plans
      const companyPlans = allPlans.filter((plan: any) => {
        const planCompanyId =
          plan.company?.id ||
          plan.company_id ||
          plan.product?.company_id ||
          plan.product?.company?.id;
        return planCompanyId === company.whopCompanyId;
      });

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
