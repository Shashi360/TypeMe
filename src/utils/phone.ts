/**
 * Canonical phone normalization — the single source of truth so
 * +91XXXXXXXXXX, 91XXXXXXXXXX and XXXXXXXXXX never create duplicate users.
 */

export interface NormalizedPhone {
  /** Canonical international format, e.g. "+919876543210". */
  e164: string;
  /** National significant part, e.g. "9876543210". */
  national: string;
  countryCode: string;
}

const INDIA_CC = "91";
const INDIA_NATIONAL_LEN = 10;

export const normalizeIndianPhone = (nationalRaw: string, countryCode = "+91"): NormalizedPhone | null => {
  const ccDigits = countryCode.replace(/\D/g, "");
  let d = nationalRaw.replace(/\D/g, "");
  // Tolerate a pasted full international number ("+91 98765 43210").
  if (ccDigits && d.startsWith(ccDigits) && d.length === ccDigits.length + 10) {
    d = d.slice(ccDigits.length);
  }
  if (ccDigits === INDIA_CC) {
    // Indian mobile numbers: exactly 10 digits starting with 6-9.
    if (!/^[6-9]\d{9}$/.test(d)) return null;
    return { e164: `+${INDIA_CC}${d}`, national: d, countryCode: `+${INDIA_CC}` };
  }
  // Non-Indian codes: accept a sane digit range without mobile-pattern checks.
  if (!/^\d{6,14}$/.test(d)) return null;
  return { e164: `+${ccDigits}${d}`, national: d, countryCode: `+${ccDigits}` };
};

/** Masked display form, e.g. "+91 98765 43210" -> "+91 ••••• 43210". */
export const maskPhone = (e164: string): string => {
  const m = e164.match(/^(\+\d{2})(\d{5})(\d{5})$/);
  if (!m) return e164;
  return `${m[1]} ••••• ${m[3]}`;
};
