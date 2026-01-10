/**
 * Onboarding Actions
 *
 * Handles first-time user access and company setup.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { type OurAppRole, getWhopSdk, getWhopInstance, fetchWhopUserInfo } from "../lib/whop";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Get company info from Whop experience
 * This is the key to multi-tenancy - we get the ACTUAL company from the experience
 *
 * IMPORTANT: We use /v5/app/experiences FIRST because it's the authoritative source
 * for experience→company mapping. Other methods (like /v5/me/companies) can return
 * the wrong company if a user is admin of multiple companies.
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

  // METHOD 1 (AUTHORITATIVE): Use /v5/app/experiences to get the correct company
  // This endpoint returns ALL experiences for our app with their company_id
  // This is the ONLY reliable way to determine which company owns an experience
  try {
    console.log(`[getCompanyFromExperience] Trying /v5/app/experiences for ${experienceId}...`);
    const appExperiencesResponse = await fetch(`https://api.whop.com/api/v5/app/experiences`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      }
    });

    if (appExperiencesResponse.ok) {
      const appExperiencesData = await appExperiencesResponse.json();
      const experiences = appExperiencesData.data || [];

      // Find the experience that matches our experienceId
      const matchingExperience = experiences.find((exp: any) => exp.id === experienceId);

      if (matchingExperience && matchingExperience.company_id) {
        console.log(`[getCompanyFromExperience] ✅ Found company from /v5/app/experiences: ${matchingExperience.company_id}`);
        return {
          whopCompanyId: matchingExperience.company_id,
          companyName: matchingExperience.name || "My Company",
        };
      } else {
        console.log(`[getCompanyFromExperience] Experience ${experienceId} not found in app experiences list`);
      }
    } else {
      console.log(`[getCompanyFromExperience] /v5/app/experiences returned ${appExperiencesResponse.status}`);
    }
  } catch (e) {
    console.log(`[getCompanyFromExperience] /v5/app/experiences failed:`, e);
  }

  // METHOD 2: Try v5 API for specific experience
  try {
    console.log(`[getCompanyFromExperience] Trying /v5/experiences/${experienceId}...`);
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

  // METHOD 3: Try the apps/experiences endpoint
  try {
    console.log(`[getCompanyFromExperience] Trying /v2/apps/experiences/${experienceId}...`);
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

  // METHOD 4: Try v2 API
  try {
    console.log(`[getCompanyFromExperience] Trying /v2/experiences/${experienceId}...`);
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

      const companyId = v2Data.company_id || v2Data.company?.id || v2Data.companyId;
      if (companyId) {
        return {
          whopCompanyId: companyId,
          companyName: v2Data.company?.title || v2Data.company?.name || v2Data.name || "My Company",
        };
      }
    }
  } catch (e) {
    console.log(`[getCompanyFromExperience] v2 API failed:`, e);
  }

  // METHOD 5 (LAST RESORT): Try user token methods
  // NOTE: These are less reliable because they may return the wrong company
  // if the user is admin of multiple companies
  if (userToken) {
    // Try has_access endpoint - this checks access for the SPECIFIC experience
    try {
      console.log(`[getCompanyFromExperience] Trying /v5/me/has_access for ${experienceId}...`);
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

        const companyId = accessData.company_id || accessData.page_id || accessData.company?.id;
        if (companyId) {
          return {
            whopCompanyId: companyId,
            companyName: accessData.company?.title || accessData.company?.name || "My Company",
          };
        }
      }
    } catch (e) {
      console.log(`[getCompanyFromExperience] has_access API failed:`, e);
    }
  }

  throw new Error(`Could not determine company for experience ${experienceId}. The Whop API does not expose company info for this experience.`);
}

/**
 * Check user's access level via Whop API with retry logic
 *
 * Uses @whop/sdk REST API with COMPANY ID (not experience ID).
 * Returns "admin" for team members (owner/admin/moderator/sales_manager),
 * "customer" for customers with membership, or "no_access".
 *
 * IMPORTANT: Does NOT fall back to viewType (which is unreliable).
 * Instead uses retry with exponential backoff, then DB cache fallback.
 */
