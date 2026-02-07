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

    // Step 1: Find internal plan via Whop plan tier mapping
    // First lookup the Whop plan to get its tier assignment
    const whopPlan = await ctx.runQuery(
      api.whopPlans.queries.getWhopPlanByWhopId,
      { whopPlanId }
    );

    let plan;
    if (whopPlan && whopPlan.planTier) {
      // Use the tier-based lookup (new method)
      plan = await ctx.runQuery(api.plans.queries.getPlanByName, {
        name: whopPlan.planTier,
      });
      console.log(`  ✅ Found plan via tier mapping: ${whopPlan.planTier}`);
    } else {
      // Fallback to legacy direct whopPlanId lookup on plans table
      plan = await ctx.runQuery(api.plans.queries.getPlanByWhopId, {
        whopPlanId,
      });
      if (plan) {
        console.log(`  ⚠️ Found plan via legacy whopPlanId lookup: ${plan.name}`);
      }
    }

    if (!plan) {
      console.error("❌ No plan found for Whop plan ID:", whopPlanId);
      console.error("  Whop plan tier:", whopPlan?.planTier || "not assigned");
      throw new Error(
        `Plan not found for whopPlanId: ${whopPlanId}. ` +
          (whopPlan
            ? `Tier "${whopPlan.planTier || "none"}" is not mapped to an internal plan.`
            : "Whop plan not found in sync data.")
      );
    }

    console.log("  ✅ Found internal plan:", plan.name);

    // Step 2: Find company by companyId from metadata (preferred) or fallback to whopCompanyId
    let company;
    if (companyId) {
      // Use companyId from metadata (our internal ID)
      try {
        company = await ctx.runQuery(api.companies.queries.getCompanyById, {
          companyId: companyId as any, // Type assertion needed for Convex ID
        });
        if (company) {
          console.log("  ✅ Found company by metadata companyId:", company.name);
        }
      } catch (e) {
        console.log("  ⚠️ Metadata companyId lookup failed:", e);
      }
    }

    // Fallback to whopCompanyId if metadata companyId not found
    if (!company && whopCompanyId) {
      console.log("  ⚠️ Company not found via metadata, trying whopCompanyId:", whopCompanyId);
      company = await ctx.runQuery(
        api.companies.queries.getCompanyByWhopId,
        { whopCompanyId }
      );
    }

    if (!company) {
      // Non-fatal: the direct activation may have already handled this
      console.error("❌ No company found for webhook. Metadata companyId:", companyId, "whopCompanyId:", whopCompanyId);
      console.error("  This is OK if the frontend already activated the plan directly.");
      return {
        success: false,
        planName: plan.name,
        reason: "company_not_found",
      };
    }

    console.log("  ✅ Found company:", company.name);

    // Step 3: Check if plan was already activated directly by the frontend
    // (idempotent - skip update if already on the correct plan)
    if (company.planId === plan._id && company.billingStatus === "active" && !isRenewal) {
      console.log("  ℹ️ Plan already activated (likely by direct activation), updating membership ID only");
      // Still update the membership ID since the webhook has it
      if (membershipId) {
        await ctx.runMutation(api.billing.mutations.updateCompanyPlan, {
          companyId: company._id,
          newPlanId: plan._id,
          whopMembershipId: membershipId,
          lastPaymentAt: paidAt ? paidAt * 1000 : Date.now(),
          isRenewal: false,
          clearScheduledChange: true,
        });
      }
    } else {
      // Step 4: Update company plan (and clear any scheduled downgrade)
      await ctx.runMutation(api.billing.mutations.updateCompanyPlan, {
        companyId: company._id,
        newPlanId: plan._id,
        whopMembershipId: membershipId,
        lastPaymentAt: paidAt ? paidAt * 1000 : Date.now(),
        isRenewal,
        clearScheduledChange: true,
      });
    }

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
 * Handle membership.went_valid webhook
 *
 * When a user gains access to a membership:
 * 1. Extract company info (page_id is company_id)
 * 2. Create company if it doesn't exist
 * 3. Store experience→company mapping for future lookups
 *
 * This is crucial for multi-tenancy - it captures the company context
 * when users first access the app through a new Whop.
 */
export const handleMembershipValid = action({
  args: {
    webhookData: v.any(),
  },
  handler: async (
    ctx,
    { webhookData }
  ): Promise<{ success: boolean; companyName?: string }> => {
    console.log("✅ Processing membership.went_valid webhook");

    const data = webhookData.data;

    // Extract key fields from membership webhook
    // page_id is the company ID in Whop's terminology
    const {
      id: membershipId,
      user_id: userId,
      product_id: productId,
      plan_id: whopPlanId,
      page_id: whopCompanyId, // This is the company ID!
    } = data;

    console.log("  - Membership ID:", membershipId);
    console.log("  - User ID:", userId);
    console.log("  - Product ID:", productId);
    console.log("  - Company ID (page_id):", whopCompanyId);

    if (!whopCompanyId) {
      console.log("  ⚠️ No company ID in webhook, cannot process");
      return { success: false };
    }

    // Check if company already exists
    let company = await ctx.runQuery(
      api.companies.queries.getCompanyByWhopId,
      { whopCompanyId }
    );

    if (company) {
      console.log("  ✅ Company already exists:", company.name);
      return { success: true, companyName: company.name };
    }

    // Company doesn't exist - need to get company name and create it
    console.log("  📝 Creating new company for:", whopCompanyId);

    // Try to get company name from Whop API
    let companyName = "My Company";
    try {
      const apiKey = process.env.WHOP_API_KEY;
      if (apiKey) {
        const companyResponse = await fetch(
          `https://api.whop.com/api/v2/businesses/${whopCompanyId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
          }
        );

        if (companyResponse.ok) {
          const companyData = await companyResponse.json();
          companyName = companyData.title || companyData.name || "My Company";
          console.log("  ✅ Got company name from API:", companyName);
        }
      }
    } catch (e) {
      console.log("  ⚠️ Failed to get company name from API:", e);
    }

    // Create the company
    const companyId = await ctx.runMutation(
      api.companies.mutations.createCompany,
      {
        whopCompanyId,
        name: companyName,
        // Note: We don't have experienceId here, it will be added when admin accesses
      }
    );

    console.log("  ✅ Created company:", companyId);
    return { success: true, companyName };
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
