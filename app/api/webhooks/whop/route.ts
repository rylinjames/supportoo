import { makeWebhookValidator } from "@whop/api";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { csrfMiddleware } from "@/app/lib/csrf";

/**
 * Whop Webhook Handler
 *
 * Receives webhook events from Whop and processes billing/subscription changes.
 *
 * Events we handle:
 * - payment.succeeded - When a payment is successful (new subscription or renewal)
 * - membership.went_invalid - When a subscription ends/cancels
 */

// Validate required environment variables
const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!webhookSecret) {
  throw new Error("Missing WHOP_WEBHOOK_SECRET environment variable");
}
if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable");
}

// Create webhook validator with secret
const validateWebhook = makeWebhookValidator({
  webhookSecret,
});

// Initialize Convex client
const convex = new ConvexHttpClient(convexUrl);

export async function POST(request: Request) {
  try {
    // Log to Convex immediately so we can see if the request arrives
    try {
      await convex.mutation(api.billing.mutations.logWebhookArrival, {
        message: "Webhook POST received",
        data: { url: request.url, method: request.method, headers: Object.fromEntries([...request.headers.entries()].filter(([k]) => k.startsWith('x-') || k === 'content-type' || k.includes('whop') || k.includes('webhook'))) },
      });
    } catch (e) {
      // Don't let logging failure block the webhook
    }

    console.log("🔔 Webhook received from Whop");

    // Note: CSRF is automatically skipped for webhook endpoints
    // as they use signature validation instead
    const csrfResponse = await csrfMiddleware(request);
    if (csrfResponse) {
      // This shouldn't happen for webhooks, but handle it just in case
      return csrfResponse;
    }

    // Validate the webhook signature to ensure it's from Whop
    const webhook = await validateWebhook(request);

    console.log("✅ Webhook signature validated");
    console.log("📋 Webhook action:", webhook.action);

    // Log the full webhook data for inspection
    console.log("📦 Full webhook data:", JSON.stringify(webhook, null, 2));

    // Log raw action for debugging
    console.log("📋 Raw webhook action:", webhook.action);
    console.log("📋 Webhook keys:", Object.keys(webhook));
    console.log("📋 Webhook data keys:", webhook.data ? Object.keys(webhook.data) : "no data");

    // Handle different webhook events
    // Whop sends action with dots (v2) or underscores (v1) — handle both
    const wh = webhook as any;
    const action = (wh.action || wh.event || wh.type || "")?.replace(/_/g, ".");
    console.log("📋 Normalized action:", action);

    switch (action) {
      case "payment.succeeded":
      case "payment.created":
        console.log("💳 Processing payment event");

        await convex.action(api.webhooks.whop.handlePaymentSucceeded, {
          webhookData: webhook,
        });

        console.log("✅ Payment processed successfully");
        break;

      case "membership.went.valid":
      case "membership.activated":
        console.log("✅ Processing membership activation");

        await convex.action(api.webhooks.whop.handleMembershipValid, {
          webhookData: webhook,
        });

        console.log("✅ Membership access processed successfully");
        break;

      case "membership.went.invalid":
      case "membership.deactivated":
        console.log("❌ Processing membership deactivation");

        await convex.action(api.webhooks.whop.handleMembershipCancelled, {
          webhookData: webhook,
        });

        console.log("✅ Cancellation processed successfully");
        break;

      case "membership.cancel.at.period.end.changed":
        console.log("⏳ Processing cancel at period end change");
        // Log for now — the deactivation webhook handles the actual downgrade
        break;

      default:
        console.log("❓ Unknown webhook action:", webhook.action, "→", action);
        console.log("Ignoring event");
    }

    // IMPORTANT: Return 200 quickly or Whop will retry
    return NextResponse.json(
      { received: true, action: webhook.action },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Webhook processing error:", error);

    // Log the error details
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // In production, you might want to return 500 for actual errors
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}
