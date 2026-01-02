"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { getWhopSdk } from "../lib/whop";

export const testAccessCheck = action({
  args: {
    whopUserId: v.string(),
    experienceId: v.string(),
  },
  handler: async (ctx, { whopUserId, experienceId }) => {
    const whopSdk = getWhopSdk();
    
    try {
      console.log("Testing with:", { whopUserId, experienceId });
      console.log("API Key prefix:", process.env.WHOP_API_KEY?.substring(0, 20));
      console.log("App ID:", process.env.NEXT_PUBLIC_WHOP_APP_ID);
      
      // Test 1: Check user access to experience
      console.log("\n1. Testing checkIfUserHasAccessToExperience...");
      const accessCheck = await whopSdk.access.checkIfUserHasAccessToExperience({
        userId: whopUserId,
        experienceId,
      });
      
      console.log("Access check result:", accessCheck);
      
      return {
        success: true,
        accessCheck,
      };
      
    } catch (error) {
      console.error("Error details:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name,
      };
    }
  },
});