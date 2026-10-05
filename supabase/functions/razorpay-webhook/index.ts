// POST /functions/v1/razorpay-webhook
// Razorpay event webhook. Verifies X-Razorpay-Signature over the RAW body
// with RAZORPAY_WEBHOOK_SECRET before trusting anything. Idempotent:
// payment.captured converges with frontend verify on one payment/one
// period via the same atomic claim; duplicates and retries are safe.
// Register this URL in the Razorpay Dashboard after deploying.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { allowedOrigin, preflight, json, err } from "../_shared/http.ts";
import {
  adminClient,
  hmacHex,
  sigEqual,
  activateProFor,
  daysRemaining,
} from "../_shared/rzp.ts";

serve(async (req: Request) => {
  const origin = allowedOrigin(req);
  if (req.method === "OPTIONS") return preflight(origin);
  if (req.method !== "POST") return err(405, "METHOD_NOT_ALLOWED", "POST only.", origin);

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
  const admin = adminClient();
  if (!webhookSecret || !admin) {
    return err(500, "WEBHOOK_UNCONFIGURED", "Webhook is not configured.", origin);
  }

  // Raw body FIRST — signature covers exact bytes, never parsed JSON.
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = await hmacHex(webhookSecret, raw);
  if (!sigEqual(expected, signature)) {
    return err(401, "SIGNATURE_INVALID", "Bad webhook signature.", origin);
  }

  let event: { event?: string; payload?: Record<string, unknown> };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return err(400, "BAD_REQUEST", "Invalid JSON.", origin);
  }

  const entity = (((event.payload ?? {}) as Record<string, unknown>).payment ??
    {}) as { entity?: Record<string, unknown> };
  const p = (entity.entity ?? {}) as Record<string, unknown>;
  const paymentId = typeof p.id === "string" ? (p.id as string) : "";
  const orderId = typeof p.order_id === "string" ? (p.order_id as string) : null;
  if (!paymentId) return json(200, { success: true, ignored: true }, origin);

  if (event.event === "payment.failed") {
    await admin.from("payments").update({ status: "failed" }).eq("razorpay_payment_id", paymentId);
    return json(200, { success: true }, origin);
  }

  if (event.event === "refund.processed" || event.event === "refund.created") {
    // Money went back: revoke access, keep every byte of user data.
    const { data: rows } = await admin
      .from("payments")
      .update({ status: "refunded" })
      .eq("razorpay_payment_id", paymentId)
      .select("user_id");
    const uid = (rows as Array<{ user_id: string }> | null)?.[0]?.user_id;
    if (uid) {
      await admin.from("subscriptions").update({ status: "cancelled" }).eq("user_id", uid);
    }
    return json(200, { success: true }, origin);
  }

  if (event.event !== "payment.captured" && event.event !== "payment.authorized") {
    return json(200, { success: true, ignored: true }, origin);
  }
  if (event.event === "payment.authorized") {
    // Wait for capture; do not activate on authorization holds.
    return json(200, { success: true, ignored: true }, origin);
  }

  // payment.captured: same atomic-claim activation as verify-payment.
  // The row is created by create-order/verify-payment with the payer's
  // UID; a webhook for an unknown payment cannot be attributed to any
  // account, so it is logged and left for the frontend verify to claim.
  const { data: rows } = await admin
    .from("payments")
    .select("user_id,status")
    .eq("razorpay_payment_id", paymentId)
    .limit(1);
  const row = (rows as Array<{ user_id: string | null; status: string }> | null)?.[0];
  if (!row?.user_id) return json(200, { success: true, orphan: true }, origin);
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "processing" })
    .eq("razorpay_payment_id", paymentId)
    .in("status", ["pending", "failed"])
    .select("id");
  if (!claimed || (claimed as unknown[]).length === 0) {
    return json(200, { success: true, alreadyProcessed: true }, origin);
  }
  await admin.from("payments").update({ status: "verified", verified_at: new Date().toISOString() }).eq(
    "razorpay_payment_id",
    paymentId,
  );
  const entitlement = await activateProFor(admin, row.user_id, { orderId, paymentId });
  if (!entitlement) {
    await admin.from("payments").update({ status: "failed" }).eq("razorpay_payment_id", paymentId);
    return err(500, "ACTIVATION_FAILED", "Activation failed; will retry.", origin);
  }
  return json(200, {
    success: true,
    plan: "pro",
    status: "active",
    expiresAt: (entitlement as { expiresAt?: string }).expiresAt ?? null,
    daysRemaining: daysRemaining((entitlement as { expiresAt?: string | null }).expiresAt ?? null),
  }, origin);
});
