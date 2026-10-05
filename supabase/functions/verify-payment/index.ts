// POST /functions/v1/verify-payment
// { accountId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Verifies the Razorpay signature server-side AND re-fetches the payment
// from Razorpay (status must be captured, order/amount must match), then
// idempotently records payment + activates/extends Pro for the CALLER uid.
// The same payment verified twice yields one period, never two.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { allowedOrigin, preflight, json, err } from "../_shared/http.ts";
import {
  adminClient,
  callerUid,
  hmacHex,
  sigEqual,
  fetchRzpPayment,
  activateProFor,
  daysRemaining,
  PRO_AMOUNT_PAISE,
  PRO_CURRENCY,
  PRO_DAYS,
} from "../_shared/rzp.ts";

serve(async (req: Request) => {
  const origin = allowedOrigin(req);
  if (req.method === "OPTIONS") return preflight(origin);
  if (req.method !== "POST") return err(405, "METHOD_NOT_ALLOWED", "POST only.", origin);
  if (origin === null) return err(403, "FORBIDDEN_ORIGIN", "Origin not allowed.", origin);

  const uid = await callerUid(req);
  if (!uid) return err(401, "UNAUTHENTICATED", "Valid session required.", origin);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "BAD_REQUEST", "Invalid JSON.", origin);
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const accountId = b.accountId;
  const orderId = b.razorpay_order_id;
  const paymentId = b.razorpay_payment_id;
  const signature = b.razorpay_signature;
  if (
    typeof accountId !== "string" || !/^tm_[0-9a-f]{20}$/.test(accountId) ||
    typeof orderId !== "string" || !orderId ||
    typeof paymentId !== "string" || !paymentId ||
    typeof signature !== "string" || !signature
  ) {
    return err(400, "BAD_REQUEST", "Invalid payment details.", origin);
  }

  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
  const admin = adminClient();
  if (!keySecret || !admin) {
    return err(500, "PAYMENTS_UNCONFIGURED", "Payment service is not configured.", origin);
  }

  // 1. Signature check (server secret, never the browser's word).
  const expected = await hmacHex(keySecret, `${orderId}|${paymentId}`);
  if (!sigEqual(expected, signature)) {
    await admin.from("payments").upsert(
      { user_id: uid, razorpay_order_id: orderId, razorpay_payment_id: paymentId, amount: PRO_AMOUNT_PAISE, currency: PRO_CURRENCY, status: "failed", plan: "pro" },
      { onConflict: "razorpay_payment_id" },
    );
    return err(402, "SIGNATURE_INVALID", "Payment could not be verified. No Pro activated.", origin);
  }

  // 2. Server-side payment proof: must be captured for OUR order + ₹99.
  const rzp = await fetchRzpPayment(paymentId);
  if (
    !rzp || rzp.status !== "captured" ||
    rzp.order_id !== orderId ||
    rzp.amount !== PRO_AMOUNT_PAISE ||
    rzp.currency !== PRO_CURRENCY
  ) {
    return err(402, "PAYMENT_NOT_CAPTURED", "Payment is not complete. No Pro activated.", origin);
  }

  // 3. Idempotency + concurrency: claim the payment row atomically. Only
  // the claim winner activates; concurrent duplicates (double-click,
  // retry, webhook racing verify) read back the converged entitlement.
  // Insert the row first when create-order never tracked it (unique
  // payment_id converges concurrent inserts; 23505 means it exists).
  // Insert the row first when create-order never tracked it. Unique
  // payment_id converges concurrent inserts; the atomic claim below is
  // the single decider, so any insert error is harmless here.
  await admin.from("payments").insert({
    user_id: uid,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    amount: PRO_AMOUNT_PAISE,
    currency: PRO_CURRENCY,
    status: "pending",
    plan: "pro",
  });
  const returnCurrentEntitlement = async (already: boolean) => {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan,status,started_at,expires_at")
      .eq("user_id", uid)
      .limit(1);
    const s = (sub as Array<{ plan: string; status: string; started_at: string | null; expires_at: string | null }> | null)?.[0];
    return json(200, {
      success: true,
      alreadyProcessed: already,
      plan: s?.plan ?? "free",
      status: s?.status ?? "inactive",
      startedAt: s?.started_at ?? null,
      expiresAt: s?.expires_at ?? null,
      daysRemaining: daysRemaining(s?.expires_at ?? null),
    }, origin);
  };
  const { data: claimed, error: claimError } = await admin
    .from("payments")
    .update({ status: "processing" })
    .eq("razorpay_payment_id", paymentId)
    .in("status", ["pending", "failed"])
    .select("id");
  if (claimError || !claimed || (claimed as unknown[]).length === 0) {
    return returnCurrentEntitlement(true);
  }

  // 4. Record payment (verified) + activate/extend Pro for the caller only.
  const nowIso = new Date().toISOString();
  const { error: payError } = await admin.from("payments").update({
    user_id: uid,
    razorpay_order_id: orderId,
    status: "verified",
    verified_at: nowIso,
  }).eq("razorpay_payment_id", paymentId);
  if (payError) {
    return err(500, "RECORD_FAILED", "Payment verified but could not be recorded. Contact support.", origin);
  }
  const entitlement = await activateProFor(admin, uid, { orderId, paymentId });
  if (!entitlement) {
    await admin.from("payments").update({ status: "failed" }).eq("razorpay_payment_id", paymentId);
    return err(500, "ACTIVATION_FAILED", "Payment verified but Pro could not be activated. Contact support.", origin);
  }

  // 5. Link stable account -> this uid (convenience for entitlement lookup
  // across anonymous-UID rotation; rows stay uid-keyed and RLS-enforced).
  const phone = typeof b.phone_e164 === "string" ? (b.phone_e164 as string).slice(0, 20) : null;
  await admin.from("account_links").upsert(
    { account_id: accountId, user_id: uid, phone_e164: phone, updated_at: nowIso },
    { onConflict: "account_id" },
  );

  return json(200, { success: true, alreadyProcessed: false, ...entitlement, proDays: PRO_DAYS }, origin);
});
