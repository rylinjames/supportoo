"use server";

import { getWhopSdk } from "@/convex/lib/whop";
import { headers } from "next/headers";

export async function verifyUserToken() {
  // Always get fresh headers - Next.js headers() is cached per request
  const headersList = await headers();
  const whopSdk = getWhopSdk();

  try {
    // Log all headers to debug what Whop sends
    const allHeaders: Record<string, string> = {};
    headersList.forEach((value, key) => {
      if (key.toLowerCase().includes('whop') || key.toLowerCase().includes('company') || key.toLowerCase().includes('experience')) {
        allHeaders[key] = value;
      }
    });
    console.log("[verifyUserToken] Whop-related headers:", JSON.stringify(allHeaders, null, 2));

    // Get the raw user token for API calls
    const rawToken = headersList.get('x-whop-user-token');

    const tokenResult = await whopSdk.verifyUserToken(headersList);
    console.log("[verifyUserToken] Full token result:", JSON.stringify(tokenResult, null, 2));
    const { userId } = tokenResult;

    // Fetch user details to get username
    let username = "unknown";
    try {
      const whopUser = await whopSdk.users.getUser({ userId });
      username = whopUser.username || "unknown";
    } catch (error) {
      console.warn("[verifyUserToken] Failed to fetch username:", error);
    }

    console.log(
      "[verifyUserToken] Authenticated userId:",
      userId,
      "username:",
      username
    );
    return { success: true, userId, userToken: rawToken || undefined };
  } catch (error) {
    console.error("[verifyUserToken] Failed to verify Whop user token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
