// ================================================================
// TYPEME Edge Function: verify-test-otp (test-account session bridge)
//
// Purpose: turn a verified TEST OTP into a REAL Supabase Auth session
// WITHOUT ever exposing secrets, user IDs, or the OTP map to the browser.
//
// Flow:
//   app (test number, DEV only) -> POST { phone, otp }
//   -> validate + rate-limit + compare against server-side TEST_OTP_MAP
//   -> ensure auth.user (admin; phone pre-confirmed, alias email attached)
//   -> admin.generateLink(magiclink) -> return { token_hash }
//   -> app calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
//   -> REAL session, REAL auth.uid(), RLS applies like any normal user.
//
// Production numbers NEVER touch this function: the app routes only
// configured test numbers here (dev builds), everything else uses native
// Supabase phone auth (Twilio) directly. Deploy with:
//   supabase functions deploy verify-test-otp
// Secrets (Dashboard -> Edge Functions -> Secrets, or `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   TEST_OTP_MAP='{"+917760593180":"7760",...}',
//   APP_ORIGIN='http://localhost:5173' (exact web origin; comma-separate more),
//   RATE_WINDOW_S (default 300), RATE_MAX_ATTEMPTS (default 5).
//
// Security notes:
// - The OTP map lives ONLY in function env. Codes are never logged.
// - token_hash is single-use and returned only to the verified caller.
// - Per-isolate in-memory rate limiting is a test-path control; the
//   production SMS path inherits Supabase/Twilio provider limits.
// ================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (status: number, body: string, origin: string | null) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": origin ?? "",
      vary: "origin",
    },
  });

const corsPreflight = (origin: string | null) =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin ?? "",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      vary: "origin",
    },
  });

// Best-effort per-isolate throttle (see header note).
const attempts = new Map<string, number[]>();

serve(async (req: Request) => {
  const allowed = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return corsPreflight(origin);
  if (req.method !== "POST") return json(405, '"method not allowed"', origin);
  if (allowed.length > 0 && (!origin || !allowed.includes(origin))) {
    return json(403, '"forbidden origin"', origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, '"bad request"', origin);
  }
  const phone = (body as Record<string, unknown>)?.phone;
  const otp = (body as Record<string, unknown>)?.otp;
  if (typeof phone !== "string" || typeof otp !== "string") {
    return json(400, '"bad request"', origin);
  }
  if (!/^\+\d{8,15}$/.test(phone) || !/^\d{4,8}$/.test(otp)) {
    return json(400, '"bad request"', origin);
  }

  const windowS = Number(Deno.env.get("RATE_WINDOW_S") ?? "300");
  const maxAttempts = Number(Deno.env.get("RATE_MAX_ATTEMPTS") ?? "5");
  const now = Date.now();
  const recent = (attempts.get(phone) ?? []).filter((t) => now - t < windowS * 1000);
  if (recent.length >= maxAttempts) return json(429, '"too many attempts"', origin);
  recent.push(now);
  attempts.set(phone, recent);

  let testMap: Record<string, string> = {};
  try {
    testMap = JSON.parse(Deno.env.get("TEST_OTP_MAP") ?? "{}") as Record<string, string>;
  } catch {
    testMap = {};
  }
  const expected = testMap[phone];
  if (!expected || otp !== expected) return json(401, '"invalid code"', origin);
  attempts.delete(phone);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceKey) return json(500, '"server misconfigured"', origin);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const digits = phone.replace(/\D/g, "");
  const aliasEmail = `otp-${digits}@testotp.typeme.local`;

  // Ensure one permanent auth.user per test phone (phone pre-confirmed).
  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email: aliasEmail,
    email_confirm: true,
    phone,
    phone_confirm: true,
    user_metadata: { login_phone: phone, test_account: true },
  });
  if (created.data?.user) {
    userId = created.data.user.id;
  } else {
    let page = 1;
    for (;;) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 100 });
      const users = listed.data?.users ?? [];
      const hit = users.find((u) => (u as { phone?: string }).phone === phone);
      if (hit) {
        userId = hit.id;
        break;
      }
      if (users.length < 100 || page >= 20) break;
      page += 1;
    }
  }
  if (!userId) return json(500, '"account error"', origin);

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: aliasEmail });
  const props = (link.data as unknown as {
    properties?: Record<string, unknown>;
    hashed_token?: string;
    hashedToken?: string;
  } | null) ?? null;
  const raw = props?.properties ?? {};
  const tokenHash =
    (raw["hashed_token"] as string | undefined) ??
    (raw["hashedToken"] as string | undefined) ??
    props?.hashed_token ??
    props?.hashedToken;
  if (link.error || !tokenHash) return json(500, '"session error"', origin);

  return json(200, JSON.stringify({ token_hash: tokenHash }), origin);
});
