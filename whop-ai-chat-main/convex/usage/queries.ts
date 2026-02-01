import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * USAGE QUERIES
 * Get usage data for insights and billing screens
 */

// ============================================================================
// GET CURRENT USAGE (for Usage Overview)
// ============================================================================

export const getCurrentUsage = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    // Get company data for current usage and plan info
    const company = await ctx.db.get(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    // Get plan info for limits
    const plan = await ctx.db.get(company.planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    const remainingResponses = Math.max(
      0,
      plan.aiResponsesPerMonth - company.aiResponsesThisMonth
    );
    const percentageUsed =
      plan.aiResponsesPerMonth > 0
        ? Math.round(
            (company.aiResponsesThisMonth / plan.aiResponsesPerMonth) * 1000
          ) / 10
        : 0;

    // Calculate days until reset
    const now = Date.now();
    const daysUntilReset = Math.max(
      0,
      Math.ceil((company.aiResponsesResetAt - now) / (24 * 60 * 60 * 1000))
    );

    return {
      plan: plan.name,
      totalLimit: plan.aiResponsesPerMonth,
      currentUsage: company.aiResponsesThisMonth,
      remaining: remainingResponses,
      percentageUsed,
      billingCycleStart: company.currentPeriodStart,
      billingCycleEnd: company.aiResponsesResetAt,
      daysUntilReset,
    };
  },
});

// ============================================================================
// GET USAGE TRENDS (for Charts)
// ============================================================================

