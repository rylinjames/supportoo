import { internalMutation } from "../_generated/server";

/**
 * USAGE AGGREGATION CRON JOBS
 * Daily aggregation of hourly usage records
 */

/**
 * Aggregate daily usage from hourly records
 *
 * Runs daily at midnight UTC to:
 * 1. Sum hourly records for each company into daily totals
 * 2. Create/update daily records in usage_records table
 * 3. Clean up old hourly records (keep only last 7 days)
 * 4. Clean up old daily records (keep only last 3 months)
 */
export const aggregateDailyUsage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);

    // Calculate period boundaries for yesterday
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setUTCHours(0, 0, 0, 0);
    const endOfYesterday = new Date(
      startOfYesterday.getTime() + 24 * 60 * 60 * 1000 - 1
    );

    console.log(
      `🔄 Starting daily usage aggregation for ${startOfYesterday.toISOString()}`
    );

    // Get all companies to process
    const companies = await ctx.db.query("companies").collect();
    console.log(`  Found ${companies.length} companies to process`);

    let processedCompanies = 0;
    let totalDailyRecords = 0;

    for (const company of companies) {
      try {
        // Get all hourly records for this company from yesterday
        const hourlyRecords = await ctx.db
          .query("usage_records")
          .withIndex("by_company_period", (q) =>
            q
              .eq("companyId", company._id)
              .eq("period", "hourly")
              .gte("periodStart", startOfYesterday.getTime())
              .lte("periodStart", endOfYesterday.getTime())
          )
          .collect();

        if (hourlyRecords.length === 0) {
          console.log(
            `  No hourly records for company ${company.name}, skipping`
          );
          continue;
        }

        // Sum up the hourly records
        const totalAiResponses = hourlyRecords.reduce(
          (sum, record) => sum + record.aiResponseCount,
          0
        );
        const totalCustomerMessages = hourlyRecords.reduce(
          (sum, record) => sum + record.customerMessageCount,
          0
        );
        const totalAgentMessages = hourlyRecords.reduce(
          (sum, record) => sum + record.agentMessageCount,
          0
        );
        const totalConversations = hourlyRecords.reduce(
          (sum, record) => sum + record.conversationCount,
          0
        );
        const totalHandoffs = hourlyRecords.reduce(
          (sum, record) => sum + record.handoffCount,
          0
        );

        // Check if daily record already exists
        const existingDaily = await ctx.db
          .query("usage_records")
          .withIndex("by_company_period", (q) =>
            q
              .eq("companyId", company._id)
              .eq("period", "daily")
              .eq("periodStart", startOfYesterday.getTime())
          )
          .first();

        if (existingDaily) {
          // Update existing daily record
          await ctx.db.patch(existingDaily._id, {
            aiResponseCount: totalAiResponses,
            customerMessageCount: totalCustomerMessages,
            agentMessageCount: totalAgentMessages,
            conversationCount: totalConversations,
            handoffCount: totalHandoffs,
            updatedAt: now,
          });
          console.log(
            `  Updated daily record for ${company.name}: ${totalAiResponses} AI responses`
          );
        } else {
          // Create new daily record
          await ctx.db.insert("usage_records", {
            companyId: company._id,
            period: "daily",
            periodStart: startOfYesterday.getTime(),
            periodEnd: endOfYesterday.getTime(),
            aiResponseCount: totalAiResponses,
            customerMessageCount: totalCustomerMessages,
            agentMessageCount: totalAgentMessages,
            conversationCount: totalConversations,
            handoffCount: totalHandoffs,
            createdAt: now,
            updatedAt: now,
          });
          console.log(
            `  Created daily record for ${company.name}: ${totalAiResponses} AI responses`
          );
        }

        // Delete processed hourly records
        for (const hourlyRecord of hourlyRecords) {
          await ctx.db.delete(hourlyRecord._id);
        }

        processedCompanies++;
        totalDailyRecords++;
      } catch (error) {
        console.error(`  ❌ Error processing company ${company.name}:`, error);
      }
    }

    // Clean up old daily records (keep only last 3 months)
    const threeMonthsAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const oldDailyRecords = await ctx.db
      .query("usage_records")
      .withIndex("by_period_start", (q) =>
        q.lt("periodStart", threeMonthsAgo.getTime())
      )
      .filter((q) => q.eq(q.field("period"), "daily"))
      .collect();

    let cleanedRecords = 0;
    for (const oldRecord of oldDailyRecords) {
      await ctx.db.delete(oldRecord._id);
      cleanedRecords++;
    }

    console.log(`✨ Daily aggregation complete:`);
    console.log(`  - Processed ${processedCompanies} companies`);
    console.log(`  - Created/updated ${totalDailyRecords} daily records`);
    console.log(`  - Cleaned up ${cleanedRecords} old daily records`);

    return {
      success: true,
      processedCompanies,
      totalDailyRecords,
      cleanedRecords,
    };
  },
});
