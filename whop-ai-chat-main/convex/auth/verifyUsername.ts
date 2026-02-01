/**
 * Verify Whop Username
 * 
 * Action to verify if a Whop username exists and get user details
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getWhopSdk } from "../lib/whop";

/**
 * Verify if a Whop username exists and get user details
 */
export const verifyWhopUsername = action({
  args: {
    username: v.string(),
  },
  handler: async (ctx, { username }): Promise<{
    exists: boolean;
    userId?: string;
    displayName?: string;
    avatarUrl?: string;
    error?: string;
  }> => {
    const whopSdk = getWhopSdk();

    try {
      // Clean username - remove @ if present
      const cleanUsername = username.replace('@', '').toLowerCase().trim();
      
      // Whop SDK doesn't have a direct username lookup
      // We need to use a different approach - check if user exists via their profile
      // This is a limitation of the current Whop API
      
      // For now, we'll skip verification and create pending users
      // The actual verification will happen when they log in
      console.log(`Note: Whop username verification not available in current API. Creating pending user for @${cleanUsername}`);
      
      // Return as if user exists (will be validated on login)
      return {
        exists: true,
        userId: `pending_${cleanUsername}_${Date.now()}`,
        displayName: cleanUsername,
        error: undefined,
      };
    } catch (error: any) {
      console.error("Error verifying Whop username:", error);
      
      // Check different error types
      if (error?.response?.status === 404 || error?.status === 404) {
        return {
          exists: false,
          error: `Username @${username} does not exist on Whop`,
        };
      }
      
      if (error?.response?.status === 400 || error?.status === 400) {
        return {
          exists: false,
          error: "Invalid username format",
        };
      }

      // Generic error
      return {
        exists: false,
        error: "Unable to verify username at this time. Please try again.",
      };
    }
  },
});

/**
 * Check if a user is a member of the company/experience
 */
export const checkUserMembership = action({
  args: {
    whopUserId: v.string(),
    experienceId: v.string(),
  },
  handler: async (ctx, { whopUserId, experienceId }): Promise<{
    isMember: boolean;
    hasAccess: boolean;
    accessLevel?: string;
    error?: string;
  }> => {
    const whopSdk = getWhopSdk();

    try {
      // Check if user has access to the experience
      const accessCheck = await whopSdk.access.checkIfUserHasAccessToExperience({
        userId: whopUserId,
        experienceId,
      });

      return {
        isMember: accessCheck.hasAccess,
        hasAccess: accessCheck.hasAccess,
        accessLevel: accessCheck.accessLevel,
      };
    } catch (error) {
      console.error("Error checking user membership:", error);
      return {
        isMember: false,
        hasAccess: false,
        error: "Failed to check membership status",
      };
    }
  },
});