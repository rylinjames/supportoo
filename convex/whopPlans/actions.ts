"use node";

/**
 * Whop Plans Actions
 *
 * Sync pricing plans from the company-level GraphQL API and keep only plans
 * that belong to the current non-archived product catalog.
 */

import { WhopServerSdk } from "@whop/api";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { action } from "../_generated/server";
import { getWhopConfig } from "../lib/whop";

type SyncSource =
  | "company_plans_on_behalf_of"
  | "company_plans_app"
  | "none";

type PlanFetchResult = {
  source: SyncSource;
  plans: any[];
  errors: string[];
  hadSuccessfulSource: boolean;
};

function getBaseWhopServerSdk() {
  const { apiKey, appId } = getWhopConfig();
  return WhopServerSdk({ appApiKey: apiKey, appId });
}

function getOnBehalfOfSdk(whopUserId?: string) {
  const base = getBaseWhopServerSdk();
  return whopUserId ? base.withUser(whopUserId) : base;
}

async function listCompanyPlans(
  sdk: ReturnType<typeof WhopServerSdk>,
  companyId: string
) {
  const plans: any[] = [];
  let after: string | undefined;

  while (plans.length < 500) {
    const response: any = await sdk.companies.listPlans({
      companyId,
      first: 100,
      ...(after ? { after } : {}),
    } as any);

    const nodes = response?.plans?.nodes || [];
    for (const node of nodes) {
      plans.push(node);
      if (plans.length >= 500) break;
    }

    const pageInfo = response?.plans?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo?.endCursor || nodes.length === 0) {
      break;
    }
    after = pageInfo.endCursor;
  }

  return plans;
}

