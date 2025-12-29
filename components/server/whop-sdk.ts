"use server";

import { getWhopSdk } from "@/convex/lib/whop";
import { headers } from "next/headers";

export async function verifyUserToken() {
  // Always get fresh headers - Next.js headers() is cached per request
  const headersList = await headers();
  const whopSdk = getWhopSdk();

  try {
    const { userId } = await whopSdk.verifyUserToken(headersList);

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
    return { success: true, userId };
  } catch (error) {
    console.error("[verifyUserToken] Failed to verify Whop user token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
