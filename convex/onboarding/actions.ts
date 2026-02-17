/**
 * Onboarding Actions
 *
 * Handles first-time user access and company setup.
 */

"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { type OurAppRole, getWhopSdk, getWhopInstance, fetchWhopUserInfo, getWhopConfig } from "../lib/whop";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Detect and assign the correct subscription plan using Whop's checkAccess API.
 *
 * Implements the "Calloo model" — subscriptions tied to products:
 * 1. Fetch all app products, identify Ticketoo tier products by name
 * 2. For each tier product, call checkAccess(productId, userId) to see if user has access
 * 3. App developers get access_level "admin" → always elite
 * 4. Customers who purchased a tier get access_level "customer" → that tier
 * 5. Fallback: product.company_id match (legacy) → elite
 * 6. No access to any tier products → keep current plan
 *
 * This works for ALL cases: app developer on any company, paying customers, free users.
 */
async function detectAndAssignPlan(
  ctx: any,
  companyId: Id<"companies">,
  whopCompanyId: string,
  whopUserId: string
): Promise<void> {
  try {
    const { apiKey } = getWhopConfig();
    const whop = getWhopInstance();
    const tierHierarchy: Record<string, number> = { free: 0, pro: 1, elite: 2 };

    console.log(`[detectAndAssignPlan] Detecting tier for company ${whopCompanyId}, user ${whopUserId}`);

    // Fetch all app products (paginated)
    let allProducts: any[] = [];
    let page = 1;
    const maxPages = 5;

    while (page <= maxPages) {
      const res = await fetch(
        `https://api.whop.com/api/v5/app/products?page=${page}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) {
        console.error(`[detectAndAssignPlan] Products API returned ${res.status}`);
        return;
      }

      const data = await res.json();
      allProducts = allProducts.concat(data.data || []);

      if (!data.pagination?.next_page) break;
      page = data.pagination.next_page;
    }

    console.log(`[detectAndAssignPlan] Fetched ${allProducts.length} app products`);

    // Build product-to-tier map from Ticketoo product names
    const productTierMap: Record<string, string> = {};
    for (const product of allProducts) {
      const name = (product.name || "").toLowerCase();
      if (name.includes("ticketoo professional")) {
        productTierMap[product.id] = "elite";
      } else if (name.includes("ticketoo starter")) {
        productTierMap[product.id] = "pro";
      } else if (name.includes("ticketoo free")) {
        productTierMap[product.id] = "free";
      }
    }

    const tierProductIds = Object.keys(productTierMap);
    console.log(`[detectAndAssignPlan] Found ${tierProductIds.length} Ticketoo tier products`);

    if (tierProductIds.length === 0) {
      console.log(`[detectAndAssignPlan] No Ticketoo tier products found, skipping`);
      return;
    }

    // Use Whop's checkAccess API (Calloo model) to see which products this user has access to.
    // This works for both app developers (access_level: "admin") and
    // customers who purchased a tier (access_level: "customer").
    // Check from highest tier down so we can stop early.
    const sortedProducts = tierProductIds.sort(
      (a, b) => (tierHierarchy[productTierMap[b]] || 0) - (tierHierarchy[productTierMap[a]] || 0)
    );

    let highestTier: string | null = null;
    let highestLevel = 0;
    let isAdmin = false;

    for (const productId of sortedProducts) {
      try {
        const accessResult = await whop.users.checkAccess(productId, { id: whopUserId });
        const tier = productTierMap[productId];
        console.log(`[detectAndAssignPlan] checkAccess(${productId}) → has_access=${accessResult.has_access}, level=${accessResult.access_level}, tier=${tier}`);

        if (accessResult.has_access) {
          const tierLevel = tierHierarchy[tier] || 0;
          if (tierLevel > highestLevel) {
            highestLevel = tierLevel;
            highestTier = tier;
          }
          if (accessResult.access_level === "admin") {
            isAdmin = true;
          }
        }
      } catch (accessError) {
        console.error(`[detectAndAssignPlan] checkAccess failed for ${productId}:`, accessError);
      }
    }

    // App developers (admin access) always get elite, even if no specific tier product matched
    if (isAdmin && highestLevel < tierHierarchy["elite"]) {
      highestTier = "elite";
      highestLevel = tierHierarchy["elite"];
      console.log(`[detectAndAssignPlan] User is admin (app developer) → forcing elite tier`);
    }

    // Fallback: also check product.company_id match (covers edge cases where
    // checkAccess may not return admin for the developer's other companies)
    if (!highestTier) {
      const ownsProducts = allProducts.some(
        (p: any) => p.company_id === whopCompanyId
      );
      if (ownsProducts) {
        highestTier = "elite";
        highestLevel = tierHierarchy["elite"];
        console.log(`[detectAndAssignPlan] Company owns products (company_id match) → elite tier`);
      }
    }

    if (!highestTier || highestLevel === 0) {
      console.log(`[detectAndAssignPlan] No access to any Ticketoo tier products, keeping current plan`);
      return;
    }

    console.log(`[detectAndAssignPlan] Detected tier: ${highestTier} (admin=${isAdmin})`);

    const targetPlan = await ctx.runQuery(api.plans.queries.getPlanByName, {
      name: highestTier as "free" | "pro" | "elite",
    });
    if (!targetPlan) {
      console.error(`[detectAndAssignPlan] Plan "${highestTier}" not found`);
      return;
    }

    const company = await ctx.runQuery(api.companies.queries.getCompanyById, { companyId });
    if (!company) return;

    // Only upgrade, never downgrade via auto-detection
    const currentPlan = await ctx.runQuery(api.plans.queries.getPlanById, {
      planId: company.planId,
    });
    const currentLevel = currentPlan ? (tierHierarchy[currentPlan.name] || 0) : 0;

    if (highestLevel > currentLevel) {
      await ctx.runMutation(api.companies.mutations.updatePlan, {
        companyId,
        planId: targetPlan._id,
        resetUsage: true,
      });
      console.log(`[detectAndAssignPlan] Upgraded from ${currentPlan?.name || "unknown"} to ${highestTier}`);
    } else {
      console.log(`[detectAndAssignPlan] Already on ${currentPlan?.name || "unknown"}, no upgrade needed`);
    }
  } catch (error) {
    // Don't fail onboarding if tier detection fails
    console.error(`[detectAndAssignPlan] Error during tier detection:`, error);
  }
}

/**
 * Fetch the Whop business/store name from the Whop API
 *
 * This returns the actual store/brand name (e.g., "BooKoo Apps") rather than
 * the experience/app installation name (e.g., "support ai chat test").
 *
 * Uses retry logic and multiple API endpoints for reliability.
 */
async function fetchWhopBusinessName(whopCompanyId: string): Promise<string | null> {
  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    console.log(`[fetchWhopBusinessName] Missing WHOP_API_KEY`);
    return null;
  }

  const maxRetries = 3;
  const retryDelayMs = 500;

  // METHOD 1: Try /v2/businesses endpoint (primary)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[fetchWhopBusinessName] Attempt ${attempt}/${maxRetries} - /v2/businesses/${whopCompanyId}...`);
      const response = await fetch(
        `https://api.whop.com/api/v2/businesses/${whopCompanyId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        }
      );

      if (response.ok) {
        const data = await response.json();
        const businessName = data.title || data.name || null;
        if (businessName) {
          console.log(`[fetchWhopBusinessName] ✅ Got business name from /v2/businesses: ${businessName}`);
          return businessName;
        }
      } else if (response.status === 429) {
        // Rate limited - wait longer before retry
        console.log(`[fetchWhopBusinessName] Rate limited, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt * 2));
      } else {
        console.log(`[fetchWhopBusinessName] /v2/businesses returned ${response.status}`);
      }
    } catch (e) {
      console.log(`[fetchWhopBusinessName] Attempt ${attempt} failed:`, e);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
      }
    }
  }

  // METHOD 2: Try /v5/app/companies endpoint (fallback)
  try {
    console.log(`[fetchWhopBusinessName] Trying /v5/app/companies fallback...`);
    const companiesResponse = await fetch(
      `https://api.whop.com/api/v5/app/companies`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (companiesResponse.ok) {
      const companiesData = await companiesResponse.json();
      const companies = companiesData.data || [];
      const matchingCompany = companies.find((c: any) => c.id === whopCompanyId);
      if (matchingCompany) {
        const businessName = matchingCompany.title || matchingCompany.name || null;
        if (businessName) {
          console.log(`[fetchWhopBusinessName] ✅ Got business name from /v5/app/companies: ${businessName}`);
          return businessName;
        }
      }
    }
  } catch (e) {
    console.log(`[fetchWhopBusinessName] /v5/app/companies fallback failed:`, e);
  }

  // METHOD 3: Try /v5/companies/{id} endpoint (second fallback)
  try {
    console.log(`[fetchWhopBusinessName] Trying /v5/companies/${whopCompanyId} fallback...`);
    const companyResponse = await fetch(
      `https://api.whop.com/api/v5/companies/${whopCompanyId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (companyResponse.ok) {
      const companyData = await companyResponse.json();
      const businessName = companyData.title || companyData.name || null;
      if (businessName) {
        console.log(`[fetchWhopBusinessName] ✅ Got business name from /v5/companies: ${businessName}`);
        return businessName;
      }
    }
  } catch (e) {
    console.log(`[fetchWhopBusinessName] /v5/companies fallback failed:`, e);
  }

  console.log(`[fetchWhopBusinessName] ❌ All methods failed for ${whopCompanyId}`);
  return null;
}

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
        // Fetch the actual business/store name instead of using experience name
        const businessName = await fetchWhopBusinessName(matchingExperience.company_id);
        return {
          whopCompanyId: matchingExperience.company_id,
          companyName: businessName || matchingExperience.name || "My Company",
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
        // Fetch the actual business/store name instead of using experience name
        const businessName = await fetchWhopBusinessName(companyId);
        return {
          whopCompanyId: companyId,
          companyName: businessName || v5Data.company?.title || v5Data.company?.name || v5Data.name || "My Company",
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
        // Fetch the actual business/store name instead of using experience name
        const businessName = await fetchWhopBusinessName(companyId);
        return {
          whopCompanyId: companyId,
          companyName: businessName || appsData.company?.title || appsData.company?.name || appsData.name || "My Company",
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
        // Fetch the actual business/store name instead of using experience name
        const businessName = await fetchWhopBusinessName(companyId);
        return {
          whopCompanyId: companyId,
          companyName: businessName || v2Data.company?.title || v2Data.company?.name || v2Data.name || "My Company",
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
          // Fetch the actual business/store name instead of using experience name
          const businessName = await fetchWhopBusinessName(companyId);
          return {
            whopCompanyId: companyId,
            companyName: businessName || accessData.company?.title || accessData.company?.name || "My Company",
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
 * Check if user is in the authorized team members list
 *
 * This is a secondary check to catch cases where checkAccess returns "customer"
 * but the user is actually a team member (e.g., a mod who also has a customer membership).
 * Uses listAuthorizedUsers which returns the actual team member list.
 */
async function isUserInAuthorizedTeam(
  whopUserId: string,
  whopCompanyId: string
): Promise<{ isTeamMember: boolean; whopRole: string | null }> {
  try {
    const whopSdk = getWhopSdk();
    console.log(`[isUserInAuthorizedTeam] Checking if ${whopUserId} is in team for company ${whopCompanyId}`);

    const result = await whopSdk.companies.listAuthorizedUsers({
      companyId: whopCompanyId,
    });

    const authorizedUsers = result?.authorizedUsers || [];
    console.log(`[isUserInAuthorizedTeam] Found ${authorizedUsers.length} authorized users`);

    // Find this user in the team members list
    const teamMember = authorizedUsers.find((u: any) => u.id === whopUserId);

    if (teamMember) {
      console.log(`[isUserInAuthorizedTeam] User ${whopUserId} IS a team member with role: ${teamMember.role}`);
      return { isTeamMember: true, whopRole: teamMember.role };
    }

    console.log(`[isUserInAuthorizedTeam] User ${whopUserId} is NOT in the team members list`);
    return { isTeamMember: false, whopRole: null };
  } catch (error) {
    console.error(`[isUserInAuthorizedTeam] Error checking team membership:`, error);
    // If API fails, assume not a team member (safer - they can be invited)
    return { isTeamMember: false, whopRole: null };
  }
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
        // SECURITY: Verify the header value against authoritative API before trusting it
        console.log(`[onboardUser] Verifying company ID from header: ${companyIdFromHeader}`);

        // First check if we already have this company - if so, trust it (already verified)
        company = await ctx.runQuery(
          api.companies.queries.getCompanyByWhopId,
          { whopCompanyId: companyIdFromHeader }
        );

        if (company) {
          // Company exists and was previously verified
          console.log(`[onboardUser] Header company verified (exists in DB): ${company._id}`);
          whopCompanyId = companyIdFromHeader;
          companyName = company.name;
          // Update experienceId mapping if not set
          if (!company.whopExperienceId) {
            await ctx.runMutation(api.companies.mutations.updateExperienceId, {
              companyId: company._id,
              experienceId,
            });
          }
        } else {
          // New company from header - verify against Whop API before trusting
          console.log(`[onboardUser] New company from header, verifying with Whop API...`);
          const apiKey = process.env.WHOP_API_KEY;

          try {
            // Verify this experienceId actually belongs to the claimed company
            const experienceInfo = await getCompanyFromExperience(experienceId, userToken);

            if (experienceInfo.whopCompanyId === companyIdFromHeader) {
              // Header matches API - safe to use
              console.log(`[onboardUser] ✅ Header verified: ${companyIdFromHeader} matches API`);
              whopCompanyId = companyIdFromHeader;
              companyName = experienceInfo.companyName || "My Company";
            } else {
              // Header doesn't match API - use API value instead (potential injection attempt)
              console.warn(`[onboardUser] ⚠️ Header mismatch! Header: ${companyIdFromHeader}, API: ${experienceInfo.whopCompanyId}`);
              console.warn(`[onboardUser] Using API value for security`);
              whopCompanyId = experienceInfo.whopCompanyId;
              companyName = experienceInfo.companyName || "My Company";
            }
          } catch (verifyError) {
            // Can't verify - don't trust header, fall through to other methods
            console.warn(`[onboardUser] Could not verify header company ID: ${verifyError}`);
            console.warn(`[onboardUser] Not trusting unverified header value`);
            // Don't set whopCompanyId - let it fall through to other methods
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

      // Step 4.5: Auto-fix company name on EVERY login
      // This ensures companies always have the correct business/store name, not experience name
      // Runs for both new and existing companies since API might fail initially
      if (whopCompanyId) {
        const correctBusinessName = await fetchWhopBusinessName(whopCompanyId);

        // Check if we need to update: either the name is wrong OR it looks like an experience name
        const currentName = company.name;
        const looksLikeExperienceName = currentName.toLowerCase().includes('support') &&
                                        currentName.toLowerCase().includes('chat') ||
                                        currentName.toLowerCase() === 'my company' ||
                                        currentName.startsWith('exp_');

        if (correctBusinessName && (correctBusinessName !== currentName || looksLikeExperienceName)) {
          console.log(`[onboardUser] ✅ Auto-fixing company name from "${currentName}" to "${correctBusinessName}"`);
          await ctx.runMutation(api.companies.mutations.updateCompanyName, {
            companyId: company._id,
            name: correctBusinessName,
          });
          // Update local reference for use in response
          companyName = correctBusinessName;
        } else if (!correctBusinessName && looksLikeExperienceName) {
          console.log(`[onboardUser] ⚠️ Company name "${currentName}" looks like experience name but couldn't fetch correct name`);
        }
      }

      // Step 4.6: Auto-detect and assign plan based on product ownership
      // This implements the "Calloo model" - subscriptions tied to products.
      // App owners get elite tier, customers get tier based on their Whop membership.
      await detectAndAssignPlan(ctx, company._id, whopCompanyId, whopUserId);
      // Re-fetch company in case plan was updated
      company = await ctx.runQuery(api.companies.queries.getCompanyById, {
        companyId: company._id,
      });
      if (!company) {
        throw new Error("Failed to re-fetch company after plan detection");
      }

      // Step 5: Determine user's access level via Whop API
      // This is the AUTHORITATIVE check - uses @whop/sdk REST API with company ID
      // Returns "admin" for team members, "customer" for members, "no_access" otherwise
      // Uses retry logic with DB cache fallback (NOT viewType which is unreliable)
      let accessLevel = await checkWhopAccessLevel(whopUserId, whopCompanyId, ctx);
      console.log(`[onboardUser] Whop API access level: ${accessLevel}`);

      if (accessLevel === "no_access") {
        return {
          success: false,
          redirectTo: `/experiences/${experienceId}/no-access`,
          error: "You don't have access to this company.",
        };
      }

      // Step 5.5: IMPORTANT - Double-check team membership if accessLevel is "customer"
      // The checkAccess API can return "customer" for users who are BOTH team members AND customers
      // (e.g., a mod who also purchased a product). We need to verify against listAuthorizedUsers.
      if (accessLevel === "customer") {
        const teamCheck = await isUserInAuthorizedTeam(whopUserId, whopCompanyId);
        if (teamCheck.isTeamMember) {
          console.log(`[onboardUser] ⚠️ User ${whopUserId} was marked as "customer" but IS a team member (${teamCheck.whopRole}). Upgrading accessLevel to "admin".`);
          accessLevel = "admin"; // Treat them as a team member
        }
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
          // New user - auto-add based on Whop-verified access level:
          // 1. First admin creating the company (isFirstAdmin) → admin
          // 2. Whop team member (accessLevel "admin") → support (promotable to admin)
          // 3. Customer with valid membership → customer
          // We trust Whop's access control - if they verified the user, they belong here.

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
          // User exists but not in this company yet.
          // Auto-add them with their Whop-verified role.
          // Whop's checkAccess API already confirmed they have access to this company,
          // so we trust that and create the relationship.
          console.log(`[onboardUser] Auto-adding existing user ${whopUserId} to company ${company._id} with role: ${role}`);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error during onboarding:", errorMessage);
      console.error("  experienceId:", experienceId);
      console.error("  whopUserId:", whopUserId);
      console.error("  companyIdFromHeader:", companyIdFromHeader);
      console.error("  companyRoute:", companyRoute);
      console.error("  viewType:", viewType);
      if (error instanceof Error && error.stack) {
        console.error("  Stack:", error.stack);
      }
      return {
        success: false,
        redirectTo: `/experiences/${experienceId}/error`,
        error: `An error occurred during onboarding: ${errorMessage}`,
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
            newRole: "support",
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
