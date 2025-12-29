/**
 * UploadThing File Upload Actions
 *
 * Server-side file upload and management using UploadThing.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getUploadThingAPI, validateFile, validateFileWithDetection } from "./config";
import { UTFile } from "uploadthing/server";

/**
 * Upload a file to UploadThing from server
 *
 * Used for company context PDFs uploaded by admin.
 */
export const uploadFile = action({
  args: {
    fileData: v.string(), // Base64 encoded file data
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    category: v.union(v.literal("pdf"), v.literal("image")),
  },
  handler: async (
    ctx,
    { fileData, fileName, fileType, fileSize, category }
  ) => {
    try {
      const utapi = getUploadThingAPI();

      // Convert base64 to buffer
      const buffer = Buffer.from(fileData, "base64");
      
      // Validate file with actual MIME type detection
      const validation = validateFileWithDetection(buffer, fileSize, fileType, category);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      // Log if there was a type mismatch (but still allow if valid)
      if (validation.actualType && validation.actualType !== fileType) {
        console.log(`File type corrected: declared=${fileType}, actual=${validation.actualType}`);
      }

      // Create UTFile instance
      const file = new UTFile([buffer], fileName, {
        type: fileType,
      });

      // Upload to UploadThing
      const response = await utapi.uploadFiles([file]);

      if (!response[0] || response[0].error) {
        throw new Error(response[0]?.error?.message || "Failed to upload file");
      }

      const uploadedFile = response[0].data;

      return {
        success: true,
        file: {
          key: uploadedFile.key,
          url: uploadedFile.url,
          name: uploadedFile.name,
          size: uploadedFile.size,
        },
      };
    } catch (error) {
      console.error("Error uploading file to UploadThing:", error);
      throw new Error(
        `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Delete a file from UploadThing
 *
 * Used when replacing company context or deleting old files.
 */
export const deleteFile = action({
  args: {
    fileKey: v.string(),
  },
  handler: async (ctx, { fileKey }) => {
    try {
      const utapi = getUploadThingAPI();

      // Delete from UploadThing
      await utapi.deleteFiles([fileKey]);

      return { success: true };
    } catch (error) {
      console.error("Error deleting file from UploadThing:", error);
      throw new Error(
        `Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

/**
 * Get file URL from UploadThing
 *
 * Used to generate temporary download URLs.
 */
export const getFileUrl = action({
  args: {
    fileKey: v.string(),
  },
  handler: async (ctx, { fileKey }) => {
    try {
      const utapi = getUploadThingAPI();

      // Get file URLs
      const urls = await utapi.getFileUrls([fileKey]);

      if (!urls.data || urls.data.length === 0) {
        throw new Error("File not found");
      }

      return {
        success: true,
        url: urls.data[0]!.url,
      };
    } catch (error) {
      console.error("Error getting file URL from UploadThing:", error);
      throw new Error(
        `Failed to get file URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
