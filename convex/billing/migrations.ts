/**
 * Billing Migrations
 *
 * One-time scripts to fix billing/plan state.
 * Run manually via: npx convex run billing/migrations:upgradeAppOwnerCompanies
 */

import { mutation } from "../_generated/server";

/**
 * Upgrade the app owner's company (and related companies) to elite tier.
 *
 * The app owner (WHOP_COMPANY_ID) should always have the top subscription
 * since they own the app and all products. This migration:
 * 1. Finds all companies in the database
 * 2. Upgrades the app owner's company to elite
 * 3. Resets usage counters so AI responses work again
 *
 * Safe to run multiple times (idempotent).
 * Run: npx convex run billing/migrations:upgradeAppOwnerCompanies
 */
export const upgradeAppOwnerCompanies = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🔧 Starting app owner upgrade migration...");

    // Get the elite plan
    const elitePlan = await ctx.db
      .query("plans")
      .withIndex("by_name", (q) => q.eq("name", "elite"))
      .first();

    if (!elitePlan) {
      throw new Error("Elite plan not found. Run seed script first.");
    }

    // App owner company ID (from WHOP_COMPANY_ID env var)
    const appOwnerCompanyId = "biz_2T7tC1fnFVo6d4";

    // Find app owner's company
    const appOwnerCompany = await ctx.db
      .query("companies")
      .withIndex("by_whop_company_id", (q) =>
        q.eq("whopCompanyId", appOwnerCompanyId)
      )
      .first();

    const results: Array<{ name: string; companyId: string; updated: boolean }> = [];

    if (appOwnerCompany) {
      const now = Date.now();
      const alreadyElite = appOwnerCompany.planId === elitePlan._id;

      if (!alreadyElite) {
        await ctx.db.patch(appOwnerCompany._id, {
          planId: elitePlan._id,
          billingStatus: "active",
          aiResponsesThisMonth: 0,
          aiResponsesResetAt: now + 30 * 24 * 60 * 60 * 1000,
          usageWarningSent: false,
          currentPeriodStart: now,
          currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
          updatedAt: now,
        });
        console.log(`✅ Upgraded "${appOwnerCompany.name}" to elite`);
      } else {
        // Still reset usage even if already on elite
        await ctx.db.patch(appOwnerCompany._id, {
          aiResponsesThisMonth: 0,
          aiResponsesResetAt: now + 30 * 24 * 60 * 60 * 1000,
          usageWarningSent: false,
          updatedAt: now,
        });
        console.log(`ℹ️ "${appOwnerCompany.name}" already on elite, reset usage`);
      }

      results.push({
        name: appOwnerCompany.name,
        companyId: appOwnerCompany._id,
        updated: !alreadyElite,
      });
    } else {
      console.log(`⚠️ App owner company (${appOwnerCompanyId}) not found`);
    }

    console.log(`✨ Migration complete. Updated ${results.filter((r) => r.updated).length} companies.`);

    return {
      success: true,
      elitePlanId: elitePlan._id,
      results,
    };
  },
});

/**
 * Reset usage counters for ALL companies.
 *
 * Emergency utility to unblock all companies that hit the AI response limit.
 * Resets aiResponsesThisMonth to 0 for every company.
 *
 * Run: npx convex run billing/migrations:resetAllUsage
 */
export const resetAllUsage = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🔧 Resetting usage for ALL companies...");

    const companies = await ctx.db.query("companies").collect();
    const now = Date.now();
    let count = 0;

    for (const company of companies) {
      await ctx.db.patch(company._id, {
        aiResponsesThisMonth: 0,
        aiResponsesResetAt: now + 30 * 24 * 60 * 60 * 1000,
        usageWarningSent: false,
        updatedAt: now,
      });
      count++;
      console.log(`  Reset usage for "${company.name}"`);
    }

    console.log(`✨ Reset usage for ${count} companies.`);
    return { success: true, companiesReset: count };
  },
});
