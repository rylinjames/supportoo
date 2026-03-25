import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * Whop Webhook Handler
 *
 * Follows Mailoo's proven pattern:
 * 1. Read raw body directly (no signature validation — Whop's SDK validator is unreliable)
 * 2. Use body.type (Standard Webhooks spec) with body.event as fallback
 * 3. Respond with 200 immediately, process async (Whop has 3s timeout)
 */

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable");
}

const convex = new ConvexHttpClient(convexUrl);

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[Webhook] RAW BODY:", JSON.stringify(body, null, 2));

  // Whop Standard Webhooks spec uses "type" for event name.
  // Older integrations use "event" or "action". Support all.
  const event = body.type ?? body.event ?? body.action ?? "";
  const data = body.data ?? body;

  console.log("[Webhook] Event:", event, "| data keys:", Object.keys(data));

  // Log to Convex for debugging
  convex.mutation(api.billing.mutations.logWebhookArrival, {
    message: `Webhook received: ${event}`,
    data: { event, dataKeys: Object.keys(data), membershipId: data?.membership?.id || data?.membership_id || data?.id },
  }).catch(() => {});

  if (!event) {
    console.warn("[Webhook] No event type found, ignoring");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Payment succeeded: activate subscription
  if (event === "payment.succeeded" || event === "payment_succeeded") {
    // Respond immediately, process async (Whop 3s timeout)
    convex.action(api.webhooks.whop.handlePaymentSucceeded, {
      webhookData: body,
    }).catch((err) => console.error("[Webhook] handlePaymentSucceeded error:", err));

    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Membership activated: capture company mapping
  if (
    event === "membership.went_valid" ||
    event === "membership.activated" ||
    event === "membership_activated"
  ) {
    convex.action(api.webhooks.whop.handleMembershipValid, {
      webhookData: body,
    }).catch((err) => console.error("[Webhook] handleMembershipValid error:", err));

    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Membership deactivated/canceled: revert to free
  if (
    event === "membership.went_invalid" ||
    event === "membership.deactivated" ||
    event === "membership_deactivated" ||
    event === "membership.canceled" ||
    event === "membership_canceled" ||
    event === "membership.cancelled" ||
    event === "membership_cancelled"
  ) {
    convex.action(api.webhooks.whop.handleMembershipCancelled, {
      webhookData: body,
    }).catch((err) => console.error("[Webhook] handleMembershipCancelled error:", err));

    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Cancel at period end changed
  if (
    event === "membership.cancel_at_period_end_changed" ||
    event === "membership_cancel_at_period_end_changed"
  ) {
    console.log("[Webhook] Cancel at period end changed — logged");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  console.log("[Webhook] Unhandled event:", event);
  return NextResponse.json({ received: true }, { status: 200 });
}
