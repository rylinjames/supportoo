/**
 * Template Mutations
 *
 * Operations for creating, updating, and managing quick reply templates.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Copy default templates to a new company
 *
 * Called during company onboarding.
 * Fetches all templates from seed data and creates copies for the new company.
 */
export const copyDefaultTemplates = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, { companyId }) => {
    // Get first admin user to set as creator
    // Query via junction table (user_companies) to support multi-company architecture
    const adminRelationship = await ctx.db
      .query("user_companies")
      .withIndex("by_company_role", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    if (!adminRelationship) {
      throw new Error("No admin user found for company");
    }

    // Get the user document
    const firstAdmin = await ctx.db.get(adminRelationship.userId);
    if (!firstAdmin) {
      throw new Error("Admin user document not found");
    }

    // Default templates are hardcoded here (matching seed.ts)
    const defaultTemplates = [
      {
        title: "Greeting",
        content: "Hello! How can I help you today?",
        category: "greeting" as const,
      },
      {
        title: "Thank You",
        content:
          "Thank you for reaching out! Is there anything else I can help you with?",
        category: "general" as const,
      },
      {
        title: "Escalation",
        content:
          "I've forwarded your request to our support team. They'll get back to you shortly.",
        category: "escalation" as const,
      },
      {
        title: "Follow Up",
        content:
          "Just checking in - did my previous response help? Let me know if you need anything else!",
        category: "general" as const,
      },
      {
        title: "Account Issue",
        content:
          "I see you're having an account issue. Let me connect you with our support team who can help with this.",
        category: "escalation" as const,
      },
      {
        title: "Billing Question",
        content:
          "For billing questions, I'm connecting you with our billing specialist.",
        category: "escalation" as const,
      },
      {
        title: "Technical Support",
        content:
          "This looks like a technical issue. I'm escalating this to our technical support team.",
        category: "escalation" as const,
      },
      {
        title: "Issue Resolved",
        content:
          "I'm glad we could resolve your issue! Feel free to reach out if you need anything else.",
        category: "resolution" as const,
      },
    ];

    const now = Date.now();

    // Create templates for the company
    for (const template of defaultTemplates) {
      await ctx.db.insert("templates", {
        companyId,
        createdBy: firstAdmin._id,
        title: template.title,
        content: template.content,
        category: template.category,
        usageCount: 0,
        isActive: true,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Create a new template
 *
 * Called from Workspace tab when admin creates a custom template.
 */
export const createTemplate = mutation({
  args: {
    companyId: v.id("companies"),
    createdBy: v.id("users"),
    title: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("greeting"),
      v.literal("escalation"),
      v.literal("resolution"),
      v.literal("general")
    ),
  },
  handler: async (ctx, { companyId, createdBy, title, content, category }) => {
    const now = Date.now();

    const templateId = await ctx.db.insert("templates", {
      companyId,
      createdBy,
      title,
      content,
      category,
      usageCount: 0,
      isActive: true,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });

    return templateId;
  },
});

/**
 * Update an existing template
 */
export const updateTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("greeting"),
        v.literal("escalation"),
        v.literal("resolution"),
        v.literal("general")
      )
    ),
  },
  handler: async (ctx, { templateId, title, content, category }) => {
    const updates: any = {
      updatedAt: Date.now(),
    };

    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;

    await ctx.db.patch(templateId, updates);
  },
});

/**
 * Delete a template
 */
export const deleteTemplate = mutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, { templateId }) => {
    await ctx.db.delete(templateId);
  },
});
