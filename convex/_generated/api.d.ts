/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentPhrases from "../agentPhrases.js";
import type * as agentSettings from "../agentSettings.js";
import type * as ai_assistants from "../ai/assistants.js";
import type * as ai_buildSystemPrompt from "../ai/buildSystemPrompt.js";
import type * as ai_chatCompletions from "../ai/chatCompletions.js";
import type * as ai_debugVectorStore from "../ai/debugVectorStore.js";
import type * as ai_generateResponse from "../ai/generateResponse.js";
import type * as ai_testAI from "../ai/testAI.js";
import type * as auth_verifyUsername from "../auth/verifyUsername.js";
import type * as auth_whop from "../auth/whop.js";
import type * as billing_actions from "../billing/actions.js";
import type * as billing_crons from "../billing/crons.js";
import type * as billing_mutations from "../billing/mutations.js";
import type * as billing_queries from "../billing/queries.js";
import type * as companies_mutations from "../companies/mutations.js";
import type * as companies_queries from "../companies/queries.js";
import type * as conversations_export from "../conversations/export.js";
import type * as conversations_mutations from "../conversations/mutations.js";
import type * as conversations_queries from "../conversations/queries.js";
import type * as crons from "../crons.js";
import type * as internalNotes from "../internalNotes.js";
import type * as lib_whop from "../lib/whop.js";
import type * as messages_mutations from "../messages/mutations.js";
import type * as messages_queries from "../messages/queries.js";
import type * as notifications_whop from "../notifications/whop.js";
import type * as onboarding_actions from "../onboarding/actions.js";
import type * as plans_queries from "../plans/queries.js";
import type * as plans_updateModels from "../plans/updateModels.js";
import type * as presence_mutations from "../presence/mutations.js";
import type * as presence_queries from "../presence/queries.js";
import type * as products_actions from "../products/actions.js";
import type * as products_mutations from "../products/mutations.js";
import type * as products_queries from "../products/queries.js";
import type * as rateLimiter from "../rateLimiter.js";
import type * as seed from "../seed.js";
import type * as seedchatdata from "../seedchatdata.js";
import type * as simulate from "../simulate.js";
import type * as templates_mutations from "../templates/mutations.js";
import type * as templates_queries from "../templates/queries.js";
import type * as templates_utils from "../templates/utils.js";
import type * as test_checkEnv from "../test/checkEnv.js";
import type * as test_testProducts from "../test/testProducts.js";
import type * as test_testWhopAccess from "../test/testWhopAccess.js";
import type * as test_testWhopApi from "../test/testWhopApi.js";
import type * as uploadthing_actions from "../uploadthing/actions.js";
import type * as uploadthing_config from "../uploadthing/config.js";
import type * as usage_actions from "../usage/actions.js";
import type * as usage_crons from "../usage/crons.js";
import type * as usage_mutations from "../usage/mutations.js";
import type * as usage_queries from "../usage/queries.js";
import type * as users_activity from "../users/activity.js";
import type * as users_multi_company_helpers from "../users/multi_company_helpers.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_preferences_mutations from "../users/preferences_mutations.js";
import type * as users_queries from "../users/queries.js";
import type * as users_sync from "../users/sync.js";
import type * as users_team_actions from "../users/team_actions.js";
import type * as users_team_mutations from "../users/team_mutations.js";
import type * as users_team_queries from "../users/team_queries.js";
import type * as utils_transactions from "../utils/transactions.js";
import type * as webhooks_whop from "../webhooks/whop.js";
import type * as workspace_actions from "../workspace/actions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  agentPhrases: typeof agentPhrases;
  agentSettings: typeof agentSettings;
  "ai/assistants": typeof ai_assistants;
  "ai/buildSystemPrompt": typeof ai_buildSystemPrompt;
  "ai/chatCompletions": typeof ai_chatCompletions;
  "ai/debugVectorStore": typeof ai_debugVectorStore;
  "ai/generateResponse": typeof ai_generateResponse;
  "ai/testAI": typeof ai_testAI;
  "auth/verifyUsername": typeof auth_verifyUsername;
  "auth/whop": typeof auth_whop;
  "billing/actions": typeof billing_actions;
  "billing/crons": typeof billing_crons;
  "billing/mutations": typeof billing_mutations;
  "billing/queries": typeof billing_queries;
  "companies/mutations": typeof companies_mutations;
  "companies/queries": typeof companies_queries;
  "conversations/export": typeof conversations_export;
  "conversations/mutations": typeof conversations_mutations;
  "conversations/queries": typeof conversations_queries;
  crons: typeof crons;
  internalNotes: typeof internalNotes;
  "lib/whop": typeof lib_whop;
  "messages/mutations": typeof messages_mutations;
  "messages/queries": typeof messages_queries;
  "notifications/whop": typeof notifications_whop;
  "onboarding/actions": typeof onboarding_actions;
  "plans/queries": typeof plans_queries;
  "plans/updateModels": typeof plans_updateModels;
  "presence/mutations": typeof presence_mutations;
  "presence/queries": typeof presence_queries;
  "products/actions": typeof products_actions;
  "products/mutations": typeof products_mutations;
  "products/queries": typeof products_queries;
  rateLimiter: typeof rateLimiter;
  seed: typeof seed;
  seedchatdata: typeof seedchatdata;
  simulate: typeof simulate;
  "templates/mutations": typeof templates_mutations;
  "templates/queries": typeof templates_queries;
  "templates/utils": typeof templates_utils;
  "test/checkEnv": typeof test_checkEnv;
  "test/testProducts": typeof test_testProducts;
  "test/testWhopAccess": typeof test_testWhopAccess;
  "test/testWhopApi": typeof test_testWhopApi;
  "uploadthing/actions": typeof uploadthing_actions;
  "uploadthing/config": typeof uploadthing_config;
  "usage/actions": typeof usage_actions;
  "usage/crons": typeof usage_crons;
  "usage/mutations": typeof usage_mutations;
  "usage/queries": typeof usage_queries;
  "users/activity": typeof users_activity;
  "users/multi_company_helpers": typeof users_multi_company_helpers;
  "users/mutations": typeof users_mutations;
  "users/preferences_mutations": typeof users_preferences_mutations;
  "users/queries": typeof users_queries;
  "users/sync": typeof users_sync;
  "users/team_actions": typeof users_team_actions;
  "users/team_mutations": typeof users_team_mutations;
  "users/team_queries": typeof users_team_queries;
  "utils/transactions": typeof utils_transactions;
  "webhooks/whop": typeof webhooks_whop;
  "workspace/actions": typeof workspace_actions;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
