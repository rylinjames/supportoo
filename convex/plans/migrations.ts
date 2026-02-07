/**
 * One-time migration to set Ticketoo subscription plan IDs
 */

import { mutation } from "../_generated/server";

/**
 * Set the Whop plan IDs for all tiers
 * Run once with: npx convex run plans/migrations:setTicketooPlanIds
 */
export const setTicketooPlanIds = mutation({
  args: {},
  handler: async (ctx) => {
    // Ticketoo Free Plus -> Free tier
    const freePlan = await ctx.db
      .query("plans")
      .withIndex("by_name", (q) => q.eq("name", "free"))
      .first();

    if (freePlan) {
      await ctx.db.patch(freePlan._id, {
        whopPlanId: "plan_UlJutCwEWou43",
      });
      console.log("✅ Updated Free plan with whopPlanId: plan_UlJutCwEWou43");
    } else {
      console.log("❌ Free plan not found");
    }

    // Ticketoo Starter ($19.99/month) -> Pro tier
    const proPlan = await ctx.db
      .query("plans")
      .withIndex("by_name", (q) => q.eq("name", "pro"))
      .first();

    if (proPlan) {
      await ctx.db.patch(proPlan._id, {
        whopPlanId: "plan_QMpkRCMYdZ6Ua",
      });
      console.log("✅ Updated Pro plan with whopPlanId: plan_QMpkRCMYdZ6Ua");
    } else {
      console.log("❌ Pro plan not found");
    }

    // Ticketoo Professional ($49.99/month) -> Elite tier
    const elitePlan = await ctx.db
      .query("plans")
      .withIndex("by_name", (q) => q.eq("name", "elite"))
      .first();

    if (elitePlan) {
      await ctx.db.patch(elitePlan._id, {
        whopPlanId: "plan_XJluzijze0bkK",
      });
      console.log("✅ Updated Elite plan with whopPlanId: plan_XJluzijze0bkK");
    } else {
      console.log("❌ Elite plan not found");
    }

    return {
      success: true,
      free: freePlan ? "plan_UlJutCwEWou43" : null,
      pro: proPlan ? "plan_QMpkRCMYdZ6Ua" : null,
      elite: elitePlan ? "plan_XJluzijze0bkK" : null,
    };
  },
});

/**
 * Fix Free plan AI responses limit (was seeded as 20, should be 100)
 * Run once with: npx convex run plans/migrations:fixFreePlanResponseLimit
 */
export const fixFreePlanResponseLimit = mutation({
  args: {},
  handler: async (ctx) => {
    const freePlan = await ctx.db
      .query("plans")
      .withIndex("by_name", (q) => q.eq("name", "free"))
      .first();

    if (!freePlan) {
      console.log("❌ Free plan not found");
      return { success: false };
    }

    const oldLimit = freePlan.aiResponsesPerMonth;
    await ctx.db.patch(freePlan._id, {
      aiResponsesPerMonth: 100,
    });

    console.log(`✅ Updated Free plan aiResponsesPerMonth: ${oldLimit} → 100`);
    return { success: true, oldLimit, newLimit: 100 };
  },
});
