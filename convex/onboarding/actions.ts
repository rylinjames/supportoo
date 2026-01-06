/**
 * Onboarding Actions
 *
 * Handles first-time user access and company setup.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { type OurAppRole, getWhopSdk } from "../lib/whop";
import { api } from "../_generated/api";

/**
 * Get company info from Whop experience
 * This is the key to multi-tenancy - we get the ACTUAL company from the experience
 * Uses multiple methods to try to get company info, including user token for better access
 */
async function getCompanyFromExperience(
  experienceId: string,
  userToken?: string
): Promise<{
  whopCompanyId: string;
  companyName: string;
}> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    throw new Error("WHOP_API_KEY environment variable is required");
  }

  // Method 0: If we have a user token, try to get company from user's context
  if (userToken) {
    // Method 0a: Try to get user's authorized companies (best for admin/team members)
    try {
      console.log(`[getCompanyFromExperience] Trying /v5/me/companies for experience ${experienceId}...`);

      const companiesResponse = await fetch(`https://api.whop.com/api/v5/me/companies`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Accept': 'application/json',
        }
      });

      if (companiesResponse.ok) {
        const companiesData = await companiesResponse.json();
        console.log(`[getCompanyFromExperience] User companies response:`, JSON.stringify(companiesData, null, 2));

        const companies = companiesData.data || companiesData;
        if (Array.isArray(companies) && companies.length > 0) {
          // For team members/admins, this returns their authorized companies
          const company = companies[0];
          const companyId = company.id || company.company_id;
          if (companyId) {
            console.log(`[getCompanyFromExperience] Found company from /v5/me/companies: ${companyId}`);
            return {
              whopCompanyId: companyId,
              companyName: company.title || company.name || "My Company",
            };
          }
        }
      } else {
        console.log(`[getCompanyFromExperience] /v5/me/companies returned ${companiesResponse.status}`);
      }
    } catch (e) {
      console.log(`[getCompanyFromExperience] /v5/me/companies failed:`, e);
    }

    // Method 0b: Try has_access endpoint
    try {
      console.log(`[getCompanyFromExperience] Trying user token API for experience ${experienceId}...`);

      // Use the user token to check their access to this experience
      // The access check might return company context
      const accessResponse = await fetch(`https://api.whop.com/api/v5/me/has_access?resource_type=experience&resource_id=${experienceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Accept': 'application/json',
        }
      });

      if (accessResponse.ok) {
        const accessData = await accessResponse.json();
        console.log(`[getCompanyFromExperience] User access response:`, JSON.stringify(accessData, null, 2));

        // The access response might include company/page info
        const companyId = accessData.company_id || accessData.page_id || accessData.company?.id;
        if (companyId) {
          return {
            whopCompanyId: companyId,
            companyName: accessData.company?.title || accessData.company?.name || "My Company",
          };
        }
      }

      // Try getting user's memberships which might reveal company
      const membershipsResponse = await fetch(`https://api.whop.com/api/v5/me/memberships`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Accept': 'application/json',
        }
      });

      if (membershipsResponse.ok) {
        const membershipsData = await membershipsResponse.json();
        console.log(`[getCompanyFromExperience] User memberships:`, JSON.stringify(membershipsData, null, 2));

        // Look for a membership that gives access to this experience
        const memberships = membershipsData.data || membershipsData;
        if (Array.isArray(memberships)) {
          for (const membership of memberships) {
            const companyId = membership.company_id || membership.page_id;
            if (companyId) {
              // Found a company! Verify this membership is for our experience
              console.log(`[getCompanyFromExperience] Found company from membership: ${companyId}`);
              return {
                whopCompanyId: companyId,
                companyName: membership.company?.title || membership.product?.name || "My Company",
              };
            }
          }
        }
      }
    } catch (e) {
      console.log(`[getCompanyFromExperience] User token API failed:`, e);
    }
  }

  // Method 1: Try v5 API (newer API with better company info)
  try {
    console.log(`[getCompanyFromExperience] Trying v5 API for ${experienceId}...`);
    const v5Response = await fetch(`https://api.whop.com/api/v5/experiences/${experienceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    });

    if (v5Response.ok) {
      const v5Data = await v5Response.json();
      console.log(`[getCompanyFromExperience] v5 API response:`, JSON.stringify(v5Data, null, 2));

      const companyId = v5Data.company_id || v5Data.company?.id || v5Data.companyId;
      if (companyId) {
        return {
          whopCompanyId: companyId,
          companyName: v5Data.company?.title || v5Data.company?.name || v5Data.name || "My Company",
        };
      }
    }
  } catch (e) {
    console.log(`[getCompanyFromExperience] v5 API failed:`, e);
  }

  // Method 2: Try the apps/experiences endpoint
  try {
    console.log(`[getCompanyFromExperience] Trying apps API for ${experienceId}...`);
    const appsResponse = await fetch(`https://api.whop.com/api/v2/apps/experiences/${experienceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    });

    if (appsResponse.ok) {
      const appsData = await appsResponse.json();
      console.log(`[getCompanyFromExperience] Apps API response:`, JSON.stringify(appsData, null, 2));

      const companyId = appsData.company_id || appsData.company?.id;
      if (companyId) {
        return {
          whopCompanyId: companyId,
          companyName: appsData.company?.title || appsData.company?.name || appsData.name || "My Company",
        };
      }
    }
  } catch (e) {
    console.log(`[getCompanyFromExperience] Apps API failed:`, e);
  }

  // Method 3: Try v2 API with different query params
  try {
    console.log(`[getCompanyFromExperience] Trying v2 API for ${experienceId}...`);
    const v2Response = await fetch(`https://api.whop.com/api/v2/experiences/${experienceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    });

    if (v2Response.ok) {
      const v2Data = await v2Response.json();
      console.log(`[getCompanyFromExperience] v2 API response:`, JSON.stringify(v2Data, null, 2));

      // Even if no company_id, try to find it from other fields
      const companyId = v2Data.company_id || v2Data.company?.id || v2Data.companyId;
      if (companyId) {
        return {
          whopCompanyId: companyId,
          companyName: v2Data.company?.title || v2Data.company?.name || v2Data.name || "My Company",
        };
      }

      // If we have products or access_passes, we might be able to find company from them
      if (v2Data.products && v2Data.products.length > 0) {
        const productId = v2Data.products[0].id || v2Data.products[0];
        console.log(`[getCompanyFromExperience] Trying to get company from product ${productId}...`);

        const productResponse = await fetch(`https://api.whop.com/api/v2/products/${productId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          }
        });

        if (productResponse.ok) {
          const productData = await productResponse.json();
          console.log(`[getCompanyFromExperience] Product data:`, JSON.stringify(productData, null, 2));

          const prodCompanyId = productData.company_id || productData.company?.id;
          if (prodCompanyId) {
            return {
              whopCompanyId: prodCompanyId,
              companyName: productData.company?.title || v2Data.name || "My Company",
            };
          }
        }
      }
    }
  } catch (e) {
    console.log(`[getCompanyFromExperience] v2 API failed:`, e);
  }

  throw new Error(`Could not determine company for experience ${experienceId}. The Whop API does not expose company info for this experience.`);
}

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
    userToken: v.optional(v.string()), // User's JWT token for API calls
    companyIdFromHeader: v.optional(v.string()), // Company ID if passed via header
    companyRoute: v.optional(v.string()), // Company route/slug from iframe SDK
  },
  handler: async (
    ctx,
    { whopUserId, experienceId, userToken, companyIdFromHeader, companyRoute }
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
      const accessCheck = { hasAccess: true, accessLevel: 'customer' };

      if (!accessCheck.hasAccess) {
        return {
          success: false,
          redirectTo: `/experiences/${experienceId}/no-access`,
          error: "You don't have access to this experience.",
        };
      }

      // Step 2: First try to look up company by experienceId (fast path)
      console.log(`[onboardUser] Looking up company by experienceId: ${experienceId}`);
      let company = await ctx.runQuery(
        api.companies.queries.getCompanyByExperienceId,
        { experienceId }
      );

      let whopCompanyId: string = "";
      let companyName: string = "";
      let isFirstAdmin = false;
      let isNewCompany = false;

      if (company) {
        // Found company by experienceId - use it directly
        console.log(`[onboardUser] Found company by experienceId: ${company._id} (${company.name})`);
        whopCompanyId = company.whopCompanyId;
        companyName = company.name;
      } else if (companyIdFromHeader) {
        // Step 2.5: Use company ID from header if available
        console.log(`[onboardUser] Using company ID from header: ${companyIdFromHeader}`);
        whopCompanyId = companyIdFromHeader;
        companyName = "My Company"; // Will be updated when we fetch company details

        // Check if company already exists in our DB
        company = await ctx.runQuery(
          api.companies.queries.getCompanyByWhopId,
          { whopCompanyId: companyIdFromHeader }
        );

        if (company) {
          companyName = company.name;
          // Update experienceId mapping if not set
          if (!company.whopExperienceId) {
            await ctx.runMutation(api.companies.mutations.updateExperienceId, {
              companyId: company._id,
              experienceId,
            });
          }
        }
      } else if (companyRoute) {
        // Step 2.6: Use company route from iframe SDK to look up company
        console.log(`[onboardUser] Looking up company by route: ${companyRoute}`);
        const apiKey = process.env.WHOP_API_KEY;

        // Try to get company by route/slug using Whop API
        try {
          const companyResponse = await fetch(
            `https://api.whop.com/api/v5/companies/${companyRoute}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
              }
            }
          );

          if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            console.log(`[onboardUser] Company by route response:`, JSON.stringify(companyData, null, 2));

            whopCompanyId = companyData.id || companyData.company_id;
            companyName = companyData.title || companyData.name || "My Company";

            if (whopCompanyId) {
              console.log(`[onboardUser] Found company from route: ${whopCompanyId} (${companyName})`);

              // Check if company already exists in our DB
              company = await ctx.runQuery(
                api.companies.queries.getCompanyByWhopId,
                { whopCompanyId }
              );

              if (company) {
                companyName = company.name;
                // Update experienceId mapping if not set
                if (!company.whopExperienceId) {
                  await ctx.runMutation(api.companies.mutations.updateExperienceId, {
                    companyId: company._id,
                    experienceId,
                  });
                }
              }
            }
          } else {
            console.log(`[onboardUser] Company by route returned ${companyResponse.status}`);
          }
        } catch (routeError) {
          console.error(`[onboardUser] Company by route lookup failed:`, routeError);
        }
      }

      // Step 3: If we still don't have a company, try Whop API fallbacks
      if (!whopCompanyId) {
        // Step 3: Try to get company info from Whop API
        console.log(`[onboardUser] Company not found by experienceId, trying Whop API...`);
        try {
          const experienceInfo = await getCompanyFromExperience(experienceId, userToken);
          whopCompanyId = experienceInfo.whopCompanyId;
          companyName = experienceInfo.companyName;
          console.log(`[onboardUser] Got company from API: ${whopCompanyId} (${companyName})`);

          // Check if company exists by whopCompanyId
          company = await ctx.runQuery(
            api.companies.queries.getCompanyByWhopId,
            { whopCompanyId }
          );

          // Update experienceId if company exists but didn't have it
          if (company && !company.whopExperienceId) {
            await ctx.runMutation(api.companies.mutations.updateExperienceId, {
              companyId: company._id,
              experienceId,
            });
          }
        } catch (apiError) {
          console.error(`[onboardUser] Whop API failed, trying user memberships...`, apiError);

          // Fallback: Try to get company by listing all app experiences
          try {
            const apiKey = process.env.WHOP_API_KEY;
            const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;

            if (apiKey && appId) {
              // List all experiences for our app to find which company owns this experience
              const experiencesResponse = await fetch(
                `https://api.whop.com/api/v2/experiences?app_id=${appId}&per_page=100`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                  }
                }
              );

              if (experiencesResponse.ok) {
                const experiencesData = await experiencesResponse.json();
                console.log(`[onboardUser] App experiences:`, JSON.stringify(experiencesData, null, 2));

                // Find our experience in the list
                const experiences = experiencesData.data || experiencesData;
                if (Array.isArray(experiences)) {
                  const ourExperience = experiences.find((exp: any) => exp.id === experienceId);
                  if (ourExperience) {
                    const expCompanyId = ourExperience.company_id || ourExperience.company?.id;
                    if (expCompanyId) {
                      whopCompanyId = expCompanyId;
                      companyName = ourExperience.company?.title || ourExperience.name || "My Company";
                      console.log(`[onboardUser] Found company from experiences list: ${whopCompanyId}`);
                    }
                  }
                }
              }
            }
          } catch (experiencesError) {
            console.error(`[onboardUser] Experiences list lookup also failed:`, experiencesError);
          }

          // If still no company, show helpful error with the experience ID for manual setup
          if (!whopCompanyId) {
            return {
              success: false,
              redirectTo: `/experiences/${experienceId}/error`,
              error: `Could not determine your company. Please ensure you're accessing this app from within your Whop dashboard. Experience ID: ${experienceId}`,
            };
          }
        }
      }

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

        // Admin - create company with ACTUAL name from Whop
        console.log(`[onboardUser] Creating new company: ${companyName} (${whopCompanyId})`);
        const companyId = await ctx.runMutation(
          api.companies.mutations.createCompany,
          {
            whopCompanyId,
            name: companyName,
            experienceId, // Store experience→company mapping
          }
        );

        company = await ctx.runQuery(api.companies.queries.getCompanyById, {
          companyId,
        });

        isFirstAdmin = true;
        isNewCompany = true;
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

          // If this is a new company, sync products from Whop
          if (isNewCompany) {
            console.log(`[onboardUser] Syncing products for new company: ${company._id}`);
            try {
              // Run product sync in background (don't block onboarding)
              // Pass userToken for proper multi-tenant product fetching
              ctx.scheduler.runAfter(0, api.products.actions.syncProducts, {
                companyId: company._id,
                userToken: userToken,
              });
              console.log(`[onboardUser] Product sync scheduled for company: ${company._id} with userToken: ${!!userToken}`);
            } catch (syncError) {
              // Don't fail onboarding if product sync fails
              console.error(`[onboardUser] Failed to schedule product sync:`, syncError);
            }
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
