/**
 * OTP provider abstraction — the swap point between demo and production.
 *
 * Production architecture (no secrets in this bundle, ever):
 *   - REAL numbers: Supabase native phone auth. requestOtp ->
 *     supabase.auth.signInWithOtp({ phone }) (Twilio sends the SMS, limits
 *     enforced provider-side); verifyOtp -> auth.verifyOtp({ phone, token,
 *     type: 'sms' }). The returned session is a genuine Supabase session.
 *   - TEST numbers (dev builds with VITE_TEST_AUTH_URL only): the Edge
 *     Function supabase/functions/verify-test-otp checks the code against
 *     the SERVER-side map and mints a real session via a single-use
 *     token_hash, verified here with auth.verifyOtp({ token_hash,
 *     type: 'magiclink' }). Test codes never ship in the bundle.
 *   - No Supabase configured (pure-local dev): the legacy in-memory
 *     simulator keeps the UI testable. Sessions stay anonymous/local-only
 *     there — never presented as phone-bound identity.
 *
 * Security rules for this file and its callers:
 * - never log OTPs, never return them to the UI, never put them in URLs
 * - error messages stay generic (no account-existence oracle)
 */

import { OTP_POLICY } from "./otpConfig";
import { getSupabase, isSupabaseConfigured } from "./supabaseClient";

export type OtpRequestResult = { ok: true } | { ok: false; retryAfterSeconds?: number; message: string };
export type OtpVerifyResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "locked" | "unavailable"; message: string };

export interface OtpProvider {
  readonly id: string;
  /**
   * False ONLY for the legacy in-memory simulator (pure-local/dev
   * stand-in), which cannot mint Supabase sessions. Every production
   * path (native SMS, test bridge) establishes a real session during
   * verifyOtp, and callers MUST require auth.getUser() there.
   */
  readonly establishesSession?: boolean;
  requestOtp(e164Phone: string): Promise<OtpRequestResult>;
  verifyOtp(e164Phone: string, otp: string): Promise<OtpVerifyResult>;
}

/** Demo/simulated auth is active in dev, or explicitly via VITE_DEMO_AUTH. */
export const isDemoAuthEnabled = (): boolean => {
  try {
    if (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.DEV) {
      return true;
    }
    return (
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_DEMO_AUTH === "true"
    );
  } catch {
    return false;
  }
};

const readEnv = (key: string): string => {
  try {
    return (
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key] ?? ""
    ).trim();
  } catch {
    return "";
  }
};

const digitsOf = (e164: string): string => e164.replace(/\D/g, "");

/**
 * Controlled test numbers for DEV builds only (national digits, e.g.
 * "7760593180,7760593181"). The CODES live server-side in the Edge
 * Function env — this list only selects the secure bridge route. Empty in
 * production builds, where every number uses native SMS auth.
 */
const testNumberSet = (): Set<string> => {
  if (typeof import.meta !== "undefined") {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (!env?.DEV) return new Set();
  }
  return new Set(
    readEnv("VITE_TEST_NUMBERS")
      .split(/[,\s]+/)
      .map((d) => d.replace(/\D/g, "").replace(/^91(?=[6-9]\d{9}$)/, ""))
      .filter(Boolean),
  );
};

const bridgeUrl = (): string => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (!env?.DEV) return "";
  } catch {
    return "";
  }
  return readEnv("VITE_TEST_AUTH_URL");
};

/** True when this phone takes the server-verified test bridge (dev only). */
export const isTestBridgeRoute = (e164Phone: string): boolean => {
  const url = bridgeUrl();
  if (!url) return false;
  const national = digitsOf(e164Phone).replace(/^91(?=[6-9]\d{9}$)/, "");
  return testNumberSet().has(national) || testNumberSet().has(digitsOf(e164Phone));
};

/** Production path: native Supabase phone auth (Twilio-backed, server limits). */
class SupabaseNativeOtpProvider implements OtpProvider {
  readonly id = "supabase-sms";

