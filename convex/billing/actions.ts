"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { getWhopInstance, getWhopSdk } from "../lib/whop";
import { WhopServerSdk } from "@whop/api";

/**
 * BILLING ACTIONS
 * External API calls for billing operations
 */

/**
 * Create Whop checkout session for plan upgrade
 *
 * Only admins can create checkout sessions.
 * Creates checkout session with metadata containing companyId for webhook processing.
 */
export const createCheckoutSession = action({
  args: {
    companyId: v.id("companies"),
    targetPlanName: v.union(v.literal("pro"), v.literal("elite")),
    whopUserId: v.string(), // Passed from frontend
    experienceId: v.string(), // Passed from frontend
    allowDowngrade: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { companyId, targetPlanName, whopUserId, experienceId, allowDowngrade }
  ): Promise<{
    success: boolean;
    planId: string;
    targetPlanName: string;
    planPrice: number;
    planTitle: string;
    checkoutSessionId?: string;
  }> => {
    // 1. Get user by Whop ID and verify they're admin
    const user = await ctx.runQuery(api.users.queries.getUserByWhopUserId, {
      whopUserId,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify admin role within the specific company via junction table
    const roleInCompany = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId: user._id, companyId }
    );

    if (roleInCompany !== "admin") {
      throw new Error("Only admins can create checkout sessions");
    }

    // 2. Get company and verify user has access
    const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
      companyId,
    });

    if (!company) {
      throw new Error("Company not found");
    }

    // 3. Get target plan
    const targetPlan = await ctx.runQuery(api.plans.queries.getPlanByName, {
      name: targetPlanName,
    });

    if (!targetPlan || !targetPlan.whopPlanId) {
      throw new Error(
        `Target plan ${targetPlanName} not found or not available for purchase`
      );
    }

    // 4. Check if already on this plan or higher
    const currentPlan = await ctx.runQuery(api.plans.queries.getPlanById, {
      planId: company.planId,
    });

    if (!currentPlan) {
      throw new Error("Current plan not found");
    }

    // Prevent downgrades and same-plan purchases (unless explicitly allowed)
    const planHierarchy: Record<string, number> = { free: 0, pro: 1, elite: 2 };
    if (
      !allowDowngrade &&
      planHierarchy[targetPlanName] <= planHierarchy[currentPlan.name]
    ) {
      throw new Error(
        `Cannot upgrade to ${targetPlanName} plan (already on ${currentPlan.name} or higher)`
      );
    }

    // 5. Create checkout session with metadata
    const apiKey = process.env.WHOP_API_KEY;
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
    if (!apiKey) {
      throw new Error("Missing WHOP_API_KEY environment variable");
    }
    if (!appId) {
      throw new Error("Missing NEXT_PUBLIC_WHOP_APP_ID environment variable");
    }
    const whopApi = WhopServerSdk({
      appApiKey: apiKey,
      appId: appId,
      apiOrigin: "https://api.whop.com",
    });
    const traceId = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const checkoutSession = await whopApi.payments.createCheckoutSession({
        planId: targetPlan.whopPlanId,
        metadata: {
          experienceId: experienceId,
          companyId: companyId,
          planId: targetPlan.whopPlanId,
          targetPlanName: targetPlanName,
          traceId: traceId,
        },
      });

      if (!checkoutSession) {
        throw new Error("Failed to create checkout session");
      }

      console.log(
        `✅ Plan upgrade validated for ${company.name}: ${currentPlan.name} → ${targetPlanName}`
      );
      console.log(`  Plan ID: ${targetPlan.whopPlanId}`);
      console.log(`  Checkout Session ID: ${checkoutSession.id}`);

      return {
        success: true,
        planId: targetPlan.whopPlanId,
        targetPlanName,
        planPrice: targetPlan.price,
        planTitle: `${targetPlanName.charAt(0).toUpperCase() + targetPlanName.slice(1)} Plan`,
        checkoutSessionId: checkoutSession.id,
      };
    } catch (error) {
      console.error("❌ Failed to create checkout session:", error);
      throw new Error(
        `Failed to create checkout session: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Cancel Whop membership for plan downgrade
 *
 * Only admins can cancel memberships.
 * Cancellation takes effect at the end of the current billing period.
 */
export const cancelMembership = action({
  args: {
    companyId: v.id("companies"),
    whopUserId: v.string(),
  },
  handler: async (
    ctx,
    { companyId, whopUserId }
  ): Promise<{
    success: boolean;
    message: string;
  }> => {
    // 1. Get user and verify they're admin
    const user = await ctx.runQuery(api.users.queries.getUserByWhopUserId, {
      whopUserId,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Verify admin role within the specific company via junction table
    const roleInCompany = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      { userId: user._id, companyId }
    );

    if (roleInCompany !== "admin") {
      throw new Error("Only admins can cancel memberships");
    }

    // 2. Get company
    const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
      companyId,
    });

    if (!company || !company.whopMembershipId) {
      return {
        success: true,
        message: "Membership already cancelled",
      };
    }

    // 3. Call Whop API to cancel membership
    const whopSdk = getWhopInstance();

    try {
      // Cancel membership via Whop SDK
      // Returns membership object with cancel_at_period_end: true
      const cancelledMembership = await whopSdk.memberships.cancel(
        company.whopMembershipId,
        {
          cancellation_mode: "at_period_end",
        }
      );

      console.log(`✅ Cancelled Whop membership: ${company.whopMembershipId}`);
      console.log(
        `   Cancel at period end: ${cancelledMembership.cancel_at_period_end}`
      );
      console.log(
        `   Period ends: ${new Date(cancelledMembership.renewal_period_end ?? 0).toISOString()}`
      );

      return {
        success: true,
        message:
          "Membership cancelled. You'll be downgraded to Free at the end of your billing period.",
      };
    } catch (error) {
      console.error("❌ Failed to cancel Whop membership:", error);
      throw new Error(
        `Failed to cancel membership: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
