import { v } from "convex/values";
import { mutation } from "../_generated/server";

/**
 * Billing Mutations
 *
 * Internal mutations for managing billing state.
 * Called by webhook handler actions.
 */

/**
 * Update company plan after successful payment
 */
export const updateCompanyPlan = mutation({
  args: {
    companyId: v.id("companies"),
    newPlanId: v.id("plans"),
    whopMembershipId: v.string(),
    lastPaymentAt: v.number(),
    isRenewal: v.optional(v.boolean()), // True if subscription_cycle, false if subscription_create
    clearScheduledChange: v.optional(v.boolean()), // Cancel any pending downgrade
  },
  handler: async (
    ctx,
    {
      companyId,
      newPlanId,
      whopMembershipId,
      lastPaymentAt,
      isRenewal,
      clearScheduledChange,
    }
  ) => {
    const now = Date.now();

    // Get the new plan
    const newPlan = await ctx.db.get(newPlanId);
    if (!newPlan) {
      throw new Error("Plan not found");
    }

    // Calculate billing period (monthly)
    const periodStart = now;
    const periodEnd = now + 30 * 24 * 60 * 60 * 1000; // 30 days from now

    // Log what type of payment this is
    if (isRenewal) {
      console.log("  → Renewal: Resetting usage counters");
    } else {
      console.log("  → New subscription: Resetting usage counters");
    }

    // Update company
    // BOTH renewals and new subscriptions reset usage counters
    await ctx.db.patch(companyId, {
      planId: newPlanId,
      billingStatus: "active",
      whopMembershipId,
      lastPaymentAt,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,

      // Always reset usage (renewal OR new subscription)
      aiResponsesThisMonth: 0,
      aiResponsesResetAt: periodEnd,
      usageWarningSent: false, // Reset warning flag for new billing cycle

      // Cancel any scheduled plan change (if re-subscribing after cancel)
      ...(clearScheduledChange && {
        scheduledPlanChangeAt: undefined,
        scheduledPlanId: undefined,
      }),
    });

    return { success: true };
  },
});

/**
 * Schedule plan downgrade (when subscription cancelled)
 *
 * DON'T downgrade immediately - let them keep access until period ends
 */
export const schedulePlanDowngrade = mutation({
  args: {
    companyId: v.id("companies"),
    scheduledPlanId: v.id("plans"), // Usually free plan
    scheduledFor: v.number(), // currentPeriodEnd
  },
  handler: async (ctx, { companyId, scheduledPlanId, scheduledFor }) => {
    // Schedule the downgrade, don't execute it yet
    await ctx.db.patch(companyId, {
      billingStatus: "canceled", // Mark as canceled but still active
      scheduledPlanChangeAt: scheduledFor,
      scheduledPlanId,
      whopMembershipId: undefined, // Clear membership ID
    });

    return { success: true };
  },
});

/**
 * Execute scheduled plan change (called by cron)
 */
export const executeScheduledPlanChange = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company || !company.scheduledPlanId) {
      return { success: false, reason: "no_scheduled_change" };
    }

    const now = Date.now();

    // Execute the scheduled plan change
    await ctx.db.patch(companyId, {
      planId: company.scheduledPlanId,
      billingStatus: "active", // Back to active (on new plan)
      scheduledPlanChangeAt: undefined,
      scheduledPlanId: undefined,
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,

      // Reset usage counters
      aiResponsesThisMonth: 0,
      aiResponsesResetAt: now + 30 * 24 * 60 * 60 * 1000,
      usageWarningSent: false, // Reset warning flag for new billing cycle
    });

    return { success: true };
  },
});

/**
 * Record billing event for history
 */
export const recordBillingEvent = mutation({
  args: {
    companyId: v.id("companies"),
    eventType: v.union(
      v.literal("payment_succeeded"),
      v.literal("subscription_cancelled")
    ),
    whopPaymentId: v.optional(v.string()),
    whopMembershipId: v.string(),
    whopUserId: v.string(),
    whopPlanId: v.string(),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    newPlanId: v.id("plans"),
    rawData: v.optional(v.any()),
  },
  handler: async (
    ctx,
    {
      companyId,
      eventType,
      whopPaymentId,
      whopMembershipId,
      whopUserId,
      whopPlanId,
      amount,
      currency,
      newPlanId,
      rawData,
    }
  ) => {
    const eventId = await ctx.db.insert("billing_events", {
      companyId,
      eventType,
      whopPaymentId,
      whopMembershipId,
      whopUserId,
      whopPlanId,
      amount,
      currency,
      newPlanId,
      rawData,
      createdAt: Date.now(),
    });

    return eventId;
  },
});
