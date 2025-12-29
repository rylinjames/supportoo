/**
 * UploadThing Configuration
 *
 * Setup and configuration for UploadThing file uploads.
 */

"use node";

import { UTApi } from "uploadthing/server";

/**
 * Get UploadThing configuration from environment
 */
export function getUploadThingConfig() {
  const token = process.env.UPLOADTHING_TOKEN;

  if (!token) {
    throw new Error("UPLOADTHING_SECRET environment variable is required");
  }

  return {
    token,
  };
}

/**
 * Get UploadThing API instance
 */
export function getUploadThingAPI() {
  const { token } = getUploadThingConfig();
  return new UTApi({ token });
}

/**
 * File upload limits by type
 */
export const FILE_LIMITS = {
  // Company context files
  pdf: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ["application/pdf"] as string[],
  },
  // Chat attachments (images only for pro plan)
  image: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ] as string[],
  },
};

/**
 * Validate file size and type
 */
export function validateFile(
  fileSize: number,
  fileType: string,
  category: "pdf" | "image"
): { valid: boolean; error?: string } {
  const limits = FILE_LIMITS[category];

  if (fileSize > limits.maxSize) {
    return {
      valid: false,
      error: `File too large. Max size: ${limits.maxSize / 1024 / 1024}MB`,
    };
  }

  if (!limits.allowedTypes.includes(fileType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${limits.allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Detect actual MIME type from file buffer (magic bytes)
 * This provides server-side validation that can't be spoofed
 */
export function detectMimeType(buffer: Buffer): string | null {
  // Check magic bytes for common file types
  const bytes = buffer.subarray(0, 12);
  
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return "image/jpeg";
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return "image/png";
  }
  
  // GIF: GIF87a or GIF89a
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  
  return null;
}

/**
 * Validate file with actual MIME type detection
 */
export function validateFileWithDetection(
  buffer: Buffer,
  fileSize: number,
  declaredType: string,
  category: "pdf" | "image"
): { valid: boolean; error?: string; actualType?: string } {
  const limits = FILE_LIMITS[category];

  // Check file size
  if (fileSize > limits.maxSize) {
    return {
      valid: false,
      error: `File too large. Max size: ${limits.maxSize / 1024 / 1024}MB`,
    };
  }

  // Detect actual MIME type from buffer
  const actualType = detectMimeType(buffer);
  
  if (!actualType) {
    return {
      valid: false,
      error: "Could not determine file type. File may be corrupted or unsupported.",
    };
  }

  // Check if actual type matches declared type
  if (actualType !== declaredType) {
    console.warn(`MIME type mismatch: declared=${declaredType}, actual=${actualType}`);
  }

  // Validate actual type against allowed types
  if (!limits.allowedTypes.includes(actualType)) {
    return {
      valid: false,
      error: `Invalid file type detected: ${actualType}. Allowed: ${limits.allowedTypes.join(", ")}`,
      actualType,
    };
  }

  return { valid: true, actualType };
}
