"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Test function to verify what the Whop API returns for company lookup
 * Run from Convex dashboard: Functions -> test/testWhopApi:testCompanyLookup
 */
export const testCompanyLookup = action({
  args: {
    experienceId: v.string(),
    userToken: v.optional(v.string()),
  },
  handler: async (ctx, { experienceId, userToken }): Promise<any> => {
    const apiKey = process.env.WHOP_API_KEY;
    const results: Record<string, any> = {};

    console.log("\n🧪 TESTING WHOP API COMPANY LOOKUP");
    console.log("=".repeat(50));
    console.log(`Experience ID: ${experienceId}`);
    console.log(`User Token provided: ${!!userToken}`);

    // Test 1: /v5/me/companies with user token
    if (userToken) {
      console.log("\n1️⃣ Testing /v5/me/companies with user token...");
      try {
        const response = await fetch("https://api.whop.com/api/v5/me/companies", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userToken}`,
            Accept: "application/json",
          },
        });
        const data = await response.json();
        results["v5_me_companies"] = {
          status: response.status,
          ok: response.ok,
          data: data,
        };
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      } catch (e: any) {
        results["v5_me_companies"] = { error: e.message };
        console.log(`   Error: ${e.message}`);
      }
    }

    // Test 2: /v5/me/has_access with user token
    if (userToken) {
      console.log("\n2️⃣ Testing /v5/me/has_access with user token...");
      try {
        const response = await fetch(
          `https://api.whop.com/api/v5/me/has_access?resource_type=experience&resource_id=${experienceId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${userToken}`,
              Accept: "application/json",
            },
          }
        );
        const data = await response.json();
        results["v5_me_has_access"] = {
          status: response.status,
          ok: response.ok,
          data: data,
        };
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
      } catch (e: any) {
        results["v5_me_has_access"] = { error: e.message };
        console.log(`   Error: ${e.message}`);
      }
    }

    // Test 3: /v5/experiences/{id} with API key
    console.log("\n3️⃣ Testing /v5/experiences with API key...");
    try {
      const response = await fetch(
        `https://api.whop.com/api/v5/experiences/${experienceId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );
      const data = await response.json();
      results["v5_experiences"] = {
        status: response.status,
        ok: response.ok,
        data: data,
      };
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } catch (e: any) {
      results["v5_experiences"] = { error: e.message };
      console.log(`   Error: ${e.message}`);
    }

    // Test 4: /v2/apps/experiences/{id} with API key
    console.log("\n4️⃣ Testing /v2/apps/experiences with API key...");
    try {
      const response = await fetch(
        `https://api.whop.com/api/v2/apps/experiences/${experienceId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        }
      );
      const data = await response.json();
      results["v2_apps_experiences"] = {
        status: response.status,
        ok: response.ok,
        data: data,
      };
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
    } catch (e: any) {
      results["v2_apps_experiences"] = { error: e.message };
      console.log(`   Error: ${e.message}`);
    }

    // Test 5: Search through ALL pages to find the experience
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
    console.log("\n5️⃣ Searching ALL pages for experience...");
    let foundExperience = null;
    let page = 1;
    let totalPages = 1;

    try {
      while (page <= totalPages && page <= 20) { // limit to 20 pages
        const response = await fetch(
          `https://api.whop.com/api/v2/experiences?app_id=${appId}&per_page=100&page=${page}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: "application/json",
            },
          }
        );
        const data = await response.json();
        totalPages = data.pagination?.total_page || 1;

        console.log(`   Page ${page}/${totalPages}: ${data.data?.length || 0} experiences`);

        // Search for our experience
        const exp = data.data?.find((e: any) => e.id === experienceId);
        if (exp) {
          foundExperience = exp;
          console.log(`   ✅ FOUND experience on page ${page}!`);
          console.log(`   Experience data: ${JSON.stringify(exp, null, 2)}`);
          break;
        }
        page++;
      }

      if (!foundExperience) {
        console.log(`   ❌ Experience not found in ${page - 1} pages`);
      }

      results["experience_search"] = {
        found: !!foundExperience,
        data: foundExperience,
        pagesSearched: page - 1,
        totalPages: totalPages,
      };
    } catch (e: any) {
      results["experience_search"] = { error: e.message };
      console.log(`   Error: ${e.message}`);
    }

    return results;
  },
});
