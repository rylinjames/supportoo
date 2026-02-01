/**
 * Workspace Actions
 *
 * High-level workflows for company context management (text only).
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

/**
 * Update company context from text input
 *
 * Workflow: Text → Optional AI condensing → Save
 */
export const updateContextFromText = action({
  args: {
    companyId: v.id("companies"),
    text: v.string(),
    shouldCondense: v.optional(v.boolean()),
  },
  handler: async (ctx, { companyId, text, shouldCondense = false }) => {
    try {
      let processedText = text;
      let condensed = false;
      let tokensUsed = 0;

      // Optional: AI-condense the text
      if (shouldCondense && text.length > 500) {
        // TODO: Implement AI condensing when needed
        // For now, just use the original text
        processedText = text;
        condensed = false;
        tokensUsed = 0;
      }

      // Delete old file if exists
      const company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId,
      });

      if (company?.companyContextFileId) {
        // Get old file info
        const oldFile = await ctx.runQuery(
          api.companies.queries.getCompanyContextFile,
          { fileId: company.companyContextFileId }
        );

        if (oldFile) {
          // Delete from UploadThing
          await ctx.runAction(api.uploadthing.actions.deleteFile, {
            fileKey: oldFile.fileKey,
          });

          // Delete file record
          await ctx.runMutation(
            api.companies.mutations.deleteCompanyContextFile,
            { fileId: company.companyContextFileId }
          );
        }
      }

      // Save to database
      await ctx.runMutation(api.companies.mutations.updateCompanyContext, {
        companyId,
        companyContextOriginal: text,
        companyContextProcessed: processedText,
        companyContextFileId: undefined, // No file for text input
      });

      // Update Vector Store with new context
      console.log(
        "[updateContextFromText] Triggering Vector Store update for company:",
        companyId
      );

      await ctx.runAction(api.ai.assistants.updateCompanyContext, {
        companyId,
      });

      console.log(
        "[updateContextFromText] Vector Store update triggered (async)"
      );

      return {
        success: true,
        condensed,
        tokensUsed,
      };
    } catch (error) {
      console.error("Error updating context from text:", error);
      throw new Error(
        `Failed to update context: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
