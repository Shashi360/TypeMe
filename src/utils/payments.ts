/**
 * Razorpay payment client — browser side of the production payment flow.
 *
 * Security contract (mirrors the Edge Functions):
 * - The browser NEVER sees key secrets, webhook secrets, or service keys.
 *   The public Key ID arrives per-order from OUR backend, not VITE env.
 * - Amount/currency/expiry are server-determined. A checkout callback alone
 *   never unlocks Pro — only a verified backend response does.
 * - Every call requires a live Supabase session (JWT); without one the
 *   caller routes to login first.
 */

import { getSupabase } from "./supabaseClient";

export type PayState =
  | "IDLE"
  | "CREATING_ORDER"
  | "CHECKOUT_OPEN"
  | "VERIFYING"
  | "SUCCESS"
  | "CANCELLED"
  | "FAILED";

export interface ProOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifiedEntitlement {
  alreadyProcessed: boolean;
  plan: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number;
}

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const functionsBase = (): string | null => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const url = (env?.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
    return url ? `${url}/functions/v1` : null;
  } catch {
    return null;
  }
};

/** Explicit dev-only mock checkout (UI testing pre-deploy). Never in prod. */
export const isDevMockPayEnabled = (): boolean => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return !!env?.DEV && env.VITE_ALLOW_DEV_MOCK_PAY === "true";
  } catch {
    return false;
  }
};

export class PaymentError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const authedFetch = async (path: string, init: RequestInit): Promise<unknown> => {
  const base = functionsBase();
  if (!base) throw new PaymentError("NO_BACKEND", "Payment service is not configured. Please try again later.", false);
  const sb = getSupabase();
  const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  if (!token) throw new PaymentError("NO_SESSION", "Please log in to continue.", false);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), "content-type": "application/json", authorization: `Bearer ${token}` },
    });
  } catch {
    // Network-level failure (offline, DNS, CORS-blocked, or the function
    // URL answers nothing at all). Probe with a plain GET to tell
    // "backend not deployed" (gateway 404) apart from "unreachable".
    // Neither state has taken any money.
    let probeStatus: number | null = null;
    try {
      // A deployed function answers GET (405) with CORS; the gateway
      // answers 404 for missing functions; anything else rejects.
      // No auth header: pure reachability signal.
      const probe = await fetch(`${base}${path}`, { method: "GET" });
      probeStatus = probe.status;
    } catch {
      probeStatus = null;
    }
    if (probeStatus === 404) {
      throw new PaymentError(
        "BACKEND_NOT_DEPLOYED",
        "Payment service is not available yet (server not deployed). No charge was made.",
        true,
      );
    }
    if (probeStatus === null) {
      throw new PaymentError(
        "BACKEND_UNREACHABLE",
        "Payment service is unavailable right now (server offline or not deployed). No charge was made.",
        true,
      );
    }
    throw new PaymentError("NETWORK", "Network error. Your money is safe — retry verification.", true);
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new PaymentError("BAD_RESPONSE", "Payment service returned an invalid response.", true);
  }
  if (!res.ok || body.success !== true) {
    const code = typeof body.error === "string" ? body.error : `HTTP_${res.status}`;
    const message = typeof body.message === "string" ? body.message : "Payment failed. Your TypeMe account is still on Free.";
    throw new PaymentError(code, message, res.status === 429 || res.status >= 500);
  }
  return body;
};

export const createProOrder = async (accountId: string): Promise<ProOrder> => {
  const body = (await authedFetch("/create-order", {
    method: "POST",
    body: JSON.stringify({ accountId }),
  })) as { orderId: string; amount: number; currency: string; keyId: string };
  if (!body.orderId || !body.keyId) {
    throw new PaymentError("BAD_RESPONSE", "Could not create the order. Try again.", true);
  }
  return { orderId: body.orderId, amount: body.amount, currency: body.currency, keyId: body.keyId };
};

export const verifyProPayment = async (args: {
  accountId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  phone_e164?: string | null;
}): Promise<VerifiedEntitlement> => {
  const body = (await authedFetch("/verify-payment", { method: "POST", body: JSON.stringify(args) })) as {
    alreadyProcessed?: boolean;
    plan: string;
    status: string;
    startedAt?: string | null;
    expiresAt?: string | null;
    daysRemaining?: number;
  };
  return {
    alreadyProcessed: body.alreadyProcessed ?? false,
    plan: body.plan,
    status: body.status,
    startedAt: body.startedAt ?? null,
    expiresAt: body.expiresAt ?? null,
    daysRemaining: body.daysRemaining ?? 0,
  };
};

export const fetchSubscriptionStatus = async (): Promise<VerifiedEntitlement & { success: boolean }> => {
  const body = (await authedFetch("/subscription-status", { method: "GET" })) as {
    success: boolean;
    plan: string;
    status: string;
    startedAt?: string | null;
    expiresAt?: string | null;
    daysRemaining?: number;
  };
  return {
    success: true,
    alreadyProcessed: false,
    plan: body.plan,
    status: body.status,
    startedAt: body.startedAt ?? null,
    expiresAt: body.expiresAt ?? null,
    daysRemaining: body.daysRemaining ?? 0,
  };
};

let scriptPromise: Promise<void> | null = null;

/** Load Razorpay Checkout exactly once; honest error when unavailable. */
export const loadRazorpayScript = (): Promise<void> => {
  if (typeof window !== "undefined" && (window as unknown as { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = "https://checkout.razorpay.com/v1/checkout.js";
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        scriptPromise = null;
        reject(new PaymentError("CHECKOUT_UNAVAILABLE", "Payment service could not be loaded. Please try again.", true));
      };
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
};

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (resp: Record<string, unknown>) => void) => void;
}

export const openRazorpayCheckout = (args: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  phone?: string | null;
  accountId: string;
  onSuccess: (r: RazorpaySuccess) => void;
  onDismiss: () => void;
  onFailure: (message: string) => void;
}): void => {
  const Rzp = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => RazorpayInstance }).Razorpay;
  if (!Rzp) throw new PaymentError("CHECKOUT_UNAVAILABLE", "Payment service could not be loaded. Please try again.", true);
  const rzp = new Rzp({
    key: args.keyId,
    amount: args.amount,
    currency: args.currency,
    name: "TypeMe",
    description: "Pro Plan — 30 Days Pro Access",
    order_id: args.orderId,
    prefill: args.phone ? { contact: args.phone } : {},
    notes: { typeme_account: args.accountId },
    theme: { color: "#171717" },
    modal: { ondismiss: () => args.onDismiss() },
  });
  rzp.on("payment.failed", (resp: Record<string, unknown>) => {
    const desc = ((resp.error as Record<string, unknown> | undefined)?.description as string | undefined) || "";
    args.onFailure(desc || "Payment failed. Your TypeMe account is still on Free.");
  });
  rzp.open();
};
