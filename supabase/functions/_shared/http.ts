// Shared HTTP helpers for TypeMe payment Edge Functions.
// CORS is locked to APP_ORIGIN (comma-separated allowed). No secrets here.

export const allowedOrigin = (req: Request): string | null => {
  const allowed = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get("origin");
  if (allowed.length === 0) return origin;
  if (origin && allowed.includes(origin)) return origin;
  return null;
};

export const preflight = (origin: string | null): Response =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin ?? "",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      vary: "origin",
    },
  });

export const json = (status: number, body: unknown, origin: string | null): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": origin ?? "",
      vary: "origin",
    },
  });

export const err = (status: number, code: string, message: string, origin: string | null): Response =>
  json(status, { success: false, error: code, message }, origin);