async function checkWhopAccessLevel(
  whopUserId: string,
  whopCompanyId: string,
  ctx: any
): Promise<string> {
  const maxRetries = 3;
  const baseDelayMs = 200;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const whop = getWhopInstance();
      console.log(`[checkWhopAccessLevel] Attempt ${attempt + 1}/${maxRetries}: Checking access for user ${whopUserId} to company ${whopCompanyId}`);

      const accessCheck = await whop.users.checkAccess(whopCompanyId, { id: whopUserId });

      console.log(`[checkWhopAccessLevel] API result: has_access=${accessCheck.has_access}, access_level=${accessCheck.access_level}`);

      if (accessCheck.has_access) {
        return accessCheck.access_level; // "admin" or "customer"
      }
      return "no_access";
    } catch (error) {
      console.warn(`[checkWhopAccessLevel] Attempt ${attempt + 1}/${maxRetries} failed:`, error);

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt); // 200ms, 400ms, 800ms
        console.log(`[checkWhopAccessLevel] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  // All retries failed - try DB cache fallback (NOT viewType!)
  console.warn(`[checkWhopAccessLevel] All ${maxRetries} attempts failed, trying DB cache fallback`);

  try {
    const existingUser = await ctx.runQuery(api.users.queries.getUserByWhopUserId, { whopUserId });
    if (existingUser) {
      const company = await ctx.runQuery(api.companies.queries.getCompanyByWhopId, { whopCompanyId });
      if (company) {
        const cachedRole = await ctx.runQuery(
          api.users.multi_company_helpers.getUserRoleInCompany,
          { userId: existingUser._id, companyId: company._id }
        );
        if (cachedRole) {
          console.warn(`[checkWhopAccessLevel] Using cached role from DB: ${cachedRole}`);
          // Map our app roles back to access levels
          return cachedRole === "customer" ? "customer" : "admin";
        }
      }
    }
  } catch (dbError) {
    console.error(`[checkWhopAccessLevel] DB cache lookup also failed:`, dbError);
  }

  // No cached role = first-time user during API outage - fail explicitly
  throw new Error("Unable to verify access with Whop. Please try again in a moment.");
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
    viewType: v.optional(v.string()), // View type from iframe SDK: "app", "admin", "analytics", "preview"
  },
  handler: async (
    ctx,
    { whopUserId, experienceId, userToken, companyIdFromHeader, companyRoute, viewType }
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
      // Step 1: Log viewType (we'll use Whop API for actual access check later)
      // viewType from iframe SDK is unreliable - admins accessing via hub get "app"
      console.log(`[onboardUser] View type from iframe SDK: ${viewType} (will verify via Whop API)`);

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
            console.log(`[onboardUser] Company by route returned ${companyResponse.status}, trying user token methods...`);
            // Route lookup failed - try getCompanyFromExperience which uses userToken
            // This works because userToken has access to the user's companies even if the app's API key doesn't
            try {
              const experienceInfo = await getCompanyFromExperience(experienceId, userToken);
              whopCompanyId = experienceInfo.whopCompanyId;
              companyName = experienceInfo.companyName;
              console.log(`[onboardUser] Got company via user token: ${whopCompanyId} (${companyName})`);

              // Check if company already exists in our DB
              company = await ctx.runQuery(
                api.companies.queries.getCompanyByWhopId,
                { whopCompanyId }
              );

              if (company) {
                companyName = company.name;
                if (!company.whopExperienceId) {
                  await ctx.runMutation(api.companies.mutations.updateExperienceId, {
                    companyId: company._id,
                    experienceId,
                  });
                }
              }
            } catch (userTokenError) {
              console.error(`[onboardUser] User token methods also failed:`, userTokenError);
              // Don't create fake IDs - let it fall through to the error handler below
            }
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

      // Step 4: If company doesn't exist, create it
      // The first person to access the app becomes the admin
      // This is safe because only Whop admins/owners can see the app in their admin area
      if (!company) {
        // First person to access = admin (they can see the app in Whop admin area)
        console.log(`[onboardUser] No company exists, first user ${whopUserId} will create it as admin`);
        isFirstAdmin = true;

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

      // Step 5: Determine user's access level via Whop API
      // This is the AUTHORITATIVE check - uses @whop/sdk REST API with company ID
      // Returns "admin" for team members, "customer" for members, "no_access" otherwise
      // Uses retry logic with DB cache fallback (NOT viewType which is unreliable)
      const accessLevel = await checkWhopAccessLevel(whopUserId, whopCompanyId, ctx);
      console.log(`[onboardUser] Whop API access level: ${accessLevel}`);

      if (accessLevel === "no_access") {
        return {
          success: false,
          redirectTo: `/experiences/${experienceId}/no-access`,
          error: "You don't have access to this company.",
        };
      }

      // Step 6: Determine user's role in our app
      // If this is the first user creating the company, they are admin
      // Otherwise, determine role based on Whop API access level
      let role: OurAppRole;
      if (isFirstAdmin) {
        role = "admin";
        console.log(`[onboardUser] First admin for new company, role: admin`);
      } else {
        role = await determineUserRoleWithVerification(
          whopUserId,
          company._id,
          accessLevel, // Use Whop API access level instead of viewType
          whopCompanyId, // Pass whopCompanyId for re-verification
          ctx
        );
        console.log(`[onboardUser] Determined role: ${role}`);
      }

      // Step 6: Check if user already exists in our DB
      const existingUser = await ctx.runQuery(
        api.users.queries.getUserByWhopUserId,
        {
          whopUserId,
        }
      );

      let user: any;

      if (!existingUser) {
        // Fetch actual user info from Whop API
        console.log(`[onboardUser] Fetching user info from Whop for: ${whopUserId}`);
        const fetchedWhopUser = await fetchWhopUserInfo(whopUserId);

        const whopUser = fetchedWhopUser || {
          id: whopUserId,
          username: `user_${whopUserId.substring(5, 15)}`,
          name: `User`,
          profilePicture: null as any
        };

        console.log(`[onboardUser] User info: username=${whopUser.username}, name=${whopUser.name}`);

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
 * Key rule: If no admins exist for a company, the first person becomes admin.
 */
async function determineUserRole(
  whopUserId: string,
  whopCompanyId: string,
  accessLevel: string,
  ctx: any // Add ctx parameter to access our database
): Promise<OurAppRole> {
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
          `[determineUserRole] User ${whopUserId} already has role: ${existingRole} in company ${company._id}`
        );
        return existingRole;
      }
    }
  }

  // User doesn't have a role yet - check if company has any admins
  const company = await ctx.runQuery(
    api.companies.queries.getCompanyByWhopId,
    { whopCompanyId }
  );

  if (!company) {
    // Company doesn't exist yet, so this will be the first admin
    console.log(`[determineUserRole] Company doesn't exist, ${whopUserId} will be first admin`);
    return "admin";
  }

  // Check if any admins already exist for this company
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

  // If no admins exist yet, this person becomes admin (regardless of accessLevel)
  // This handles the case where viewType="app" but user is actually first admin
  if (adminCount === 0) {
    console.log(
      `[determineUserRole] No admins exist for company ${company._id}, ${whopUserId} will be admin`
    );
    return "admin";
  }

  // Admins exist - use accessLevel to determine role
  if (accessLevel === "admin") {
    // New admin/team member - make them support (can be promoted later)
    console.log(
      `[determineUserRole] ${adminCount} admins exist, ${whopUserId} (accessLevel: admin) will be: support`
    );
    return "support";
  }

  // Regular customer
  console.log(
    `[determineUserRole] ${adminCount} admins exist, ${whopUserId} (accessLevel: ${accessLevel}) will be: customer`
  );
  return "customer";
}

