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

    // Handle different webhook events
    switch (webhook.action) {
      case "payment.succeeded":
        console.log("💳 Processing payment.succeeded");

        // Call Convex action to handle payment
        await convex.action(api.webhooks.whop.handlePaymentSucceeded, {
          webhookData: webhook,
        });

        console.log("✅ Payment processed successfully");
        break;

      case "membership.went_valid":
        console.log("✅ Processing membership.went_valid");

        // Call Convex action to handle new membership access
        // This captures company info for experience→company mapping
        await convex.action(api.webhooks.whop.handleMembershipValid, {
          webhookData: webhook,
        });

        console.log("✅ Membership access processed successfully");
        break;

      case "membership.went_invalid":
        console.log("❌ Processing membership.went_invalid");

        // Call Convex action to handle cancellation
        await convex.action(api.webhooks.whop.handleMembershipCancelled, {
          webhookData: webhook,
        });

        console.log("✅ Cancellation processed successfully");
        break;

      default:
        console.log("❓ Unknown webhook action:", webhook.action);
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
