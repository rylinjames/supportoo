/**
 * Company Mutations
 *
 * Operations that create or modify company data.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Update experience ID for an existing company
 */
export const updateExperienceId = mutation({
  args: {
    companyId: v.id("companies"),
    experienceId: v.string(),
  },
  handler: async (ctx, { companyId, experienceId }) => {
    await ctx.db.patch(companyId, {
      whopExperienceId: experienceId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Create a new company
 *
 * Called when the first admin from a company accesses the app.
 * Creates company with default settings (wizard not completed yet).
 */
export const createCompany = mutation({
  args: {
    whopCompanyId: v.string(),
    name: v.string(),
    experienceId: v.optional(v.string()),
  },
  handler: async (ctx, { whopCompanyId, name, experienceId }) => {
    // Get the Free plan ID (default for new companies)
    const freePlan = await ctx.db
      .query("plans")
      .withIndex("by_name", (q) => q.eq("name", "free"))
      .first();

    if (!freePlan) {
      throw new Error("Free plan not found. Run seed script first.");
    }

    const now = Date.now();

    const companyId = await ctx.db.insert("companies", {
      whopCompanyId,
      whopExperienceId: experienceId,
      name,
      planId: freePlan._id,

      // Default AI configuration
      selectedAiModel: freePlan.aiModels[0], // Default to gpt-5-nano from free plan
      aiPersonality: "professional", // Default until wizard
      aiResponseLength: "medium", // Default
      aiSystemPrompt: "", // Empty until wizard
      aiHandoffTriggers: [], // Empty until wizard

      // Company context (empty until user sets it in Workspace)
      companyContextOriginal: "",
      companyContextProcessed: "",
      companyContextFileId: undefined,
      companyContextLastUpdated: now,

      // OpenAI Assistants API (will be set by action)
      openaiAssistantId: undefined,
      openaiVectorStoreId: undefined,
      openaiContextFileId: undefined,

      // Billing
      billingStatus: "active",
      currentPeriodStart: now,
      currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000, // 30 days

      // Usage tracking
      aiResponsesThisMonth: 0,
      aiResponsesResetAt: now + 30 * 24 * 60 * 60 * 1000,

      // Settings
      timezone: "America/New_York", // Default timezone

      // Onboarding state
      onboardingCompleted: false, // ⚠️ Not completed yet
      setupWizardCompleted: false,

      // Metadata
      createdAt: now,
      updatedAt: now,
    });

    // Schedule assistant creation (non-blocking)
    await ctx.scheduler.runAfter(0, api.ai.assistants.createOrUpdateAssistant, {
      companyId,
    });

    return companyId;
  },
});

/**
 * Update company settings (from Settings tab)
 *
 * Allows users to update their timezone preference.
 */
export const updateCompanyTimezone = mutation({
  args: {
    companyId: v.id("companies"),
    timezone: v.string(),
  },
  handler: async (ctx, { companyId, timezone }) => {
    // TODO: Add timezone validation here once we create convex/lib/timezones.ts

    await ctx.db.patch(companyId, {
      timezone,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Complete onboarding wizard
 *
 * Called when admin finishes the setup wizard.
 * Updates company with all configuration from wizard.
 */
export const completeOnboarding = mutation({
  args: {
    companyId: v.id("companies"),

    // Wizard data
    companyContextOriginal: v.string(),
    companyContextProcessed: v.string(), // AI-condensed version
    companyContextFileId: v.optional(v.id("company_context_files")),

    aiPersonality: v.union(
      v.literal("professional"),
      v.literal("friendly"),
      v.literal("casual"),
      v.literal("technical")
    ),
    aiResponseLength: v.union(
      v.literal("brief"),
      v.literal("medium"),
      v.literal("detailed")
    ),
    aiSystemPrompt: v.string(),
    aiHandoffTriggers: v.array(v.string()),
  },
  handler: async (
    ctx,
    {
      companyId,
      companyContextOriginal,
      companyContextProcessed,
      companyContextFileId,
      aiPersonality,
      aiResponseLength,
      aiSystemPrompt,
      aiHandoffTriggers,
    }
  ) => {
    const now = Date.now();

    await ctx.db.patch(companyId, {
      // AI Configuration
      aiPersonality,
      aiResponseLength,
      aiSystemPrompt,
      aiHandoffTriggers,

      // Company Context
      companyContextOriginal,
      companyContextProcessed,
      companyContextFileId,
      companyContextLastUpdated: now,

      // Onboarding state
      onboardingCompleted: true,
      setupWizardCompleted: true,

      // Metadata
      updatedAt: now,
    });
  },
});

/**
 * Update AI configuration (from AI Studio tab)
 *
 * Allows admins to update AI settings after initial setup.
 */
export const updateAiConfig = mutation({
  args: {
    companyId: v.id("companies"),
    selectedAiModel: v.optional(v.string()),
    aiPersonality: v.optional(
      v.union(
        v.literal("professional"),
        v.literal("friendly"),
        v.literal("casual"),
        v.literal("technical")
      )
    ),
    aiResponseLength: v.optional(
      v.union(v.literal("brief"), v.literal("medium"), v.literal("detailed"))
    ),
    aiSystemPrompt: v.optional(v.string()),
    aiHandoffTriggers: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    {
      companyId,
      selectedAiModel,
      aiPersonality,
      aiResponseLength,
      aiSystemPrompt,
      aiHandoffTriggers,
    }
  ) => {
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (selectedAiModel !== undefined) {
      // Verify the model is available in their plan
      const company = await ctx.db.get(companyId);
      if (!company) {
        throw new Error("Company not found");
      }

      const plan = await ctx.db.get(company.planId);
      if (!plan) {
        throw new Error("Plan not found");
      }

      if (!plan.aiModels.includes(selectedAiModel)) {
        throw new Error("This AI model is not available in your plan");
      }

      updates.selectedAiModel = selectedAiModel;
    }

    if (aiPersonality !== undefined) updates.aiPersonality = aiPersonality;
    if (aiResponseLength !== undefined)
      updates.aiResponseLength = aiResponseLength;
    if (aiSystemPrompt !== undefined) updates.aiSystemPrompt = aiSystemPrompt;
    if (aiHandoffTriggers !== undefined)
      updates.aiHandoffTriggers = aiHandoffTriggers;

    await ctx.db.patch(companyId, updates);

    // If AI settings changed, update assistant
    if (
      selectedAiModel !== undefined ||
      aiPersonality !== undefined ||
      aiSystemPrompt !== undefined
    ) {
      await ctx.scheduler.runAfter(
        0,
        api.ai.assistants.createOrUpdateAssistant,
        {
          companyId,
        }
      );
    }
  },
});

/**
 * Update OpenAI IDs (internal use by assistant actions)
 */
export const updateOpenAIIds = mutation({
  args: {
    companyId: v.id("companies"),
    openaiAssistantId: v.string(),
    openaiVectorStoreId: v.string(),
    openaiContextFileId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { companyId, openaiAssistantId, openaiVectorStoreId, openaiContextFileId }
  ) => {
    await ctx.db.patch(companyId, {
      openaiAssistantId,
      openaiVectorStoreId,
      openaiContextFileId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update test assistant ID for caching
 */
export const updateTestAssistantId = mutation({
  args: {
    companyId: v.id("companies"),
    testAssistantId: v.string(),
  },
  handler: async (ctx, { companyId, testAssistantId }) => {
    await ctx.db.patch(companyId, {
      testAssistantId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update company context (from Workspace tab)
 *
 * Replaces existing company context (no versioning).
 */
export const updateCompanyContext = mutation({
  args: {
    companyId: v.id("companies"),
    companyContextOriginal: v.string(),
    companyContextProcessed: v.string(),
    companyContextFileId: v.optional(v.id("company_context_files")),
  },
  handler: async (
    ctx,
    {
      companyId,
      companyContextOriginal,
      companyContextProcessed,
      companyContextFileId,
    }
  ) => {
    const now = Date.now();

    await ctx.db.patch(companyId, {
      companyContextOriginal,
      companyContextProcessed,
      companyContextFileId,
      companyContextLastUpdated: now,
      updatedAt: now,
    });
  },
});

/**
 * Create company context file record
 *
 * Stores metadata for uploaded PDF files.
 */
export const createCompanyContextFile = mutation({
  args: {
    companyId: v.id("companies"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    fileUrl: v.string(),
    fileKey: v.string(),
    uploadedBy: v.id("users"),
  },
  handler: async (
    ctx,
    { companyId, fileName, fileSize, mimeType, fileUrl, fileKey, uploadedBy }
  ) => {
    const fileId = await ctx.db.insert("company_context_files", {
      companyId,
      fileName,
      fileSize,
      mimeType,
      fileUrl,
      fileKey,
      uploadedBy,
      uploadedAt: Date.now(),
    });

    return fileId;
  },
});

/**
 * Delete company context file record
 *
 * Removes file metadata (actual file deletion handled by action).
 */
export const deleteCompanyContextFile = mutation({
  args: {
    fileId: v.id("company_context_files"),
  },
  handler: async (ctx, { fileId }) => {
    await ctx.db.delete(fileId);
  },
});

/**
 * Delete a company and ALL related data
 *
 * Use with extreme caution - this is destructive and irreversible.
 * Deletes: company, user relationships, conversations, messages, products, etc.
 */
export const deleteCompany = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    // 1. Delete all user-company relationships
    const userCompanyRelationships = await ctx.db
      .query("user_companies")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    for (const rel of userCompanyRelationships) {
      await ctx.db.delete(rel._id);
    }
    console.log(`Deleted ${userCompanyRelationships.length} user-company relationships`);

    // 2. Delete all conversations and their messages
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_company_status", (q) => q.eq("companyId", companyId))
      .collect();

    for (const conv of conversations) {
      // Delete messages in this conversation
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .collect();

      for (const msg of messages) {
        await ctx.db.delete(msg._id);
      }

      await ctx.db.delete(conv._id);
    }
    console.log(`Deleted ${conversations.length} conversations`);

    // 3. Delete all products
    const products = await ctx.db
      .query("products")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    for (const product of products) {
      await ctx.db.delete(product._id);
    }
    console.log(`Deleted ${products.length} products`);

    // 4. Delete company context files
    const contextFiles = await ctx.db
      .query("company_context_files")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();

    for (const file of contextFiles) {
      await ctx.db.delete(file._id);
    }
    console.log(`Deleted ${contextFiles.length} context files`);

    // 5. Delete templates
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_company_active", (q) => q.eq("companyId", companyId))
      .collect();

    for (const template of templates) {
      await ctx.db.delete(template._id);
    }
    console.log(`Deleted ${templates.length} templates`);

    // 6. Finally, delete the company itself
    await ctx.db.delete(companyId);
    console.log(`Deleted company ${companyId}`);

    return {
      success: true,
      deleted: {
        userRelationships: userCompanyRelationships.length,
        conversations: conversations.length,
        products: products.length,
        contextFiles: contextFiles.length,
        templates: templates.length,
      },
    };
  },
});

/**
 * Update company plan (from Billing tab)
 *
 * TODO: Revisit this when we discuss Whop billing integration.
 * Need to understand:
 * - How Whop checkout works
 * - Webhook flow for subscription updates
 * - How to handle plan upgrades/downgrades
 * - Billing status updates (active, canceled, past_due)
 */
export const updatePlan = mutation({
  args: {
    companyId: v.id("companies"),
    planId: v.id("plans"),
  },
  handler: async (ctx, { companyId, planId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    const newPlan = await ctx.db.get(planId);
    if (!newPlan) {
      throw new Error("Plan not found");
    }

    const updates: any = {
      planId,
      updatedAt: Date.now(),
    };

    // If downgrading, reset AI model to first available in new plan
    if (!newPlan.aiModels.includes(company.selectedAiModel)) {
      updates.selectedAiModel = newPlan.aiModels[0];
    }

    await ctx.db.patch(companyId, updates);
  },
});
