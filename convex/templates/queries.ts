/**
 * Template Queries
 *
 * Read-only operations for fetching templates.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * List all templates for a company
 *
 * Used in Workspace tab and Support tab (for quick replies).
 */
export const listTemplatesByCompany = query({
  args: {
    companyId: v.id("companies"),
    category: v.optional(
      v.union(
        v.literal("greeting"),
        v.literal("escalation"),
        v.literal("resolution"),
        v.literal("general")
      )
    ),
  },
  handler: async (ctx, { companyId, category }) => {
    if (category !== undefined) {
      // Use index when category is provided
      return await ctx.db
        .query("templates")
        .withIndex("by_company_category", (q) =>
          q.eq("companyId", companyId).eq("category", category)
        )
        .collect();
    }

    // Get all active templates for company
    return await ctx.db
      .query("templates")
      .withIndex("by_company_active", (q) =>
        q.eq("companyId", companyId).eq("isActive", true)
      )
      .collect();
  },
});

/**
 * Get a single template by ID
 */
export const getTemplateById = query({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, { templateId }) => {
    return await ctx.db.get(templateId);
  },
});

/**
 * Search templates by title or content
 *
 * Used in Workspace tab when admin searches for a template.
 */
export const searchTemplates = query({
  args: {
    companyId: v.id("companies"),
    searchTerm: v.string(),
  },
  handler: async (ctx, { companyId, searchTerm }) => {
    const allTemplates = await ctx.db
      .query("templates")
      .withIndex("by_company_active", (q) =>
        q.eq("companyId", companyId).eq("isActive", true)
      )
      .collect();

    const lowerSearchTerm = searchTerm.toLowerCase();

    return allTemplates.filter(
      (template) =>
        template.title.toLowerCase().includes(lowerSearchTerm) ||
        template.content.toLowerCase().includes(lowerSearchTerm)
    );
  },
});
