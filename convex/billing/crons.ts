import { internalMutation } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * Billing Cron Jobs
 *
 * Scheduled tasks for processing billing-related operations.
 */

/**
 * Process scheduled plan changes
 *
 * Finds all companies with scheduled plan changes that are due,
 * and executes the change (e.g., downgrade to free after cancellation).
 *
 * Runs every hour.
 */
export const processScheduledPlanChanges = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    console.log("⏰ Processing scheduled plan changes...");

    // Find companies with scheduled changes that are due
    const companies = await ctx.db
      .query("companies")
      .filter((q) =>
        q.and(
          q.neq(q.field("scheduledPlanChangeAt"), undefined),
          q.lte(q.field("scheduledPlanChangeAt"), now)
        )
      )
      .collect();

    console.log(
      `  Found ${companies.length} scheduled plan changes to process`
    );

    let processed = 0;
    let failed = 0;

    for (const company of companies) {
      try {
        console.log(`  Processing ${company.name}...`);

        // Execute the scheduled plan change
        await ctx.runMutation(
          api.billing.mutations.executeScheduledPlanChange,
          {
            companyId: company._id,
          }
        );

        processed++;
        console.log(`    ✅ Executed plan change for ${company.name}`);
      } catch (error) {
        failed++;
        console.error(
          `    ❌ Failed to execute plan change for ${company.name}:`,
          error
        );
      }
    }

    console.log(`✨ Processed ${processed} plan changes, ${failed} failed`);

    return {
      total: companies.length,
      processed,
      failed,
    };
  },
});
