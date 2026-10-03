/**
 * OTP provider abstraction — the swap point between demo and production.
 *
 * Architecture:
 *   UI (AuthModal) -> requestOtp / verifyOtp -> provider
 *   Demo provider   -> in-memory simulated codes (DEV or VITE_DEMO_AUTH only)
 *   Production path -> TypeMe backend -> real SMS provider (MSG91 / Twilio /
 *                      2Factor / Exotel). NOT IMPLEMENTED — see REQUIRED env
 *                      list in .env.example. The backend must enforce expiry,
 *                      attempt caps, and rate limits server-side and must mint
 *                      the Supabase session (never the browser).
 *
 * Security rules for this file and its callers:
 * - never log OTPs, never return them to the UI, never put them in URLs
 * - error messages stay generic (no account-existence oracle)
 */

import { OTP_POLICY } from "./otpConfig";

export type OtpRequestResult = { ok: true } | { ok: false; retryAfterSeconds?: number; message: string };
export type OtpVerifyResult = { ok: true } | { ok: false; reason: "invalid" | "expired" | "locked" | "unavailable"; message: string };

export interface OtpProvider {
  readonly id: string;
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

interface DemoRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  lastRequestAt: number;
}

/**
 * In-memory simulated provider for local development and UI testing.
 * Enforces the same client-visible semantics the production backend must
 * implement: expiry, attempt caps, resend cooldown. NEVER active in a
 * production build unless explicitly forced (see isDemoAuthEnabled).
 */
class DevOtpProvider implements OtpProvider {
  readonly id = "dev-simulated";
  private records = new Map<string, DemoRecord>();
  private lastCodeForTestPhone = new Map<string, string>();

  /** Fixed dev credential for the documented test number (dev only). */
  static readonly DEV_PHONE_E164 = "+917760593180";
  static readonly DEV_OTP = "007347";

  private newCode(phone: string): string {
    if (phone === DevOtpProvider.DEV_PHONE_E164) return DevOtpProvider.DEV_OTP;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.lastCodeForTestPhone.set(phone, code);
    return code;
  }

  /** Test hook: read the last issued dev code (never rendered in UI). */
  debugLastCode(phone: string): string | undefined {
    return phone === DevOtpProvider.DEV_PHONE_E164
      ? DevOtpProvider.DEV_OTP
      : this.lastCodeForTestPhone.get(phone);
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

let provider: OtpProvider | null = null;

/** The active provider: demo in dev, otherwise only if explicitly enabled. */
export const getOtpProvider = (): OtpProvider | null => {
  if (!isDemoAuthEnabled()) return null;
  if (!provider) provider = new DevOtpProvider();
  return provider;
};