async function fetchPlansForSync(
  companyId: string,
  whopUserId?: string
): Promise<PlanFetchResult> {
  const errors: string[] = [];

  if (whopUserId) {
    try {
      const plans = await listCompanyPlans(getOnBehalfOfSdk(whopUserId), companyId);
      return {
        source: "company_plans_on_behalf_of",
        plans,
        errors,
        hadSuccessfulSource: true,
      };
    } catch (error) {
      errors.push(
        `On-behalf-of company plan sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  try {
    const plans = await listCompanyPlans(getBaseWhopServerSdk(), companyId);
    return {
      source: "company_plans_app",
      plans,
      errors,
      hadSuccessfulSource: true,
    };
  } catch (error) {
    errors.push(
      `App-key company plan sync failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    source: "none",
    plans: [],
    errors,
    hadSuccessfulSource: false,
  };
}

function getPlanProductId(plan: any) {
  return (
    plan.accessPass?.id ||
    plan.product?.id ||
    plan.productId ||
    plan.product_id ||
    ""
  );
}

function getPlanTitle(plan: any) {
  return plan.title || plan.internalNotes || plan.name || "Untitled Plan";
}

function getPlanInitialPrice(plan: any) {
  const value =
    plan.rawInitialPrice ??
    plan.initial_price ??
    plan.initialPrice;
  return value !== undefined && value !== null ? Number(Number(value).toFixed(2)) : undefined;
}

function getPlanRenewalPrice(plan: any) {
  const value =
    plan.rawRenewalPrice ??
    plan.renewal_price ??
    plan.renewalPrice;
  return value !== undefined && value !== null ? Number(Number(value).toFixed(2)) : undefined;
}

function getPlanCurrency(plan: any) {
  return String(
    plan.currency || plan.baseCurrency || plan.base_currency || "usd"
  ).toLowerCase();
}

function getPlanBillingPeriod(plan: any) {
  return plan.billingPeriod ?? plan.billing_period ?? undefined;
}

function getPlanType(plan: any): "renewal" | "one_time" {
  const planType = String(plan.planType || plan.plan_type || "renewal").toLowerCase();
  return planType === "one_time" ? "one_time" : "renewal";
}

export const syncPlans = action({
  args: {
    companyId: v.id("companies"),
    whopUserId: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, whopUserId }): Promise<{
    success: boolean;
    syncedCount: number;
    deletedCount: number;
    skippedArchived: number;
    skippedUnlinked: number;
    source: SyncSource;
    errors: string[];
  }> => {
    console.log(
      `[syncPlans] Starting sync for company: ${companyId}, hasWhopUserId: ${!!whopUserId}`
    );

    try {
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (!company) {
        throw new Error("Company not found");
      }

      if (!company.whopCompanyId) {
        throw new Error("No Whop company ID found for this company");
      }

      const products = await ctx.runQuery(api.products.queries.getCompanyProducts, {
        companyId,
        includeHidden: true,
        includeInactive: true,
      });

      const activeProducts = products.filter((product: any) => product.isActive === true);
      const productMap = new Map<string, string>();
      for (const product of activeProducts) {
        productMap.set(product.whopProductId, product._id);
      }

      const fetchResult = await fetchPlansForSync(company.whopCompanyId, whopUserId);
      if (!fetchResult.hadSuccessfulSource) {
        return {
          success: false,
          syncedCount: 0,
          deletedCount: 0,
          skippedArchived: 0,
          skippedUnlinked: 0,
          source: fetchResult.source,
          errors: fetchResult.errors.length > 0 ? fetchResult.errors : ["Failed to fetch plans"],
        };
      }

      let syncedCount = 0;
      let skippedArchived = 0;
      let skippedUnlinked = 0;
      const errors = [...fetchResult.errors];
      const syncedPlanIds: string[] = [];

      for (const whopPlan of fetchResult.plans) {
        try {
          const whopProductId = getPlanProductId(whopPlan);
          if (!whopProductId || !productMap.has(whopProductId)) {
            skippedUnlinked++;
            continue;
          }

          const visibility = String(whopPlan.visibility || "visible").toLowerCase();
          if (visibility === "archived") {
            skippedArchived++;
            continue;
          }

          const productId = productMap.get(whopProductId);
          await ctx.runMutation(api.whopPlans.mutations.upsertPlan, {
            companyId,
            productId: productId as any,
            whopPlanId: whopPlan.id,
            whopProductId,
            whopCompanyId: company.whopCompanyId,
            title: getPlanTitle(whopPlan),
            description: whopPlan.description || undefined,
            initialPrice: getPlanInitialPrice(whopPlan),
            renewalPrice: getPlanRenewalPrice(whopPlan),
            currency: getPlanCurrency(whopPlan),
            billingPeriod: getPlanBillingPeriod(whopPlan),
            planType: getPlanType(whopPlan),
            trialPeriodDays: whopPlan.trialPeriodDays ?? whopPlan.trial_period_days ?? undefined,
            expirationDays: whopPlan.expirationDays ?? whopPlan.expiration_days ?? undefined,
            visibility,
            stock: whopPlan.stock ?? undefined,
            unlimitedStock: whopPlan.unlimitedStock ?? whopPlan.unlimited_stock ?? undefined,
            memberCount: whopPlan.memberCount ?? whopPlan.member_count ?? undefined,
            purchaseUrl: whopPlan.purchaseUrl ?? whopPlan.purchase_url ?? undefined,
            rawWhopData: whopPlan,
          });

          syncedPlanIds.push(whopPlan.id);
          syncedCount++;
        } catch (error) {
          errors.push(
            `Failed to sync plan ${whopPlan.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      const deletedStalePlans = await ctx.runMutation(
        api.whopPlans.mutations.deleteStalePlans,
        { companyId, activeWhopPlanIds: syncedPlanIds }
      );

      const catalogCleanup = await ctx.runMutation(
        api.whopPlans.mutations.cleanupPlansForProducts,
        {
          companyId,
          activeWhopProductIds: Array.from(productMap.keys()),
        }
      );

      return {
        success: errors.length === 0,
        syncedCount,
        deletedCount: deletedStalePlans + catalogCleanup.deletedCount,
        skippedArchived,
        skippedUnlinked,
        source: fetchResult.source,
        errors,
      };
    } catch (error) {
      const errorMsg = `Plan sync failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[syncPlans] ${errorMsg}`);
      return {
        success: false,
        syncedCount: 0,
        deletedCount: 0,
        skippedArchived: 0,
        skippedUnlinked: 0,
        source: "none",
        errors: [errorMsg],
      };
    }
  },
});