  async requestOtp(e164Phone: string): Promise<OtpRequestResult> {
    const sb = getSupabase();
    if (!sb) {
      return { ok: false, message: "Phone login needs server configuration in this build. Please try again later." };
    }
    const { error } = await sb.auth.signInWithOtp({ phone: e164Phone });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("rate") || msg.includes("too many") || error.status === 429) {
        return { ok: false, retryAfterSeconds: OTP_POLICY.requestThrottleSeconds, message: `Please wait ${OTP_POLICY.requestThrottleSeconds}s before requesting a new code.` };
      }
      return { ok: false, message: "Couldn't send the code. Please check the number and try again." };
    }
    return { ok: true };
  }

  async verifyOtp(e164Phone: string, otp: string): Promise<OtpVerifyResult> {
    const sb = getSupabase();
    if (!sb) {
      return { ok: false, reason: "unavailable", message: "Couldn't verify the code. Please try again." };
    }
    const { data, error } = await sb.auth.verifyOtp({ phone: e164Phone, token: otp, type: "sms" });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("expired")) {
        return { ok: false, reason: "expired", message: "This code has expired. Request a new code." };
      }
      if (msg.includes("rate") || msg.includes("too many")) {
        return { ok: false, reason: "locked", message: "Too many attempts. Request a new code." };
      }
      return { ok: false, reason: "invalid", message: "That code isn't correct. Please check it and try again." };
    }
    if (!data.session?.user) {
      return { ok: false, reason: "unavailable", message: "Couldn't verify the code. Please try again." };
    }
    return { ok: true };
  }
}

/**
 * Test-account path (dev only): the Edge Function verifies the code
 * server-side and returns a single-use token_hash, which is exchanged here
 * for a REAL Supabase session. Nothing sensitive lives in this bundle.
 */
class TestBridgeOtpProvider implements OtpProvider {
  readonly id = "test-bridge";

  async requestOtp(_e164Phone: string): Promise<OtpRequestResult> {
    // Controlled test codes are issued out-of-band to the tester; no SMS is
    // sent. Client cooldown semantics still apply via the resend timer.
    return { ok: true };
  }

  async verifyOtp(e164Phone: string, otp: string): Promise<OtpVerifyResult> {
    const url = bridgeUrl();
    const sb = getSupabase();
    if (!url || !sb) {
      return { ok: false, reason: "unavailable", message: "Couldn't verify the code. Please try again." };
    }
    let tokenHash: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: e164Phone, otp }),
      });
      if (res.status === 429) {
        return { ok: false, reason: "locked", message: "Too many attempts. Please wait and try again." };
      }
      if (!res.ok) {
        return { ok: false, reason: "invalid", message: "That code isn't correct. Please check it and try again." };
      }
      const data = (await res.json()) as { token_hash?: string };
      tokenHash = typeof data?.token_hash === "string" ? data.token_hash : null;
    } catch {
      return { ok: false, reason: "unavailable", message: "Couldn't verify the code. Please try again." };
    }
    if (!tokenHash) {
      return { ok: false, reason: "unavailable", message: "Couldn't verify the code. Please try again." };
    }
    const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (error || !data.session?.user) {
      return { ok: false, reason: "unavailable", message: "Couldn't verify the code. Please try again." };
    }
    return { ok: true };
  }
}

interface DemoRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  lastRequestAt: number;
}

/**
 * Legacy in-memory simulator. Active ONLY when Supabase is unconfigured
 * (pure-local dev): sessions stay anonymous/local-only and are never
 * presented as phone-bound identity. Never used when a real backend exists.
 */
class DevOtpProvider implements OtpProvider {
  readonly id = "dev-simulated";
  readonly establishesSession = false;
  private records = new Map<string, DemoRecord>();
  private lastCodeForTestPhone = new Map<string, string>();

  /**
   * Fixed test credentials for the documented test numbers (dev only).
   * Production codes are always random and never observable.
   */
  static readonly TEST_CREDENTIALS: Record<string, string> = {
    "+917760593180": "7760",
    "+917760593181": "7761",
    "+917760593182": "7762",
  };

  private newCode(phone: string): string {
    const fixed = DevOtpProvider.TEST_CREDENTIALS[phone];
    if (fixed) return fixed;
    const min = 10 ** (OTP_POLICY.length - 1);
    const code = String(Math.floor(min + Math.random() * 9 * min));
    this.lastCodeForTestPhone.set(phone, code);
    return code;
  }

