// GET /functions/v1/subscription-status
// Authoritative subscription state for the CALLER (JWT-required).
// Resolves across anonymous-UID rotation via account_links: the caller's
// own row first, else the linked account's best active row. Free default
// when nothing is active. Never trusts a client-supplied account ID.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { allowedOrigin, preflight, json, err } from "../_shared/http.ts";
import { adminClient, callerUid, daysRemaining } from "../_shared/rzp.ts";

interface Sub {
  plan: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
}

serve(async (req: Request) => {
  const origin = allowedOrigin(req);
  if (req.method === "OPTIONS") return preflight(origin);
  if (req.method !== "GET") return err(405, "METHOD_NOT_ALLOWED", "GET only.", origin);
  if (origin === null) return err(403, "FORBIDDEN_ORIGIN", "Origin not allowed.", origin);

  const uid = await callerUid(req);
  const admin = adminClient();
  if (!uid || !admin) return err(401, "UNAUTHENTICATED", "Valid session required.", origin);

  const free = { success: true, plan: "free", status: "inactive", startedAt: null, expiresAt: null, daysRemaining: 0 };

  const pickBest = (rows: Sub[] | null): Sub | null => {
    const list = rows ?? [];
    const active = list.filter(
      (s) => s.plan === "pro" && s.status === "active" && s.expires_at && Date.parse(s.expires_at) > Date.now(),
    );
    active.sort((a, b) => Date.parse(b.expires_at as string) - Date.parse(a.expires_at as string));
    return active[0] ?? null;
  };

  const { data: own } = await admin.from("subscriptions").select("plan,status,started_at,expires_at").eq("user_id", uid);
  let best = pickBest(own as Sub[] | null);
  if (!best) {
    const { data: links } = await admin.from("account_links").select("account_id").eq("user_id", uid);
    const accountId = (links as Array<{ account_id: string }> | null)?.[0]?.account_id;
    if (accountId) {
      const { data: siblings } = await admin.from("account_links").select("user_id").eq("account_id", accountId);
      const uids = [...new Set(((siblings as Array<{ user_id: string }> | null) ?? []).map((r) => r.user_id))].filter(
        (id) => id !== uid,
      );
      for (const other of uids.slice(0, 10)) {
        const { data: rows } = await admin
          .from("subscriptions")
          .select("plan,status,started_at,expires_at")
          .eq("user_id", other);
        const hit = pickBest(rows as Sub[] | null);
        if (hit && (!best || Date.parse(hit.expires_at as string) > Date.parse(best.expires_at as string))) best = hit;
        if (best) break;
      }
    }
  }
  if (!best) return json(200, free, origin);
  return json(200, {
    success: true,
    plan: best.plan,
    status: best.status,
    startedAt: best.started_at,
    expiresAt: best.expires_at,
    daysRemaining: daysRemaining(best.expires_at),
  }, origin);
});
