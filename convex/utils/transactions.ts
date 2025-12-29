/**
 * Transaction Utilities for Convex
 * 
 * Provides optimistic locking and transaction support to prevent race conditions.
 * Convex mutations are already transactional, but we add extra safeguards for critical operations.
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Optimistic Lock Schema
 * Add this to your schema.ts:
 * 
 * optimisticLocks: defineTable({
 *   resourceId: v.string(), // e.g., "conversation:id123"
 *   lockedBy: v.id("users"),
 *   lockedAt: v.number(),
 *   expiresAt: v.number(),
 *   operation: v.string(),
 * })
 * .index("by_resource", ["resourceId"])
 * .index("by_expiry", ["expiresAt"])
 */

const LOCK_TIMEOUT_MS = 5000; // 5 seconds default lock timeout

/**
 * Acquire an optimistic lock on a resource
 */
export const acquireLock = mutation({
  args: {
    resourceType: v.string(), // e.g., "conversation"
    resourceId: v.string(),
    userId: v.id("users"),
    operation: v.string(), // e.g., "sendMessage", "updateStatus"
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, { resourceType, resourceId, userId, operation, timeoutMs }) => {
    const now = Date.now();
    const timeout = timeoutMs || LOCK_TIMEOUT_MS;
    const lockKey = `${resourceType}:${resourceId}`;
    
    // Check for existing lock
    const existingLock = await ctx.db
      .query("optimisticLocks")
      .withIndex("by_resource", (q) => q.eq("resourceId", lockKey))
      .first();
    
    if (existingLock) {
      // Check if lock is expired
      if (existingLock.expiresAt < now) {
        // Delete expired lock
        await ctx.db.delete(existingLock._id);
      } else if (existingLock.lockedBy !== userId) {
        // Lock is held by another user
        throw new Error(
          `Resource is locked by another operation. Please try again in ${
            Math.ceil((existingLock.expiresAt - now) / 1000)
          } seconds.`
        );
      } else {
        // Same user, extend lock
        await ctx.db.patch(existingLock._id, {
          expiresAt: now + timeout,
          operation,
        });
        return { lockId: existingLock._id, extended: true };
      }
    }
    
    // Create new lock
    const lockId = await ctx.db.insert("optimisticLocks", {
      resourceId: lockKey,
      lockedBy: userId,
      lockedAt: now,
      expiresAt: now + timeout,
      operation,
    });
    
    return { lockId, extended: false };
  },
});

/**
 * Release an optimistic lock
 */
export const releaseLock = mutation({
  args: {
    lockId: v.id("optimisticLocks"),
    userId: v.id("users"),
  },
  handler: async (ctx, { lockId, userId }) => {
    const lock = await ctx.db.get(lockId);
    
    if (!lock) {
      // Lock already released or expired
      return { released: false, reason: "Lock not found" };
    }
    
    if (lock.lockedBy !== userId) {
      throw new Error("Cannot release lock owned by another user");
    }
    
    await ctx.db.delete(lockId);
    return { released: true };
  },
});

/**
 * Clean up expired locks (run periodically)
 */
export const cleanupExpiredLocks = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    const expiredLocks = await ctx.db
      .query("optimisticLocks")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .collect();
    
    for (const lock of expiredLocks) {
      await ctx.db.delete(lock._id);
    }
    
    return { cleaned: expiredLocks.length };
  },
});

/**
 * Execute a mutation with optimistic locking
 * This is a wrapper that ensures proper locking for critical operations
 */
export async function withLock<T>(
  ctx: any,
  resourceType: string,
  resourceId: string,
  userId: Id<"users">,
  operation: string,
  callback: () => Promise<T>
): Promise<T> {
  let lockId: Id<"optimisticLocks"> | null = null;
  
  try {
    // Acquire lock
    const lock = await ctx.runMutation(
      acquireLock,
      { resourceType, resourceId, userId, operation }
    );
    lockId = lock.lockId;
    
    // Execute operation
    const result = await callback();
    
    // Release lock
    if (lockId) {
      await ctx.runMutation(releaseLock, { lockId, userId });
    }
    
    return result;
  } catch (error) {
    // Always try to release lock on error
    if (lockId) {
      try {
        await ctx.runMutation(releaseLock, { lockId, userId });
      } catch {
        // Ignore release errors
      }
    }
    throw error;
  }
}

/**
 * Version-based optimistic concurrency control
 * Add a version field to your tables and increment on every update
 */
export function checkVersion(
  current: number,
  expected: number,
  entityName: string
): void {
  if (current !== expected) {
    throw new Error(
      `${entityName} was modified by another operation. Please refresh and try again.`
    );
  }
}

/**
 * Atomic increment with bounds checking
 */
export const atomicIncrement = mutation({
  args: {
    tableName: v.string(),
    recordId: v.any(), // Generic ID type
    field: v.string(),
    increment: v.number(),
    maxValue: v.optional(v.number()),
  },
  handler: async (ctx, { tableName, recordId, field, increment, maxValue }) => {
    // This is already atomic in Convex, but we add bounds checking
    const record = await ctx.db.get(recordId);
    if (!record) {
      throw new Error(`Record not found in ${tableName}`);
    }
    
    const currentValue = record[field] || 0;
    const newValue = currentValue + increment;
    
    if (maxValue !== undefined && newValue > maxValue) {
      throw new Error(`Cannot increment ${field}: would exceed maximum value of ${maxValue}`);
    }
    
    await ctx.db.patch(recordId, {
      [field]: newValue,
    });
    
    return { oldValue: currentValue, newValue };
  },
});