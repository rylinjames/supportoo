/**
 * Team Management Queries
 *
 * Queries for team member management functionality.
 * Updated to use junction table for multi-company support.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Get all team members for a company
 *
 * Returns all users with admin or support roles for the given company.
 * Uses junction table to support multi-company membership.
 * Sorted with admins first, then support agents, oldest first within each group.
 */
export const getTeamMembers = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }): Promise<any[]> => {
    // Use the new helper function that works with junction table
    return await ctx.runQuery(
      api.users.multi_company_helpers.getTeamMembersForCompany,
      { companyId }
    );
  },
});
