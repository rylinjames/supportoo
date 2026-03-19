/**
 * Convex Cron Jobs
 *
 * Scheduled tasks that run periodically.
 */

import { cronJobs } from "convex/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Cleanup stale presence records
 *
 * Runs hourly to remove expired presence records.
 * Prevents database bloat from inactive users.
 * Limited to 100 records per run to prevent timeouts.
 */
crons.hourly(
  "cleanup stale presence",
  { minuteUTC: 0 },
  api.presence.mutations.cleanupStalePresence
);

/**
 * Process scheduled plan changes
 *
 * Runs every hour to execute scheduled downgrades (e.g., after subscription cancellation).
 * When user cancels, we schedule the downgrade for end of billing period.
 * This cron job executes those scheduled changes when the time comes.
 */
crons.interval(
  "process scheduled plan changes",
  { hours: 1 }, // Run every hour
  internal.billing.crons.processScheduledPlanChanges
);

/**
 * Auto-resolve stale conversations
 *
 * Runs daily to resolve conversations with no activity for 7+ days.
 * Prevents stale tickets from cluttering the dashboard.
 */
crons.daily(
  "auto-resolve stale conversations",
  { hourUTC: 4, minuteUTC: 0 }, // 4am UTC
  internal.conversations.autoResolve.autoResolveStaleConversations
);

/**
 * Reset expired usage counters
 *
 * Runs hourly to reset aiResponsesThisMonth for companies whose
 * billing period has ended. Critical for free tier users who don't
 * have payment events to trigger resets.
 */
crons.hourly(
  "reset expired usage",
  { minuteUTC: 30 },
  internal.usage.crons.resetExpiredUsage
);

/**
 * Aggregate daily usage from hourly records
 *
 * Runs daily at midnight UTC to aggregate hourly usage records into daily totals.
 * This provides the data for usage charts and analytics.
 */
crons.interval(
  "aggregate daily usage",
  { hours: 24 }, // Run daily at midnight UTC
  internal.usage.crons.aggregateDailyUsage
);

/**
 * Sync products for all companies
 *
 * Runs every 6 hours to keep product data fresh.
 * Ensures AI has up-to-date product information for customer support.
 */
crons.interval(
  "sync all companies products",
  { hours: 6 }, // Run every 6 hours
  internal.products.actions.syncAllCompaniesProducts
);

export default crons;
