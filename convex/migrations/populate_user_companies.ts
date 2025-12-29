/**
 * Migration: Populate user_companies junction table
 *
 * This migration copies existing user-company relationships from the users table
 * to the new user_companies junction table to enable multi-company support.
 *
 * This is a one-time migration that can be run multiple times safely (idempotent).
 */

import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Main migration function
 *
 * Copies all existing user-company relationships to the user_companies table.
 * Can be run multiple times safely - skips already migrated records.
 */
export const migrateToJunctionTable = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Starting user_companies migration...");

    // 1. Count existing users
    const allUsers = await ctx.db.query("users").collect();
    console.log(`Found ${allUsers.length} users to migrate...`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 2. For each user, create junction record
    for (const user of allUsers) {
      try {
        // Skip users without companyId (shouldn't happen in current data)
        if (!user.companyId) {
          console.log(`Skipping user ${user._id} - no companyId`);
          skipCount++;
          continue;
        }

        // Check if already migrated
        const existing = await ctx.db
          .query("user_companies")
          .withIndex("by_user_company", (q) =>
            q.eq("userId", user._id).eq("companyId", user.companyId!)
          )
          .first();

        if (existing) {
          skipCount++;
          continue;
        }

        // Validate required fields
        if (!user.companyId || !user.role) {
          console.warn(`Skipping user ${user._id}: missing companyId or role`);
          skipCount++;
          continue;
        }

        // Create junction record
        const now = Date.now();
        await ctx.db.insert("user_companies", {
          userId: user._id,
          companyId: user.companyId,
          role: user.role,
          joinedAt: user.createdAt,
          lastActiveInCompany: user.lastActiveAt,
          createdAt: now,
          updatedAt: now,
        });

        successCount++;

        if (successCount % 10 === 0) {
          console.log(`Migrated ${successCount} users...`);
        }
      } catch (error) {
        const errorMsg = `Failed to migrate user ${user._id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        errorCount++;
      }
    }

    // 3. Verify results
    const junctionCount = await ctx.db.query("user_companies").collect();
    console.log(`Migration complete:`);
    console.log(`  - ${successCount} records created`);
    console.log(`  - ${skipCount} records skipped (already migrated)`);
    console.log(`  - ${errorCount} errors`);
    console.log(`  - Junction table now has ${junctionCount.length} records`);

    if (errors.length > 0) {
      console.log("Errors encountered:");
      errors.forEach((error) => console.log(`  - ${error}`));
    }

    return {
      successCount,
      skipCount,
      errorCount,
      totalJunction: junctionCount.length,
      errors: errors.slice(0, 10), // Return first 10 errors
    };
  },
});

/**
 * Verify migration results
 *
 * Checks that all users have corresponding junction records.
 */
export const verifyMigration = query({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect();
    const allJunctionRecords = await ctx.db.query("user_companies").collect();

    // Check for users without junction records
    const usersWithoutJunction = [];
    for (const user of allUsers) {
      if (!user.companyId || !user.role) continue; // Skip invalid users

      const junctionRecord = await ctx.db
        .query("user_companies")
        .withIndex("by_user_company", (q) =>
          q.eq("userId", user._id).eq("companyId", user.companyId!)
        )
        .first();

      if (!junctionRecord) {
        usersWithoutJunction.push({
          userId: user._id,
          companyId: user.companyId,
          role: user.role,
        });
      }
    }

    // Check for junction records without users
    const orphanedJunctionRecords = [];
    for (const junctionRecord of allJunctionRecords) {
      const user = await ctx.db.get(junctionRecord.userId);
      if (!user) {
        orphanedJunctionRecords.push(junctionRecord._id);
      }
    }

    return {
      totalUsers: allUsers.length,
      totalJunctionRecords: allJunctionRecords.length,
      usersWithoutJunction: usersWithoutJunction.length,
      orphanedJunctionRecords: orphanedJunctionRecords.length,
      isValid:
        usersWithoutJunction.length === 0 &&
        orphanedJunctionRecords.length === 0,
      issues: {
        usersWithoutJunction: usersWithoutJunction.slice(0, 10), // First 10
        orphanedJunctionRecords: orphanedJunctionRecords.slice(0, 10), // First 10
      },
    };
  },
});

/**
 * Rollback migration (for testing)
 *
 * Removes all junction records created by migration.
 * Only use for testing - this will break the app if code expects junction table.
 */
export const rollbackMigration = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("Rolling back user_companies migration...");

    const allJunctionRecords = await ctx.db.query("user_companies").collect();
    let deletedCount = 0;

    for (const record of allJunctionRecords) {
      await ctx.db.delete(record._id);
      deletedCount++;
    }

    console.log(`Deleted ${deletedCount} junction records`);
    return { deletedCount };
  },
});
