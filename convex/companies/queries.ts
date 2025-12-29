import { v } from "convex/values";
import { query } from "../_generated/server";

/**
 * COMPANIES QUERIES
 * Fetch company data for frontend
 */

// ============================================================================
// GET COMPANY BY WHOP ID
// ============================================================================

export const getCompanyByWhopId = query({
  args: {
    whopCompanyId: v.string(),
  },
  handler: async (ctx, { whopCompanyId }) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_whop_company_id", (q) =>
        q.eq("whopCompanyId", whopCompanyId)
      )
      .first();
  },
});

// ============================================================================
// GET COMPANY BY ID
// ============================================================================

export const getCompanyById = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    return await ctx.db.get(companyId);
  },
});

// ============================================================================
// CHECK IF SETUP IS COMPLETE
// ============================================================================

export const isCompanySetupComplete = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) {
      return false;
    }
    return company.onboardingCompleted;
  },
});

// ============================================================================
// GET AI CONFIG (for AI response generation)
// ============================================================================

export const getCompanyAIConfig = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    return {
      aiPersonality: company.aiPersonality,
      aiResponseLength: company.aiResponseLength,
      aiSystemPrompt: company.aiSystemPrompt,
      aiHandoffTriggers: company.aiHandoffTriggers,
      companyContext: company.companyContextProcessed,
      selectedAiModel: company.selectedAiModel,
    };
  },
});

// ============================================================================
// GET FULL COMPANY CONFIG (for AI Studio and settings)
// ============================================================================

export const getFullCompanyConfig = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    // Get plan details
    const plan = await ctx.db.get(company.planId);
    if (!plan) {
      throw new Error("Plan not found");
    }

    return {
      // Company info
      companyId: company._id,
      name: company.name,
      timezone: company.timezone,

      // Plan
      plan: {
        name: plan.name,
        price: plan.price,
        aiModels: plan.aiModels,
        aiResponsesPerMonth: plan.aiResponsesPerMonth,
        hasTemplates: plan.hasTemplates,
        hasInsights: plan.hasInsights,
        hasCustomTriggers: plan.hasCustomTriggers,
        hasFileAttachments: plan.hasFileAttachments,
      },

      // AI Configuration
      aiPersonality: company.aiPersonality,
      aiResponseLength: company.aiResponseLength,
      aiSystemPrompt: company.aiSystemPrompt,
      aiHandoffTriggers: company.aiHandoffTriggers,
      selectedAiModel: company.selectedAiModel,

      // Company Context
      companyContextOriginal: company.companyContextOriginal,
      companyContextProcessed: company.companyContextProcessed,
      companyContextLastUpdated: company.companyContextLastUpdated,

      // Billing & Usage
      aiResponsesThisMonth: company.aiResponsesThisMonth,
      aiResponsesResetAt: company.aiResponsesResetAt,
      currentPeriodStart: company.currentPeriodStart,
      currentPeriodEnd: company.currentPeriodEnd,
      billingStatus: company.billingStatus,
      scheduledPlanChangeAt: company.scheduledPlanChangeAt,
      scheduledPlanId: company.scheduledPlanId,

      // Status
      onboardingCompleted: company.onboardingCompleted,
      setupWizardCompleted: company.setupWizardCompleted,
    };
  },
});

// ============================================================================
// COMPANY CONTEXT FILE
// ============================================================================

/**
 * Get company context file metadata
 *
 * Used to display uploaded file info in Workspace tab.
 */
export const getCompanyContextFile = query({
  args: {
    fileId: v.id("company_context_files"),
  },
  handler: async (ctx, { fileId }) => {
    return await ctx.db.get(fileId);
  },
});