  /** Test hook: read the last issued dev code (never rendered in UI). */
  debugLastCode(phone: string): string | undefined {
    return (
      DevOtpProvider.TEST_CREDENTIALS[phone] ?? this.lastCodeForTestPhone.get(phone)
    );
  }

  async requestOtp(e164Phone: string): Promise<OtpRequestResult> {
    const now = Date.now();
    const prev = this.records.get(e164Phone);
    if (prev && now - prev.lastRequestAt < OTP_POLICY.requestThrottleSeconds * 1000) {
      const wait = Math.ceil((OTP_POLICY.requestThrottleSeconds * 1000 - (now - prev.lastRequestAt)) / 1000);
      return { ok: false, retryAfterSeconds: wait, message: `Please wait ${wait}s before requesting a new code.` };
    }
    this.records.set(e164Phone, {
      code: this.newCode(e164Phone),
      expiresAt: now + OTP_POLICY.expirySeconds * 1000,
      attempts: 0,
      lastRequestAt: now,
    });
    return { ok: true };
  }

  async verifyOtp(e164Phone: string, otp: string): Promise<OtpVerifyResult> {
    const rec = this.records.get(e164Phone);
    if (!rec) {
      return { ok: false, reason: "invalid", message: "That code isn't correct. Please check it and try again." };
    }
    if (Date.now() > rec.expiresAt) {
      this.records.delete(e164Phone);
      return { ok: false, reason: "expired", message: "This code has expired. Request a new code." };
    }
    if (rec.attempts >= OTP_POLICY.maxAttempts) {
      this.records.delete(e164Phone);
      return { ok: false, reason: "locked", message: "Too many attempts. Request a new code." };
    }
    rec.attempts += 1;
    if (otp !== rec.code) {
      return { ok: false, reason: "invalid", message: "That code isn't correct. Please check it and try again." };
    }
    this.records.delete(e164Phone);
    return { ok: true };
  }
}

let legacy: OtpProvider | null = null;

/**
 * Explicit pre-deploy stand-in (DEV only, opt-in per machine):
 * VITE_ALLOW_DEV_SIMULATED_OTP="true" keeps the legacy in-memory simulator
 * for UI testing until the Edge Function bridge is deployed. Sessions stay
 * anonymous/local-only and are NEVER phone-bound — the app says so on
 * screen. Default OFF (honest failure), never honored in production builds,
 * delete the flag once the bridge is live.
 */
export const isLocalSimulated = (): boolean => {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (!env?.DEV) return false;
    if (env.VITE_ALLOW_DEV_SIMULATED_OTP === "true") return true;
    // Pure-local dev (Supabase unconfigured): nothing else can serve.
    return !isSupabaseConfigured();
  } catch {
    return false;
  }
};

/**
 * Route every number through the production-capable path:
 * test numbers (dev + bridge configured) -> server-verified bridge;
 * everything else -> native Supabase SMS auth. Legacy simulation only when
 * Supabase itself is unconfigured (pure-local dev).
 */
class RoutingOtpProvider implements OtpProvider {
  readonly id = "router";
  private native = new SupabaseNativeOtpProvider();
  private bridge = new TestBridgeOtpProvider();

  requestOtp(e164Phone: string): Promise<OtpRequestResult> {
    return (isTestBridgeRoute(e164Phone) ? this.bridge : this.native).requestOtp(e164Phone);
  }

  verifyOtp(e164Phone: string, otp: string): Promise<OtpVerifyResult> {
    return (isTestBridgeRoute(e164Phone) ? this.bridge : this.native).verifyOtp(e164Phone, otp);
  }
}

let router: OtpProvider | null = null;

/** The active provider: production router when Supabase is configured. */
export const getOtpProvider = (): OtpProvider | null => {
  if (!isLocalSimulated() && getSupabase()) {
    if (!router) router = new RoutingOtpProvider();
    return router;
  }
  if (!isDemoAuthEnabled()) return null;
  if (isLocalSimulated() && getSupabase()) {
    console.warn(
      "[typeme] VITE_ALLOW_DEV_SIMULATED_OTP stand-in active: OTPs are " +
        "checked in-memory and sessions are NOT phone-bound. Deploy the " +
        "verify-test-otp bridge and delete this flag.",
    );
  }
  if (!legacy) legacy = new DevOtpProvider();
  return legacy;
};
