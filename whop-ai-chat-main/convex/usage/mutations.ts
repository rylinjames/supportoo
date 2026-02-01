import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { api } from "../_generated/api";

/**
 * USAGE TRACKING MUTATIONS
 * Track AI response usage for billing and insights
 */

// ============================================================================
// TRACK AI RESPONSE
// ============================================================================

export const trackAIResponse = mutation({
  args: {
    conversationId: v.id("conversations"),
    aiModel: v.string(),
    tokensUsed: v.number(),
    experienceId: v.string(),
  },
  handler: async (
    ctx,
    { conversationId, aiModel, tokensUsed, experienceId }
  ) => {
    // Get conversation to get companyId
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    // 1. Update company's monthly usage counter (real-time)
    const company = await ctx.db.get(conversation.companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    // Get plan info for usage limits
    const plan = await ctx.db.get(company.planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    const newUsageCount = company.aiResponsesThisMonth + 1;
    const usagePercentage = (newUsageCount / plan.aiResponsesPerMonth) * 100;

    await ctx.db.patch(conversation.companyId, {
      aiResponsesThisMonth: newUsageCount,
      updatedAt: now,
    });

    // 3. Check for 80% usage warning (once per billing cycle)
    if (usagePercentage >= 80 && !company.usageWarningSent) {
      console.log(
        `⚠️ Company ${company.name} reached 80% usage (${newUsageCount}/${plan.aiResponsesPerMonth})`
      );

      // Mark warning as sent
      await ctx.db.patch(conversation.companyId, {
        usageWarningSent: true,
      });

      // Send notification to all admins (use user_companies junction table)
      const adminUserCompanies = await ctx.db
        .query("user_companies")
        .withIndex("by_company_role", (q) =>
          q.eq("companyId", conversation.companyId).eq("role", "admin")
        )
        .collect();

      const admins = await Promise.all(
        adminUserCompanies.map(async (uc) => ctx.db.get(uc.userId))
      );

      if (admins.length > 0) {
        // Schedule notification to be sent (mutations can't call actions directly)
        await ctx.scheduler.runAfter(
          0,
          api.usage.actions.sendUsageWarningNotification,
          {
            companyId: conversation.companyId,
            experienceId,
            currentUsage: newUsageCount,
            usageLimit: plan.aiResponsesPerMonth,
            planName: plan.name,
          }
        );
      }
    }

    // 4. Create hourly record for daily aggregation
    const date = new Date(now);
    const startOfHour = new Date(date);
    startOfHour.setMinutes(0, 0, 0);
    const endOfHour = new Date(startOfHour.getTime() + 60 * 60 * 1000 - 1);

    // Create/update hourly record
    const hourlyRecord = await ctx.db
      .query("usage_records")
      .withIndex("by_company_period", (q) =>
        q
          .eq("companyId", conversation.companyId)
          .eq("period", "hourly")
          .eq("periodStart", startOfHour.getTime())
      )
      .first();

    if (hourlyRecord) {
      await ctx.db.patch(hourlyRecord._id, {
        aiResponseCount: hourlyRecord.aiResponseCount + 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("usage_records", {
        companyId: conversation.companyId,
        period: "hourly",
        periodStart: startOfHour.getTime(),
        periodEnd: endOfHour.getTime(),
        aiResponseCount: 1,
        customerMessageCount: 0,
        agentMessageCount: 0,
        conversationCount: 0,
        handoffCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

// ============================================================================
// GET CURRENT USAGE
// ============================================================================

export const getCurrentUsage = mutation({
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

    return {
      aiResponsesThisMonth: company.aiResponsesThisMonth,
      aiResponsesLimit: plan.aiResponsesPerMonth,
      remainingResponses: Math.max(
        0,
        plan.aiResponsesPerMonth - company.aiResponsesThisMonth
      ),
      billingStatus: company.billingStatus,
      currentPeriodEnd: company.currentPeriodEnd,
      aiResponsesResetAt: company.aiResponsesResetAt,
      planName: plan.name,
    };
  },
});
