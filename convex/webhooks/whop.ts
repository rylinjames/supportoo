"use node";

import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";

/**
 * Whop Webhook Handlers
 *
 * Process webhook events from Whop for billing and subscription management.
 */

/**
 * Handle payment.succeeded webhook
 *
 * When a payment succeeds (new subscription or renewal):
 * 1. Look up our plan by whopPlanId
 * 2. Find company by whopMembershipId (or create if new)
 * 3. Update company plan
 * 4. Reset usage counters
 * 5. Record billing event
 */
export const handlePaymentSucceeded = action({
  args: {
    webhookData: v.any(),
  },
  handler: async (
    ctx,
    { webhookData }
  ): Promise<{ success: boolean; planName: string; reason?: string }> => {
    console.log("💳 Processing payment.succeeded webhook");

    const data = webhookData.data;

    // Extract key fields
    const {
      id: paymentId,
      membership_id: membershipId,
      user_id: userId,
      plan_id: whopPlanId,
      company_id: whopCompanyId,
      subtotal,
      final_amount: amount,
      currency,
      paid_at: paidAt,
      billing_reason: billingReason,
      metadata,
    } = data;

    console.log("  - Whop plan ID:", whopPlanId);
    console.log("  - Membership ID:", membershipId);
    console.log("  - Company ID:", whopCompanyId);
    console.log("  - Billing reason:", billingReason);
    console.log("  - Metadata:", metadata);

    // Extract companyId from metadata if available (preferred method)
    let companyId: string | null = null;
    if (metadata && typeof metadata === "object" && "companyId" in metadata) {
      companyId = metadata.companyId as string;
      console.log("  ✅ Found companyId in metadata:", companyId);
    }

    // Only process specific billing reasons
    const isRenewal = billingReason === "subscription_cycle";
    const isNewSubscription = billingReason === "subscription_create";

    if (!isRenewal && !isNewSubscription) {
      console.log(
        `  ⚠️ Unknown billing reason: ${billingReason} - Ignoring webhook`
      );
      return {
        success: false,
        planName: "unknown",
        reason: "unsupported_billing_reason",
      };
    }

    console.log(
      isRenewal
        ? "  → This is a RENEWAL (subscription_cycle)"
        : "  → This is a NEW SUBSCRIPTION (subscription_create)"
    );

    // Step 1: Find our plan by whopPlanId
    const plan = await ctx.runQuery(api.plans.queries.getPlanByWhopId, {
      whopPlanId,
    });

    if (!plan) {
      console.error("❌ No plan found for Whop plan ID:", whopPlanId);
      throw new Error(`Plan not found for whopPlanId: ${whopPlanId}`);
    }

    console.log("  ✅ Found plan:", plan.name);

    // Step 2: Find company by companyId from metadata (preferred) or fallback to whopCompanyId
    let company;
    if (companyId) {
      // Use companyId from metadata (our internal ID)
      company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId: companyId as any, // Type assertion needed for Convex ID
      });
      if (company) {
        console.log("  ✅ Found company by metadata companyId:", company.name);
      }
    }

    // Fallback to whopCompanyId if metadata companyId not found
    if (!company) {
      console.log("  ⚠️ Company not found via metadata, trying whopCompanyId");
      company = await ctx.runQuery(
        api.companies.queries.getCompanyByWhopId,
        { whopCompanyId }
      );
    }

    if (!company) {
      console.error("❌ No company found for Whop company ID:", whopCompanyId);
      if (companyId) {
        console.error("  Also tried metadata companyId:", companyId);
      }
      throw new Error(`Company not found for whopCompanyId: ${whopCompanyId}`);
    }

    console.log("  ✅ Found company:", company.name);

    // Step 3: Update company plan (and clear any scheduled downgrade)
    await ctx.runMutation(api.billing.mutations.updateCompanyPlan, {
      companyId: company._id,
      newPlanId: plan._id,
      whopMembershipId: membershipId,
      lastPaymentAt: paidAt * 1000, // Convert to milliseconds
      isRenewal, // Pass renewal flag
      clearScheduledChange: true, // Cancel pending downgrade if re-subscribing
    });

    console.log("  ✅ Updated company plan to:", plan.name);

    // Step 4: Record billing event
    await ctx.runMutation(api.billing.mutations.recordBillingEvent, {
      companyId: company._id,
      eventType: "payment_succeeded",
      whopPaymentId: paymentId,
      whopMembershipId: membershipId,
      whopUserId: userId,
      whopPlanId,
      amount:
        amount && amount > 0 ? amount : subtotal && subtotal > 0 ? subtotal : 0,
      currency,
      newPlanId: plan._id,
      rawData: data,
    });

    console.log("  ✅ Recorded billing event");
    console.log("✨ Payment processed successfully!");

    return { success: true, planName: plan.name };
  },
});

/**
 * Handle membership.went_invalid webhook
 *
 * When a subscription is cancelled:
 * 1. Find company by whopMembershipId
 * 2. Downgrade to free plan
 * 3. Record billing event
 */
export const handleMembershipCancelled = action({
  args: {
    webhookData: v.any(),
  },
  handler: async (ctx, { webhookData }): Promise<{ success: boolean }> => {
    console.log("❌ Processing membership.went_invalid webhook");

    const data = webhookData.data;

    // Extract key fields
    const {
      id: membershipId,
      user_id: userId,
      plan_id: whopPlanId,
      page_id: whopCompanyId,
    } = data;

    console.log("  - Membership ID:", membershipId);
    console.log("  - Company ID:", whopCompanyId);

    // Step 1: Find company by whopCompanyId
    const company = await ctx.runQuery(
      api.companies.queries.getCompanyByWhopId,
      { whopCompanyId }
    );

    if (!company) {
      console.error("❌ No company found for Whop company ID:", whopCompanyId);
      throw new Error(`Company not found for whopCompanyId: ${whopCompanyId}`);
    }

    console.log("  ✅ Found company:", company.name);

    // Step 2: Get free plan
    const freePlan = await ctx.runQuery(api.plans.queries.getPlanByName, {
      name: "free",
    });

    if (!freePlan) {
      throw new Error("Free plan not found");
    }

    // Step 3: Schedule downgrade to free plan (don't execute immediately!)
    await ctx.runMutation(api.billing.mutations.schedulePlanDowngrade, {
      companyId: company._id,
      scheduledPlanId: freePlan._id,
      scheduledFor: company.currentPeriodEnd, // End of their paid period
    });

    console.log(
      "  ✅ Scheduled downgrade to free plan for:",
      new Date(company.currentPeriodEnd).toISOString()
    );

    // Step 4: Record billing event
    await ctx.runMutation(api.billing.mutations.recordBillingEvent, {
      companyId: company._id,
      eventType: "subscription_cancelled",
      whopMembershipId: membershipId,
      whopUserId: userId,
      whopPlanId,
      newPlanId: freePlan._id,
      rawData: data,
    });

    console.log("  ✅ Recorded cancellation event");
    console.log("✨ Cancellation processed successfully!");

    return { success: true };
  },
});
