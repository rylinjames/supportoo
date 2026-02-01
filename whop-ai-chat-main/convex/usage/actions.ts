"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { getWhopSdk } from "../lib/whop";

/**
 * USAGE ACTIONS
 * External API calls for usage-related operations
 */

/**
 * Send usage warning notification to company admins
 *
 * Sends a push notification to all admins when usage reaches 80% of monthly limit.
 * Uses Whop SDK to send notifications.
 */
export const sendUsageWarningNotification = action({
  args: {
    companyId: v.id("companies"),
    experienceId: v.string(),
    currentUsage: v.number(),
    usageLimit: v.number(),
    planName: v.string(),
  },
  handler: async (
    ctx,
    { companyId, experienceId, currentUsage, usageLimit, planName }
  ): Promise<{
    success: boolean;
    reason?: string;
    adminsNotified?: number;
    adminWhopUserIds?: string[];
  }> => {
    // Get all admin users for this company
    const admins = await ctx.runQuery(api.users.queries.listUsersByCompany, {
      companyId,
      role: "admin",
    });

    if (admins.length === 0) {
      console.log(`No admins found for company ${companyId}`);
      return { success: false, reason: "no_admins" };
    }

    // Get Whop SDK
    const whopSdk = getWhopSdk();

    try {
      // Send notification to all admins
      await whopSdk.notifications.sendPushNotification({
        title: "Usage Warning",
        content: `Your AI responses have reached 80% of your ${planName} plan limit (${currentUsage}/${usageLimit}).`,
        experienceId,
        userIds: admins.map((admin: any) => admin.whopUserId),
        restPath: `/experiences/${experienceId}/dashboard/insights`,
      });

      console.log(
        `✅ Sent usage warning notification to ${admins.length} admins for company ${companyId}`
      );
      console.log(`  Usage: ${currentUsage}/${usageLimit} (${planName} plan)`);

      return {
        success: true,
        adminsNotified: admins.length,
        adminWhopUserIds: admins.map((admin: any) => admin.whopUserId),
      };
    } catch (error) {
      console.error("❌ Failed to send usage warning notification:", error);
      throw new Error(
        `Failed to send notification: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});
