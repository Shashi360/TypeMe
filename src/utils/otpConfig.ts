/**
 * Central OTP policy. These values drive client UX (cooldowns, attempt caps,
 * expiry messaging). A production backend MUST enforce the same limits
 * server-side — client checks alone never constitute rate limiting.
 */
export const OTP_POLICY = {
  /** OTP length in digits. */
  length: 6,
  /** OTP validity window (also the message shown to users). */
  expirySeconds: 5 * 60,
  /** Resend cooldown after each request. */
  resendCooldownSeconds: 45,
  /** Max verification attempts per issued code before it is voided. */
  maxAttempts: 5,
  /** Min interval between code requests for the same number (abuse guard). */
  requestThrottleSeconds: 30,
} as const;
