/**
 * Onboarding Actions
 *
 * Handles first-time user access and company setup.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { type OurAppRole } from "../lib/whop";
import { api } from "../_generated/api";

/**
 * Main onboarding flow
 *
 * Called when a user accesses the app for the first time.
 * Determines if they're the first admin, creates company if needed,
 * and decides where to redirect them.
 */
export const onboardUser = action({
  args: {
    whopUserId: v.string(),
    experienceId: v.string(), // From URL params in frontend
  },
  handler: async (
    ctx,
    { whopUserId, experienceId }
  ): Promise<{
    success: boolean;
    redirectTo: string;
    message?: string;
    error?: string;
    userData?: {
      user: {
        _id: string;
        whopUserId: string;
        whopUsername: string;
        displayName: string;
        avatarUrl?: string;
        timezone?: string;
        createdAt: number;
        updatedAt: number;
      };
      currentCompanyId: string;
      userCompanies: Array<{
        companyId: string;
        role: OurAppRole;
        companyName: string;
        joinedAt: number;
        lastActiveInCompany: number;
      }>;
      isFirstAdmin: boolean;
      setupComplete: boolean;
    };
  }> => {
    try {
      // Step 1: Verify user has access to our experience (using REST API)
      // For now, we'll assume users have access if they can authenticate
      // The v2 API doesn't have a direct access check endpoint
      const accessCheck = { hasAccess: true, accessLevel: 'customer' };
      
      // Try to determine access level from user's role
      // This will be refined in determineUserRole function

      if (!accessCheck.hasAccess) {
        return {
          success: false,
          redirectTo: `/experiences/${experienceId}/no-access`,
          error: "You don't have access to this experience.",
        };
      }

      // Step 2: Get company ID from experience
      // Since we control the experience, we can use the configured company ID
      const whopCompanyId = process.env.NEXT_PUBLIC_WHOP_COMPANY_ID || 'biz_2T7tC1fnFVo6d4';

      // Step 3: Check if company exists in our DB
      let company = await ctx.runQuery(
        api.companies.queries.getCompanyByWhopId,
        {
          whopCompanyId,
        }
      );

      let isFirstAdmin = false;

      // Step 4: If company doesn't exist, handle based on role
      if (!company) {
        // Only admins can create the company
        if (accessCheck.accessLevel !== "admin") {
          return {
            success: false,
            redirectTo: `/experiences/${experienceId}/setup-required`,
            error:
              "Your company hasn't been set up yet. Please contact your admin to complete the setup.",
          };
        }

        // Admin - create company
        // For now, use a default name - can be updated later
        const companyId = await ctx.runMutation(
          api.companies.mutations.createCompany,
          {
            whopCompanyId,
            name: `BooKoo Apps`,
          }
        );

        company = await ctx.runQuery(api.companies.queries.getCompanyById, {
          companyId,
        });

        isFirstAdmin = true;
      }

      if (!company) {
        throw new Error("Failed to create company");
      }

      // Step 5: Determine user's role
      const role = await determineUserRole(
        whopUserId,
        whopCompanyId,
        accessCheck.accessLevel,
        ctx
      );

      console.log("Role:", role);

      // Step 6: Check if user already exists in our DB
      const existingUser = await ctx.runQuery(
        api.users.queries.getUserByWhopUserId,
        {
          whopUserId,
        }
      );

      let user: any;

      if (!existingUser) {
        // NEW: Check for pending user by username
        // Use default user data for now - can be enhanced later
        const whopUser = {
          id: whopUserId,
          username: `user_${whopUserId.substring(5, 15)}`,
          name: `User`,
          profilePicture: null as any
        };

        const pendingUser = await ctx.runQuery(
          api.users.queries.getUserByWhopUsername,
          { whopUsername: whopUser.username }
        );

        if (pendingUser && pendingUser.whopUserId.startsWith("pending_")) {
          // Upgrade pending user to real user
          await ctx.runMutation(api.users.sync.upgradePendingUser, {
            userId: pendingUser._id,
            whopUserId,
            displayName: whopUser.name || whopUser.username,
            avatarUrl: whopUser.profilePicture?.sourceUrl || undefined,
          });

          user = await ctx.runQuery(api.users.queries.getUserById, {
            userId: pendingUser._id,
          });

          // Check if they need to be added to this company
          const existingRelationship = await ctx.runQuery(
            api.users.multi_company_helpers.getUserRoleInCompany,
            { userId: pendingUser._id, companyId: company._id }
          );

          if (!existingRelationship) {
            await ctx.runMutation(
              api.users.multi_company_helpers.createUserCompanyRelationship,
              { userId: pendingUser._id, companyId: company._id, role }
            );
          }
        } else {
          // Create new user (without companyId/role - these go in junction table)
          const userId = await ctx.runMutation(api.users.sync.createUser, {
            whopUserId,
            whopUsername: whopUser.username,
            displayName: whopUser.name || whopUser.username,
            avatarUrl: whopUser.profilePicture?.sourceUrl || undefined,
          });

          // Create user-company relationship
          await ctx.runMutation(
            api.users.multi_company_helpers.createUserCompanyRelationship,
            {
              userId,
              companyId: company._id,
              role,
            }
          );

          // Get the full user object after creation
          user = await ctx.runQuery(api.users.queries.getUserById, {
            userId,
          });

          // If this is the first admin creating the company, copy default templates
          if (isFirstAdmin && role === "admin") {
            await ctx.runMutation(
              api.templates.mutations.copyDefaultTemplates,
              {
                companyId: company._id,
              }
            );
          }
        }
      } else {
        // Use existing user - check if they already have a relationship with this company
        const existingRelationship = await ctx.runQuery(
          api.users.multi_company_helpers.getUserRoleInCompany,
          {
            userId: existingUser._id,
            companyId: company._id,
          }
        );

        if (!existingRelationship) {
          // User exists but not in this company - add them
          await ctx.runMutation(
            api.users.multi_company_helpers.createUserCompanyRelationship,
            {
              userId: existingUser._id,
              companyId: company._id,
              role,
            }
          );
        }

        user = existingUser;
      }

      // Step 7: Check if setup is complete
      const setupComplete = company.onboardingCompleted;

      // Step 8: Determine redirect based on role and setup status
      // if (!setupComplete) {
      //   if (role === "admin") {
      //     // Admin - send to setup wizard
      //     return {
      //       success: true,
      //       redirectTo: `/experiences/${experienceId}/onboarding/setup-wizard`,
      //       message:
      //         "Welcome! Please complete the setup wizard to get started.",
      //       userData: {
      //         user: {
      //           _id: user._id,
      //           whopUserId: user.whopUserId,
      //           whopUsername: user.whopUsername,
      //           displayName: user.displayName,
      //           avatarUrl: user.avatarUrl,
      //           timezone: user.timezone,
      //           createdAt: user.createdAt,
      //           updatedAt: user.updatedAt,
      //         },
      //         currentCompanyId: company._id,
      //         userCompanies: [
      //           {
      //             companyId: company._id,
      //             role,
      //             companyName: company.name,
      //             joinedAt: Date.now(),
      //             lastActiveInCompany: Date.now(),
      //           },
      //         ],
      //         isFirstAdmin,
      //         setupComplete: false,
      //       },
      //     };
      //   } else {
      //     // Support/Customer - block access
      //     return {
      //       success: false,
      //       redirectTo: `/experiences/${experienceId}/setup-in-progress`,
      //       error:
      //         "Your admin is still setting up the AI agent. Please check back soon.",
      //     };
      //   }
      // }

      // Setup complete - redirect to appropriate screen
      const redirectTo =
        role === "customer"
          ? `/experiences/${experienceId}/customer-view?customerId=${user._id}`
          : `/experiences/${experienceId}/`;

      return {
        success: true,
        redirectTo,
        userData: {
          user: {
            _id: user._id,
            whopUserId: user.whopUserId,
            whopUsername: user.whopUsername,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            timezone: user.timezone,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          currentCompanyId: company._id,
          userCompanies: [
            {
              companyId: company._id,
              role,
              companyName: company.name,
              joinedAt: Date.now(),
              lastActiveInCompany: Date.now(),
            },
          ],
          isFirstAdmin,
          setupComplete: true,
        },
      };
    } catch (error) {
      console.error("Error during onboarding:", error);
      return {
        success: false,
        redirectTo: `/experiences/${experienceId}/error`,
        error: "An error occurred during onboarding. Please try again.",
      };
    }
  },
});

/**
 * Helper: Determine user's role in our app
 *
 * Maps Whop access level to our internal role (admin/support/customer).
 */
async function determineUserRole(
  whopUserId: string,
  whopCompanyId: string,
  accessLevel: string,
  ctx: any // Add ctx parameter to access our database
): Promise<OurAppRole> {
  if (accessLevel === "customer") {
    return "customer";
  }

  if (accessLevel === "admin") {
    // First, check if this user already exists in our database
    const existingUser = await ctx.runQuery(
      api.users.queries.getUserByWhopUserId,
      { whopUserId }
    );

    // If user already exists, check their role in this specific company
    if (existingUser) {
      const company = await ctx.runQuery(
        api.companies.queries.getCompanyByWhopId,
        { whopCompanyId }
      );

      if (company) {
        const existingRole = await ctx.runQuery(
          api.users.multi_company_helpers.getUserRoleInCompany,
          {
            userId: existingUser._id,
            companyId: company._id,
          }
        );

        if (existingRole) {
          console.log(
            `User ${whopUserId} already exists with role: ${existingRole} in company ${company._id}`
          );
          return existingRole;
        }
      }
    }

    // User doesn't exist yet - apply first-admin logic
    // First, we need to get the company ID from our database
    const company = await ctx.runQuery(
      api.companies.queries.getCompanyByWhopId,
      { whopCompanyId }
    );

    if (!company) {
      // Company doesn't exist yet, so this will be the first admin
      console.log(`Company doesn't exist, ${whopUserId} will be first admin`);
      return "admin";
    }

    // Check if any admins already exist for this company using junction table
    const existingAdmins = await ctx.runQuery(
      api.users.multi_company_helpers.getTeamMembersForCompany,
      {
        companyId: company._id,
      }
    );

    // Filter to only admins
    const adminCount = existingAdmins.filter(
      (member: any) => member.role === "admin"
    ).length;

    // If no admins exist yet, this person becomes admin
    // Otherwise, they become support (can be promoted later)
    const role = adminCount === 0 ? "admin" : "support";
    console.log(
      `Found ${adminCount} existing admins, ${whopUserId} will be: ${role}`
    );
    return role;
  }

  // Fallback
  return "customer";
}
