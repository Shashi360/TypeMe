/**
 * Supabase session bootstrap (Step 1 of backend integration).
 *
 * When Supabase is configured (URL + anon key present), this establishes a
 * real anonymous Supabase session on app start so the device holds a genuine
 * anon UID for future RLS-backed guest isolation. Everything degrades to
 * local-only mode when unconfigured or when anonymous sign-ins are disabled
 * in the dashboard — the app never breaks and never fakes a session.
 *
 * Deliberately NOT done here: linking anon UID to app data, phone Auth,
 * profile sync. Those land with the backend endpoints.
 */

import { getSupabase } from "./supabaseClient";

let cachedUid: string | null | undefined;

export const ensureSupabaseSession = async (): Promise<string | null> => {
  if (cachedUid !== undefined) return cachedUid;
  const sb = getSupabase();
  if (!sb) {
    cachedUid = null;
    return null;
  }
  try {
    const { data } = await sb.auth.getSession();
    const existing = data.session?.user?.id ?? null;
    if (existing) {
      cachedUid = existing;
      return existing;
    }
    const { data: anon, error } = await sb.auth.signInAnonymously();
    if (error || !anon.session?.user) {
      cachedUid = null;
      return null;
    }
    cachedUid = anon.session.user.id;
    return cachedUid;
  } catch {
    cachedUid = null;
    return null;
  }
};

/** For diagnostics only — never rendered as identity. */
export const getCachedSupabaseUid = (): string | null => cachedUid ?? null;