export const getUsageTrends = query({
  args: {
    companyId: v.id("companies"),
    period: v.union(
      v.literal("3days"),
      v.literal("week"),
      v.literal("month"),
      v.literal("3months")
    ),
  },
  handler: async (ctx, { companyId, period }) => {
    const now = Date.now();
    let startTime: number;
    let endTime: number = now;

    // Calculate period boundaries
    switch (period) {
      case "3days":
        startTime = now - 3 * 24 * 60 * 60 * 1000; // 3 days ago
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
        break;
      case "3months":
        startTime = now - 90 * 24 * 60 * 60 * 1000; // 90 days ago
        break;
    }

    // Get daily records for the period
    const dailyRecords = await ctx.db
      .query("usage_records")
      .withIndex("by_company_period", (q) =>
        q
          .eq("companyId", companyId)
          .eq("period", "daily")
          .gte("periodStart", startTime)
          .lte("periodStart", endTime)
      )
      .order("asc")
      .collect();

    // Get ALL hourly records within the period
    const hourlyRecords = await ctx.db
      .query("usage_records")
      .withIndex("by_company_period", (q) =>
        q
          .eq("companyId", companyId)
          .eq("period", "hourly")
          .gte("periodStart", startTime)
      )
      .order("asc")
      .collect();

    let chartData: { date: string; responses: number; label: string }[] = [];

    if (period === "3days") {
      // For 3 days: Use hourly granularity
      // Group hourly records by day first
      const hourlyByDay = new Map<number, typeof hourlyRecords>();
      for (const record of hourlyRecords) {
        const dayStart = new Date(record.periodStart);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayKey = dayStart.getTime();

        if (!hourlyByDay.has(dayKey)) {
          hourlyByDay.set(dayKey, []);
        }
        hourlyByDay.get(dayKey)!.push(record);
      }

      // Check which days have daily records
      const dailyDays = new Set(dailyRecords.map((r) => r.periodStart));

      // For days with daily records, skip (already aggregated)
      // For days without, use hourly data
      for (const [dayKey, dayHourlyRecords] of hourlyByDay.entries()) {
        if (!dailyDays.has(dayKey)) {
          // Add each hourly data point
          for (const hourlyRecord of dayHourlyRecords) {
            const date = new Date(hourlyRecord.periodStart);
            const hours = date.getHours();
            const ampm = hours >= 12 ? "PM" : "AM";
            const displayHours = hours % 12 || 12;

            chartData.push({
              date: date.toISOString(), // For sorting
              responses: hourlyRecord.aiResponseCount,
              label: `${displayHours} ${ampm}`,
            });
          }
        }
      }
    } else {
      // For week, month, 3months: Use daily granularity
      // Group hourly records by day
      const hourlyByDay = new Map<number, number>();
      for (const record of hourlyRecords) {
        const dayStart = new Date(record.periodStart);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayKey = dayStart.getTime();

        hourlyByDay.set(
          dayKey,
          (hourlyByDay.get(dayKey) || 0) + record.aiResponseCount
        );
      }

      // Find which days already have daily records
      const dailyDays = new Set(dailyRecords.map((r) => r.periodStart));

      // Create a map of all data (daily + hourly aggregated)
      const allDataByDay = new Map<number, number>();

      // Add daily records
      for (const record of dailyRecords) {
        allDataByDay.set(record.periodStart, record.aiResponseCount);
      }

      // Add aggregated hourly data for days without daily records
      for (const [dayKey, totalResponses] of hourlyByDay.entries()) {
        if (!dailyDays.has(dayKey)) {
          allDataByDay.set(dayKey, totalResponses);
        }
      }

      // Generate data points for the entire period
      const currentDate = new Date(startTime);
      const endDate = new Date(endTime);

      while (currentDate <= endDate) {
        const dayStart = new Date(currentDate);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayKey = dayStart.getTime();

        const responses = allDataByDay.get(dayKey) || 0;
        let dateString: string;
        let label: string;

        switch (period) {
          case "week":
            dateString = currentDate.toLocaleDateString("en-US", {
              weekday: "short",
            });
            label = dateString;
            break;
          case "month":
            dateString = currentDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            label = dateString;
            break;
          case "3months":
            dateString = currentDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            label = dateString;
            break;
          default:
            dateString = currentDate.toISOString();
            label = dateString;
        }

        chartData.push({
          date: dateString,
          responses,
          label,
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Sort by actual time
    if (period === "3days") {
      chartData.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } else {
      chartData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });
    }

    return chartData;
  },
});

// ============================================================================
// GET PERIOD STATS (for Chart Summary)
// ============================================================================

export const getPeriodStats = query({
  args: {
    companyId: v.id("companies"),
    period: v.union(
      v.literal("3days"),
      v.literal("week"),
      v.literal("month"),
      v.literal("3months")
    ),
  },
  handler: async (ctx, { companyId, period }) => {
    const now = Date.now();
    let startTime: number;

    // Calculate period boundaries
    switch (period) {
      case "3days":
        startTime = now - 3 * 24 * 60 * 60 * 1000;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case "3months":
        startTime = now - 90 * 24 * 60 * 60 * 1000;
        break;
    }

    // Get daily records for the period
    const dailyRecords = await ctx.db
      .query("usage_records")
      .withIndex("by_company_period", (q) =>
        q
          .eq("companyId", companyId)
          .eq("period", "daily")
          .gte("periodStart", startTime)
          .lte("periodStart", now)
      )
      .collect();

    // Get ALL hourly records within the period
    const hourlyRecords = await ctx.db
      .query("usage_records")
      .withIndex("by_company_period", (q) =>
        q
          .eq("companyId", companyId)
          .eq("period", "hourly")
          .gte("periodStart", startTime)
      )
      .collect();

    // Group hourly records by day
    const hourlyByDay = new Map<number, number>();
    for (const record of hourlyRecords) {
      const dayStart = new Date(record.periodStart);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayKey = dayStart.getTime();

      hourlyByDay.set(
        dayKey,
        (hourlyByDay.get(dayKey) || 0) + record.aiResponseCount
      );
    }

    // Find which days already have daily records
    const dailyDays = new Set(dailyRecords.map((r) => r.periodStart));

    // Create combined records for stats
    const allRecords = [
      ...dailyRecords.map((r) => ({
        aiResponseCount: r.aiResponseCount,
        periodStart: r.periodStart,
      })),
    ];

    // Add aggregated hourly data for days without daily records
    for (const [dayKey, totalResponses] of hourlyByDay.entries()) {
      if (!dailyDays.has(dayKey)) {
        allRecords.push({
          aiResponseCount: totalResponses,
          periodStart: dayKey,
        });
      }
    }

    if (allRecords.length === 0) {
      return {
        total: 0,
        average: 0,
        peak: 0,
        peakDate: "No data",
      };
    }

    // Calculate stats
    const total = allRecords.reduce(
      (sum, record) => sum + record.aiResponseCount,
      0
    );
    const average = Math.round(total / allRecords.length);
    const peak = Math.max(
      ...allRecords.map((record) => record.aiResponseCount)
    );

    const peakRecord = allRecords.find(
      (record) => record.aiResponseCount === peak
    );
    const peakDate = peakRecord
      ? new Date(peakRecord.periodStart).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "Unknown";

    return {
      total,
      average,
      peak,
      peakDate,
    };
  },
});

// ============================================================================
// CHECK USAGE LIMITS (for AI generation)
// ============================================================================

export const checkUsageLimit = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    const plan = await ctx.db.get(company.planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    const remainingResponses =
      plan.aiResponsesPerMonth - company.aiResponsesThisMonth;
    const hasReachedLimit = remainingResponses <= 0;

    return {
      hasReachedLimit,
      currentUsage: company.aiResponsesThisMonth,
      limit: plan.aiResponsesPerMonth,
      remaining: Math.max(0, remainingResponses),
      planName: plan.name,
    };
  },
});
