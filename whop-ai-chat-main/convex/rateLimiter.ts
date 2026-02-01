/**
 * Rate Limiter for API Calls
 * 
 * Implements a sliding window rate limiter to prevent abuse
 * of expensive operations like AI responses.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Rate limit configuration
export const RATE_LIMITS = {
  // AI responses per company
  aiResponse: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 10, // 10 AI responses per minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes after violation
  },
  // Messages per user
  userMessage: {
    windowMs: 60 * 1000, // 1 minute window  
    maxRequests: 30, // 30 messages per minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
  },
  // File uploads per company
  fileUpload: {
    windowMs: 60 * 60 * 1000, // 1 hour window
    maxRequests: 20, // 20 uploads per hour
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
  }
};

// Define rate limit bucket schema (add to schema.ts later)
export interface RateLimitBucket {
  key: string; // e.g., "aiResponse:companyId"
  requests: Array<{
    timestamp: number;
    metadata?: any;
  }>;
  blockedUntil?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Check if an action is rate limited
 */
export const checkRateLimit = query({
  args: {
    limitType: v.union(
      v.literal("aiResponse"),
      v.literal("userMessage"),
      v.literal("fileUpload")
    ),
    identifier: v.string(), // companyId or userId
  },
  handler: async (ctx, { limitType, identifier }) => {
    const now = Date.now();
    const config = RATE_LIMITS[limitType];
    const key = `${limitType}:${identifier}`;
    
    // Find or create rate limit bucket
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    
    // If no bucket exists, not rate limited
    if (!bucket) {
      return { 
        isRateLimited: false,
        remainingRequests: config.maxRequests,
        resetAt: now + config.windowMs,
      };
    }
    
    // Check if currently blocked
    if (bucket.blockedUntil && bucket.blockedUntil > now) {
      return {
        isRateLimited: true,
        blockedUntil: bucket.blockedUntil,
        remainingRequests: 0,
        resetAt: bucket.blockedUntil,
        message: `Rate limit exceeded. Please wait ${Math.ceil((bucket.blockedUntil - now) / 1000)} seconds.`
      };
    }
    
    // Count requests in current window
    const windowStart = now - config.windowMs;
    const recentRequests = bucket.requests.filter(
      (req) => req.timestamp > windowStart
    );
    
    // Check if limit exceeded
    if (recentRequests.length >= config.maxRequests) {
      return {
        isRateLimited: true,
        blockedUntil: now + config.blockDurationMs,
        remainingRequests: 0,
        resetAt: now + config.blockDurationMs,
        message: `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`
      };
    }
    
    return {
      isRateLimited: false,
      remainingRequests: config.maxRequests - recentRequests.length,
      resetAt: windowStart + config.windowMs,
    };
  },
});

/**
 * Record a request for rate limiting
 */
export const recordRateLimitedRequest = mutation({
  args: {
    limitType: v.union(
      v.literal("aiResponse"),
      v.literal("userMessage"),
      v.literal("fileUpload")
    ),
    identifier: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { limitType, identifier, metadata }) => {
    const now = Date.now();
    const config = RATE_LIMITS[limitType];
    const key = `${limitType}:${identifier}`;
    
    // Find existing bucket
    const bucket = await ctx.db
      .query("rateLimitBuckets")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    
    if (bucket) {
      // Clean old requests outside window
      const windowStart = now - config.windowMs;
      const recentRequests = bucket.requests.filter(
        (req) => req.timestamp > windowStart
      );
      
      // Check if we would exceed limit
      if (recentRequests.length >= config.maxRequests) {
        // Set blocked status
        await ctx.db.patch(bucket._id, {
          blockedUntil: now + config.blockDurationMs,
          updatedAt: now,
        });
        
        throw new Error(`Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`);
      }
      
      // Add new request
      await ctx.db.patch(bucket._id, {
        requests: [...recentRequests, { timestamp: now, metadata }],
        updatedAt: now,
      });
    } else {
      // Create new bucket
      await ctx.db.insert("rateLimitBuckets", {
        key,
        requests: [{ timestamp: now, metadata }],
        createdAt: now,
        updatedAt: now,
      });
    }
    
    return { success: true };
  },
});

/**
 * Clean up old rate limit buckets (run periodically)
 */
export const cleanupRateLimitBuckets = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // Find old buckets
    const oldBuckets = await ctx.db
      .query("rateLimitBuckets")
      .filter((q) => q.lt(q.field("updatedAt"), now - maxAge))
      .collect();
    
    // Delete old buckets
    for (const bucket of oldBuckets) {
      await ctx.db.delete(bucket._id);
    }
    
    return { deletedCount: oldBuckets.length };
  },
});