/**
 * Helper: Check if user is an admin/owner of a company via Whop API
 *
 * This calls the /v5/me/companies endpoint with the user's token to check
 * if they own or manage the specified company. This is needed because
 * viewType="app" is returned even for company owners when they access
 * through the hub instead of admin dashboard.
 */
async function checkWhopAdminStatus(
  userToken: string,
  whopCompanyId: string
): Promise<{ isAdmin: boolean; whopRole: string | null }> {
  try {
    console.log(`[checkWhopAdminStatus] Checking if user owns/manages company ${whopCompanyId}`);

    const response = await fetch(
      'https://api.whop.com/api/v5/me/companies',
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Accept': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.log(`[checkWhopAdminStatus] API call failed with status ${response.status}`);
      return { isAdmin: false, whopRole: null };
    }

    const data = await response.json();
    const companies = data.data || data || [];

    console.log(`[checkWhopAdminStatus] User has access to ${Array.isArray(companies) ? companies.length : 'unknown'} companies`);

    // Find the company in user's companies list
    const company = Array.isArray(companies)
      ? companies.find((c: any) => c.id === whopCompanyId)
      : null;

    if (company) {
      // User owns or manages this company
      const whopRole = company.role || company.access_level || 'owner';
      const isAdmin = ['owner', 'admin', 'moderator'].includes(whopRole.toLowerCase());
      console.log(`[checkWhopAdminStatus] User is "${whopRole}" of company ${whopCompanyId}, isAdmin: ${isAdmin}`);
      return { isAdmin, whopRole };
    }

    console.log(`[checkWhopAdminStatus] Company ${whopCompanyId} not found in user's companies`);
    return { isAdmin: false, whopRole: null };
  } catch (error) {
    console.error('[checkWhopAdminStatus] Error:', error);
    return { isAdmin: false, whopRole: null };
  }
}

