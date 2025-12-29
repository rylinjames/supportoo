/**
 * Whop SDK Utilities
 *
 * This module provides wrapper functions for interacting with the Whop SDK,
 * including authentication, role checking, and notifications.
 */

"use node";

import { WhopServerSdk } from "@whop/api";
import Whop from "@whop/sdk";

/**
 * Whop Role Types
 */
export type WhopTeamRole = "owner" | "admin" | "moderator" | "sales_manager";
export type WhopAccessLevel = "admin" | "customer" | "no_access";
export type OurAppRole = "admin" | "support" | "customer";

/**
 * Whop API Response Types
 */
export interface WhopAccessCheckResponse {
  hasAccess: boolean;
  accessLevel: WhopAccessLevel;
}

export interface WhopAuthorizedUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: WhopTeamRole;
  profilePicture?: {
    sourceUrl: string;
  };
}

export interface WhopUserData {
  id: string;
  username: string;
  name: string;
  email?: string;
  profilePicture?: {
    sourceUrl: string;
  };
}

/**
 * Maps Whop team role to our app role
 */
export function mapWhopRoleToAppRole(
  whopRole: WhopTeamRole
): "admin" | "support" {
  // Owner & Admin → admin (full control)
  // Sales Manager & Moderator → support (can handle conversations only)
  if (whopRole === "owner" || whopRole === "admin") {
    return "admin";
  }
  return "support";
}

/**
 * Maps Whop access level to our app role
 * For customers (non-team members)
 */
export function mapAccessLevelToRole(
  accessLevel: WhopAccessLevel
): OurAppRole | null {
  if (accessLevel === "customer") {
    return "customer";
  }
  if (accessLevel === "admin") {
    // This means they're a team member, but we need to check their specific role
    return null; // Needs further role check via listAuthorizedUsers
  }
  return null; // no_access
}

/**
 * Get Whop SDK instance
 */
export function getWhopSdk() {
  const { apiKey, appId } = getWhopConfig();
  return WhopServerSdk({
    appApiKey: apiKey,
    appId: appId,
  });
}

/**
 * Get Whop instance
 */
export function getWhopInstance() {
  const { apiKey, appId } = getWhopConfig();
  return new Whop({
    apiKey: apiKey,
    appID: appId,
  });
}

/**
 * Environment Variables
 */
export function getWhopConfig() {
  const apiKey = process.env.WHOP_API_KEY;
  const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;

  if (!apiKey) {
    throw new Error(`WHOP_API_KEY environment variable is required ${apiKey}`);
  }

  if (!appId) {
    throw new Error("WHOP_APP_ID environment variable is required");
  }

  return {
    apiKey,
    appId,
  };
}
