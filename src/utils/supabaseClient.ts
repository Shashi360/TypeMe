/**
 * Supabase client singleton — the future identity/database/security layer.
 *
 * Today TypeMe persistence is local (localStorage). This module is the
 * integration point for production auth + RLS-backed storage WITHOUT
 * changing call sites later: everything reads the client through
 * getSupabase(), which returns null until VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY are configured.
 *
 * Rules:
 * - anon key only (VITE_ = public by definition). NEVER put a service-role
 *   key in a VITE_* variable or import it here.
 * - No Supabase call runs until the user has a real session; local demo
 *   auth never fabricates one.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

/** True only when both public Supabase variables are configured. */
export const isSupabaseConfigured = (): boolean => Boolean(url && anonKey);

/**
 * Returns the shared client, or null when Supabase is not configured.
 * Callers must treat null as "local demo mode" and must not invent a
 * session — auth state comes from supabase.auth.getSession() only.
 */
export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
};
