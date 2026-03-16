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
// GET COMPANY BY WHOP MEMBERSHIP ID
// ============================================================================

export const getCompanyByMembershipId = query({
  args: {
    whopMembershipId: v.string(),
  },
  handler: async (ctx, { whopMembershipId }) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_whop_membership_id", (q) =>
        q.eq("whopMembershipId", whopMembershipId)
      )
      .first();
  },
});

// ============================================================================
// GET COMPANY BY EXPERIENCE ID
// ============================================================================

export const getCompanyByExperienceId = query({
  args: {
    experienceId: v.string(),
  },
  handler: async (ctx, { experienceId }) => {
    // First check the primary experience ID (indexed)
    const byPrimary = await ctx.db
      .query("companies")
      .withIndex("by_whop_experience_id", (q) =>
        q.eq("whopExperienceId", experienceId)
      )
      .first();
    if (byPrimary) return byPrimary;

    // Fall back to checking the experience IDs array (full scan but rare)
    const allCompanies = await ctx.db.query("companies").collect();
    return allCompanies.find(
      (c) => c.whopExperienceIds?.includes(experienceId)
    ) ?? null;
  },
});

// ============================================================================
// GET COMPANY BY ROUTE (stable across reinstalls)
// ============================================================================

export const getCompanyByRoute = query({
  args: {
    companyRoute: v.string(),
  },
  handler: async (ctx, { companyRoute }) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_whop_company_route", (q) =>
        q.eq("whopCompanyRoute", companyRoute)
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
// GET ALL COMPANIES (for cron jobs and admin)
// ============================================================================

export const getAllCompanies = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companies").collect();
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
        hasDepartments: plan.hasDepartments,
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

      // Departments
      departmentsEnabled: company.departmentsEnabled ?? false,

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

// ============================================================================
// DUPLICATE WHOP COMPANY ID DETECTION
// ============================================================================

/**
 * Find duplicate whopCompanyId values across companies
 *
 * This query identifies data integrity issues where multiple Convex companies
 * have the same whopCompanyId, which causes product sync cross-contamination.
 *
 * Use this to audit your database for duplicates before they cause issues.
 */
export const findDuplicateWhopCompanyIds = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db.query("companies").collect();

    // Group companies by whopCompanyId
    const grouped: Record<string, Array<{ _id: string; name: string; whopExperienceId?: string; createdAt: number }>> = {};

    for (const company of companies) {
      const key = company.whopCompanyId;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({
        _id: company._id,
        name: company.name,
        whopExperienceId: company.whopExperienceId,
        createdAt: company.createdAt,
      });
    }

    // Find duplicates (whopCompanyId used by more than one company)
    const duplicates: Array<{
      whopCompanyId: string;
      companies: Array<{ _id: string; name: string; whopExperienceId?: string; createdAt: number }>;
    }> = [];

    for (const [whopCompanyId, companyList] of Object.entries(grouped)) {
      if (companyList.length > 1) {
        duplicates.push({
          whopCompanyId,
          companies: companyList.sort((a, b) => a.createdAt - b.createdAt), // Oldest first
        });
      }
    }

    return {
      hasDuplicates: duplicates.length > 0,
      duplicateCount: duplicates.length,
      duplicates,
      totalCompanies: companies.length,
    };
  },
});

/**
 * Verify a specific company's whopCompanyId is unique
 *
 * Use this before syncing products to ensure no other company has the same ID.
 */
export const verifyWhopCompanyIdUnique = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) {
      return { valid: false, error: "Company not found" };
    }

    // Find other companies with the same whopCompanyId
    const otherCompanies = await ctx.db
      .query("companies")
      .withIndex("by_whop_company_id", (q) => q.eq("whopCompanyId", company.whopCompanyId))
      .collect();

    const duplicates = otherCompanies.filter((c) => c._id !== companyId);

    if (duplicates.length > 0) {
      return {
        valid: false,
        error: `whopCompanyId ${company.whopCompanyId} is also used by: ${duplicates.map((c) => `${c._id} (${c.name})`).join(", ")}`,
        duplicateCompanyIds: duplicates.map((c) => c._id),
      };
    }

    return { valid: true };
  },
});

/**
 * Debug: Check company usage limits by name
 *
 * Use this to verify if a company would be blocked by usage limits.
 * Run in Convex dashboard: companies:checkUsageLimitsByName({ companyName: "Crypto Wolf" })
 */
export const checkUsageLimitsByName = query({
  args: { companyName: v.string() },
  handler: async (ctx, { companyName }) => {
    // Find company by name (case-insensitive partial match)
    const companies = await ctx.db.query("companies").collect();

    const company = companies.find(c =>
      c.name.toLowerCase().includes(companyName.toLowerCase())
    );

    if (!company) {
      return { error: `Company containing "${companyName}" not found` };
    }

    // Get the plan
    const plan = await ctx.db.get(company.planId);

    if (!plan) {
      return { error: "Plan not found for company" };
    }

    const remainingResponses = plan.aiResponsesPerMonth - company.aiResponsesThisMonth;
    const hasReachedLimit = remainingResponses <= 0;
    const percentUsed = Math.round((company.aiResponsesThisMonth / plan.aiResponsesPerMonth) * 100);

    return {
      companyName: company.name,
      companyId: company._id,

      // Usage stats
      usage: {
        current: company.aiResponsesThisMonth,
        limit: plan.aiResponsesPerMonth,
        remaining: Math.max(0, remainingResponses),
        percentUsed: `${percentUsed}%`,
      },

      // THE KEY QUESTION
      limitStatus: {
        hasReachedLimit,
        wouldAiRespond: hasReachedLimit ? "❌ NO - Limit reached, AI will NOT respond" : "✅ YES - AI will respond",
      },

      // Plan info
      plan: {
        name: plan.name,
        price: plan.price,
      },

      // Reset timing
      billing: {
        resetAt: new Date(company.aiResponsesResetAt).toISOString(),
        periodEnd: new Date(company.currentPeriodEnd).toISOString(),
      },
    };
  },
});
