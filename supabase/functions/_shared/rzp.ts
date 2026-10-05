// Shared Razorpay + Supabase-admin helpers. Secrets come ONLY from function
// env (Deno.env) — never from the request, never echoed back.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const PRO_AMOUNT_PAISE = 9900;
export const PRO_CURRENCY = "INR";
export const PRO_DAYS = 30;

const enc = new TextEncoder();

export const hmacHex = async (key: string, msg: string): Promise<string> => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** Constant-shape comparison (avoids throwing on length mismatch). */
export const sigEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const adminClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
};

/** Resolve the caller from its JWT. Null when missing/invalid — never trust body IDs. */
export const callerUid = async (req: Request): Promise<string | null> => {
  const admin = adminClient();
  if (!admin) return null;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data?.user?.id ?? null;
};

export const rzpAuthHeader = (): string | null => {
  const id = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
  if (!id || !secret) return null;
  return "Basic " + btoa(`${id}:${secret}`);
};

export interface RzpPayment {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency: string;
}

/** Server-side payment proof: fetch the payment from Razorpay (key_secret). */
export const fetchRzpPayment = async (paymentId: string): Promise<RzpPayment | null> => {
  const auth = rzpAuthHeader();
  if (!auth) return null;
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { authorization: auth },
  });
  if (!res.ok) return null;
  const p = (await res.json()) as Record<string, unknown>;
  if (typeof p?.id !== "string") return null;
  return {
    id: p.id as string,
    order_id: typeof p.order_id === "string" ? (p.order_id as string) : null,
    status: String(p.status ?? ""),
    amount: Number(p.amount ?? 0),
    currency: String(p.currency ?? ""),
  };
};

export const daysRemaining = (expiresAt: string | null): number => {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 86400000));
};

/** Activate (or extend) Pro for uid. Idempotent per payment: same payment twice = one period. */
export const activateProFor = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  uid: string,
  refs: { orderId: string | null; paymentId: string },
): Promise<Record<string, unknown> | null> => {
  const now = new Date();
  const { data: existing } = await admin
    .from("subscriptions")
    .select("expires_at,status")
    .eq("user_id", uid)
    .limit(1);
  const row = (existing as Array<{ expires_at: string | null; status: string }> | null)?.[0];
  const baseMs =
    row?.expires_at && Date.parse(row.expires_at) > now.getTime()
      ? Date.parse(row.expires_at)
      : now.getTime();
  const expires = new Date(baseMs + PRO_DAYS * 86400000).toISOString();
  const started = row?.expires_at && Date.parse(row.expires_at) > now.getTime() && row.status === "active"
    ? undefined
    : now.toISOString();
  const patch: Record<string, unknown> = {
    user_id: uid,
    plan: "pro",
    status: "active",
    expires_at: expires,
    razorpay_order_id: refs.orderId,
    razorpay_payment_id: refs.paymentId,
    updated_at: now.toISOString(),
  };
  if (started) patch["started_at"] = started;
  const { data, error } = await admin
    .from("subscriptions")
    .upsert(patch, { onConflict: "user_id" })
    .select()
    .single();
  if (error || !data) return null;
  const d = data as { started_at: string | null; expires_at: string | null };
  return {
    plan: "pro",
    status: "active",
    startedAt: d.started_at,
    expiresAt: d.expires_at,
    daysRemaining: daysRemaining(d.expires_at),
  };
};
