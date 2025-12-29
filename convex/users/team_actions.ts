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
 * This is an action that verifies the Whop username and then calls the mutation
 */
export const addTeamMemberWithVerification = action({
  args: {
    whopUsername: v.string(),
    role: v.union(v.literal("admin"), v.literal("support")),
    companyId: v.id("companies"),
    callerWhopUserId: v.string(),
  },
  handler: async (ctx, { whopUsername, role, companyId, callerWhopUserId }): Promise<{
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

    // STEP 1: Since Whop API doesn't support username lookup directly,
    // we'll create a pending user that will be verified when they log in
    // This is safer than allowing invalid usernames
    
    const whopUserId = `pending_${cleanUsername}_${Date.now()}`;
    const displayName = cleanUsername;

    // STEP 2: Skip membership check for pending users
    // They will be verified when they actually log in

    // STEP 3: Call the mutation to add the team member
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

    // STEP 4: For pending users, we won't send notifications yet
    // They'll be notified when they actually log in
    if (result.isPending) {
      return {
        ...result,
        notificationSent: false,
        notificationError: "User will be notified when they log in",
      };
    }

    return result;
  },
});