/**
 * Helper: Determine user's role with Whop API verification
 *
 * Uses the Whop API access level (already verified) to determine the user's role.
 * Also re-verifies existing "customer" roles to fix mis-assigned users.
 *
 * IMPORTANT: Takes companyId directly (not whopCompanyId) to avoid issues
 * with duplicate companies having the same whopCompanyId. The caller should
 * use the company already found via getCompanyByExperienceId.
 */
async function determineUserRoleWithVerification(
  whopUserId: string,
  companyId: Id<"companies">,
  accessLevel: string, // From Whop API: "admin", "customer", or "no_access"
  whopCompanyId: string, // For re-verification of existing customers
  ctx: any
): Promise<OurAppRole> {
  // First, check if this user already exists in our database with a role
  const existingUser = await ctx.runQuery(
    api.users.queries.getUserByWhopUserId,
    { whopUserId }
  );

  // If user already exists, check their role in this specific company
  if (existingUser) {
    const existingRole = await ctx.runQuery(
      api.users.multi_company_helpers.getUserRoleInCompany,
      {
        userId: existingUser._id,
        companyId: companyId,
      }
    );

    if (existingRole) {
      console.log(
        `[determineUserRoleWithVerification] User ${whopUserId} already has role: ${existingRole} in company ${companyId}`
      );

      // RE-VERIFY: If user is stored as "customer" but Whop API says "admin",
      // upgrade them to "support" (they can be promoted to admin manually)
      // This fixes users who were mis-assigned due to viewType="app" issue
      if (existingRole === "customer" && accessLevel === "admin") {
        console.log(
          `[determineUserRoleWithVerification] User ${whopUserId} was customer but Whop API says admin - upgrading to support`
        );
        // Update their role in the database
        await ctx.runMutation(
          api.users.multi_company_helpers.updateUserRoleInCompany,
          {
            userId: existingUser._id,
            companyId: companyId,
            role: "support",
          }
        );
        return "support";
      }

      return existingRole;
    }
  }

  // User doesn't have a role yet - check if company has any admins
  const existingAdmins = await ctx.runQuery(
    api.users.multi_company_helpers.getTeamMembersForCompany,
    {
      companyId: companyId,
    }
  );

  // Filter to only admins
  const adminCount = existingAdmins.filter(
    (member: any) => member.role === "admin"
  ).length;

  // If no admins exist yet, this person becomes admin (regardless of accessLevel)
  if (adminCount === 0) {
    console.log(
      `[determineUserRoleWithVerification] No admins exist for company ${companyId}, ${whopUserId} will be admin`
    );
    return "admin";
  }

  // Admins exist - use Whop API accessLevel to determine role
  if (accessLevel === "admin") {
    // User is a team member in Whop - make them support (can be promoted to admin)
    console.log(
      `[determineUserRoleWithVerification] ${adminCount} admins exist, ${whopUserId} (Whop accessLevel: admin) will be: support`
    );
    return "support";
  }

  // accessLevel is "customer" - assign customer role
  console.log(
    `[determineUserRoleWithVerification] ${adminCount} admins exist, ${whopUserId} (Whop accessLevel: ${accessLevel}) assigned customer role`
  );
  return "customer";
}
