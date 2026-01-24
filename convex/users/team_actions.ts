/**
 * Team Management Actions
 * 
 * Actions that interact with external APIs for team management
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Add team member with Whop verification
 *
 * This is an action that verifies the Whop username and then calls the mutation.
 * For existing users, sends a notification. For new users, creates a pending invite.
 */
export const addTeamMemberWithVerification = action({
  args: {
    whopUsername: v.string(),
    role: v.union(v.literal("admin"), v.literal("support")),
    companyId: v.id("companies"),
    callerWhopUserId: v.string(),
    experienceId: v.optional(v.string()), // For sending notifications
  },
  handler: async (ctx, { whopUsername, role, companyId, callerWhopUserId, experienceId }): Promise<{
    userId: string;
    isNew: boolean;
    isPending: boolean;
    notificationSent: boolean | null;
    notificationError: string | null;
    whopUserId: string;
    displayName: string;
  }> => {
    // Validate inputs
    if (!callerWhopUserId || callerWhopUserId === "") {
      console.error("Missing callerWhopUserId");
      throw new Error("Authentication required. Please refresh the page and try again.");
    }

    // Clean username (remove @ if present)
    const cleanUsername = whopUsername.replace('@', '').trim();
    if (!cleanUsername) {
      throw new Error("Invalid username");
    }

    console.log("Adding team member:", { cleanUsername, role, companyId, callerWhopUserId });

    // STEP 1: Check if user already exists in our database by username
    const existingUser = await ctx.runQuery(
      api.users.queries.getUserByWhopUsername,
      { whopUsername: cleanUsername }
    );

    // Get company and caller info for notifications
    const company = await ctx.runQuery(api.companies.queries.getCompanyById, { companyId });
    const caller = await ctx.runQuery(api.users.queries.getUserByWhopUserId, { whopUserId: callerWhopUserId });
    const companyName = company?.name || "the team";
    const inviterName = caller?.displayName || caller?.whopUsername || "A team admin";

    let whopUserId: string;
    let displayName: string;
    let isPendingUser: boolean;

    if (existingUser && !existingUser.whopUserId.startsWith("pending_")) {
      // User exists with real Whop ID - use their actual info
      whopUserId = existingUser.whopUserId;
      displayName = existingUser.displayName;
      isPendingUser = false;
      console.log("Found existing user:", { whopUserId, displayName });
    } else {
      // User doesn't exist or is pending - create pending user
      whopUserId = `pending_${cleanUsername}_${Date.now()}`;
      displayName = cleanUsername;
      isPendingUser = true;
      console.log("Creating pending user:", { whopUserId, displayName });
    }

    // STEP 2: Call the mutation to add the team member
    const result = await ctx.runMutation(
      api.users.team_mutations.addVerifiedTeamMember,
      {
        whopUsername: cleanUsername,
        whopUserId,
        displayName,
        role,
        companyId,
        callerWhopUserId,
      }
    );

    // STEP 3: Send notification if user has a real Whop ID
    let notificationSent = false;
    let notificationError: string | null = null;

    if (!isPendingUser && experienceId) {
      // User exists with real whopUserId - try to send notification
      try {
        const notifResult = await ctx.runAction(
          api.notifications.whop.sendTeamInvitationNotificationByUserId,
          {
            whopUserId,
            invitedByName: inviterName,
            companyName,
            role,
            experienceId,
          }
        );
        notificationSent = notifResult.success;
        notificationError = notifResult.error;
        console.log("Notification result:", notifResult);
      } catch (error: any) {
        console.error("Failed to send notification:", error);
        notificationError = error.message || "Failed to send notification";
      }
    } else if (isPendingUser) {
      // Pending user - can't send notification via Whop
      notificationError = "Please tell them to visit the app to accept the invite. Whop notifications require the user to have accessed the app before.";
    }

    return {
      ...result,
      notificationSent,
      notificationError,
    };
  },
});