/**
 * Stable TypeMe account identity (LOCAL concept — never database ownership).
 *
 * Rule: one normalized phone number ALWAYS resolves to the same account ID,
 * on every login, on every browser, with zero storage. The ID is a
 * deterministic, non-reversible hash of the E.164 number — not random, not
 * time-based, not session-based. Random IDs are still used for PROJECTS
 * (created once each), but the ACCOUNT mapping itself needs no persistence.
 *
 * Hard boundary: this ID scopes local caches/logs only. Supabase ownership
 * is ALWAYS auth.uid() from a live session. This value must never be sent
 * as user_id, stored as a foreign key, or trusted for access control.
 */

const cyrb53 = (str: string, seed = 0): number => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/** Deterministic stable account ID for a normalized E.164 number. */
export const stableAccountIdFor = (e164Phone: string): string => {
  const digits = (e164Phone || "").replace(/\D/g, "");
  const h = cyrb53(`typeme-account-v1:${digits}`, 7).toString(16).padStart(12, "0");
  const h2 = cyrb53(`typeme-account-v1:${digits}`, 99).toString(16).padStart(12, "0");
  return `tm_${h}${h2}`.slice(0, 27);
};
