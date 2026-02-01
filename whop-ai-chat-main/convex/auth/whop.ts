/**
 * Whop Authentication Actions
 *
 * Handles user authentication, role verification, and access checks with Whop.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import {
  getWhopSdk,
  mapWhopRoleToAppRole,
  type OurAppRole,
  type WhopAccessLevel,
} from "../lib/whop";
import { getWhopConfig } from "../lib/whop";
import { headers } from "next/headers";

/**
 * Verify user's Whop access and determine their role
 *
 * This is the main authentication entry point.
 * Called when a user first logs in or when we need to refresh their role.
 */

export const verifyWhopUser = action({
  args: {
    experienceId: v.string(),
    userId: v.string(),
  },
  handler: async (
    ctx,
    { experienceId, userId }
  ): Promise<{
    hasAccess: boolean;
    role: OurAppRole | null;
    whopRole?: string;
  }> => {
    const whopSdk = getWhopSdk();

    try {
      // Step 1: Check basic access to our experience

      const accessCheck = await whopSdk.access.checkIfUserHasAccessToExperience(
        {
          userId,
          experienceId,
        }
      );

      if (!accessCheck.hasAccess) {
        return {
          hasAccess: false,
          role: null,
        };
      }

      // Step 2: Determine role based on access level
      const accessLevel = accessCheck.accessLevel as WhopAccessLevel;

      if (accessLevel === "customer") {
        // Regular customer (non-team member)
        return {
          hasAccess: true,
          role: "customer",
          whopRole: "customer",
        };
      }

      if (accessLevel === "admin") {
        // Team member - fetch their actual role from Whop
        try {
          // Get the company ID dynamically from the experience
          const experience = await whopSdk.experiences.getExperience({ experienceId });
          if (!experience || !experience.company) {
            console.warn(`Could not get company from experience ${experienceId}`);
            return {
              hasAccess: true,
              role: "support",
              whopRole: "admin",
            };
          }

          const companyId = experience.company.id;
          console.log(`[verifyWhopUser] Got company ${companyId} from experience ${experienceId}`);

          // Get list of authorized users for this company
          const result = await whopSdk.companies.listAuthorizedUsers({ companyId });
          const authorizedUsers = (result as any)?.authorizedUsers || [];

          // Find this specific user
          const teamMember = authorizedUsers.find((u: any) => u.id === userId);

          if (teamMember) {
            // Map Whop role to app role
            const appRole = mapWhopRoleToAppRole(teamMember.role);
            return {
              hasAccess: true,
              role: appRole,
              whopRole: teamMember.role,
            };
          }

          // If not found in authorized users, default to support
          console.warn(`User ${userId} has admin access but not found in authorized users list`);
          return {
            hasAccess: true,
            role: "support",
            whopRole: "admin",
          };
        } catch (error) {
          console.error("Error fetching user role from Whop:", error);
          // Fallback to support role if API call fails
          return {
            hasAccess: true,
            role: "support",
            whopRole: "admin",
          };
        }
      }

      // No access
      return {
        hasAccess: false,
        role: null,
      };
    } catch (error) {
      console.error("Error verifying Whop user:", error);
      throw new Error("Failed to verify user with Whop");
    }
  },
});

/**
 * Refresh user's role from Whop
 *
 * Called periodically to ensure role is up-to-date.
 * Used for team members whose roles might change in Whop.
 */
export const refreshUserRole = action({
  args: {
    whopUserId: v.string(),
    experienceId: v.string(),
  },
  handler: async (
    ctx,
    { whopUserId, experienceId }
  ): Promise<{
    role: OurAppRole | null;
    whopRole: string | null;
    hasAccess: boolean;
  }> => {
    const whopSdk = getWhopSdk();

    try {
      // Re-check access
      const accessCheck = await whopSdk.access.checkIfUserHasAccessToExperience(
        {
          userId: whopUserId,
          experienceId,
        }
      );

      if (!accessCheck.hasAccess) {
        return {
          hasAccess: false,
          role: null,
          whopRole: null,
        };
      }

      // Check if they're still a team member
      if (accessCheck.accessLevel === "admin") {
        // Default to support for team members
        // TODO: Implement proper role checking with companyId
        return {
          hasAccess: true,
          role: "support",
          whopRole: "admin",
        };
      }

      // Regular customer
      return {
        hasAccess: true,
        role: "customer",
        whopRole: "customer",
      };
    } catch (error) {
      console.error("Error refreshing user role:", error);
      throw new Error("Failed to refresh user role from Whop");
    }
  },
});

/**
 * Get user details from Whop
 *
 * Fetches user profile information (username, display name, avatar, etc.)
 */
export const getWhopUserDetails = action({
  args: {
    accessToken: v.string(), // User's Whop access token
  },
  handler: async (ctx, { accessToken }) => {
    const { appId } = getWhopConfig();
    const { WhopServerSdk } = await import("@whop/api");

    try {
      const userSdk = WhopServerSdk({
        appApiKey: accessToken,
        appId: appId,
      });

      const user = await userSdk.users.getCurrentUser();

      return {
        id: user.user.id,
        username: user.user.username,
        displayName: user.user.name || "",
        email: user.user.email || undefined,
        avatarUrl: user.user.profilePicture?.sourceUrl || undefined,
      };
    } catch (error) {
      console.error("Error fetching Whop user details:", error);
      throw new Error("Failed to fetch user details from Whop");
    }
  },
});

/**
 * List all team members (authorized users)
 *
 * Used for admin dashboard to show team members and their roles.
 */
export const listTeamMembers = action({
  args: {
    companyId: v.string(), // Company ID (biz_XXX)
  },
  handler: async (ctx, { companyId }) => {
    const whopSdk = getWhopSdk();

    try {
      const result = await whopSdk.companies.listAuthorizedUsers({
        companyId,
      });

      if (!result || !result.authorizedUsers) {
        return [];
      }

      return result.authorizedUsers.map((user: any) => ({
        whopUserId: user.id,
        username: user.username,
        displayName: user.name,
        email: user.email,
        avatarUrl: user.profilePicture?.sourceUrl,
        whopRole: user.role,
        appRole: mapWhopRoleToAppRole(user.role),
      }));
    } catch (error) {
      console.error("Error listing team members:", error);
      throw new Error("Failed to list team members from Whop");
    }
  },
});
