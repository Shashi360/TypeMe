// POST /functions/v1/create-order  { accountId }
// Creates a Razorpay ₹99 order server-side and records a pending payment.
// Amount/currency/receipt are server-controlled; the browser can influence
// nothing. Requires the caller's Supabase JWT (any authenticated user,
// including anonymous device sessions).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { allowedOrigin, preflight, json, err } from "../_shared/http.ts";
import { adminClient, callerUid, PRO_AMOUNT_PAISE, PRO_CURRENCY } from "../_shared/rzp.ts";

// Per-UID order-creation throttle (in-isolate; abuse backstop, not the control).
const lastOrderAt = new Map<string, number>();
const ORDER_COOLDOWN_MS = 60 * 1000;

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
  const accountId = (body as Record<string, unknown>)?.accountId;
  // Well-formed TypeMe account IDs only (tm_ + 20 hex). Still not proof of
  // ownership — it is a routing hint; money/rows stay uid-keyed server-side.
  if (typeof accountId !== "string" || !/^tm_[0-9a-f]{20}$/.test(accountId)) {
    return err(400, "BAD_ACCOUNT", "Invalid account.", origin);
  }

  const now = Date.now();
  if (now - (lastOrderAt.get(uid) ?? 0) < ORDER_COOLDOWN_MS) {
    return err(429, "TOO_MANY_ORDERS", "Please wait a minute before retrying.", origin);
  }

  const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
  const admin = adminClient();
  if (!keyId || !keySecret || !admin) {
    return err(500, "PAYMENTS_UNCONFIGURED", "Payment service is not configured.", origin);
  }

  const receipt = `TYPEME_PRO_${uid.slice(0, 8)}_${now}`;
  let order: { id: string; amount: number; currency: string };
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amount: PRO_AMOUNT_PAISE,
        currency: PRO_CURRENCY,
        receipt,
        notes: { typeme_account: accountId, typeme_uid: uid },
      }),
    });
    if (!res.ok) return err(502, "ORDER_FAILED", "Could not create the order. Try again.", origin);
    const o = (await res.json()) as { id?: string; amount?: number; currency?: string };
    if (!o.id || o.amount !== PRO_AMOUNT_PAISE || o.currency !== PRO_CURRENCY) {
      return err(502, "ORDER_FAILED", "Could not create the order. Try again.", origin);
    }
    order = { id: o.id, amount: o.amount, currency: o.currency };
  } catch {
    return err(502, "ORDER_FAILED", "Could not create the order. Try again.", origin);
  }

  const { error: dbError } = await admin.from("payments").insert({
    user_id: uid,
    razorpay_order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: "pending",
    plan: "pro",
  });
  if (dbError) {
    // Order exists at Razorpay but untracked: surface retryable failure, log
    // server-side via returned order id. Never expose internals.
    return json(200, {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      untracked: true,
    }, origin);
  }

  lastOrderAt.set(uid, now);
  return json(200, {
    success: true,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
  }, origin);
});
