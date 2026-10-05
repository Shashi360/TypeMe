/**
 * Supabase data-access layer — the ONLY module that talks to Supabase tables.
 *
 * Ownership rules (enforced by DB RLS; this layer just doesn't lie):
 * - Never accept a user_id argument from callers. The uid always comes from
 *   the live Supabase session and is included in writes so RLS
 *   `WITH CHECK (user_id = auth.uid())` passes; a spoofed id fails closed.
 * - Reads never filter by a caller-supplied id — RLS already restricts rows
 *   to the caller. Queries select broadly and let policies decide.
 * - Every function throws UNAUTHENTICATED when there is no session. Callers
 *   fall back to local mode; nothing here ever fabricates identity.
 *
 * Until Supabase Auth is wired to phone login, getSessionUid() returns null
 * and the app behaves exactly as today (localStorage). No dead writes, no
 * silent forks: local remains the source of truth while unauthenticated.
 */

import { getSupabase } from "./supabaseClient";
import { ensureSupabaseSession } from "./supabaseSession";
import type { CharacterData, CharacterCategory, FontProject, Stroke } from "../types";
import { ALL_CHARACTERS } from "./sampleData";

export const NOT_CONFIGURED = "supabase-unconfigured";
export const UNAUTHENTICATED = "supabase-unauthenticated";

const sessionUid = async (): Promise<string> => {
  if (pinnedUid) return pinnedUid;
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id ?? null;
  if (!uid) throw new Error(UNAUTHENTICATED);
  return uid;
};

/**
 * Pin the UID for a multi-operation flight (establish, save). Concurrent
 * sign-ins must never produce split-brain writes (project under uid A,
 * glyphs under uid B): every op in the flight uses one UID, so the flight
 * either fully succeeds or fails closed via RLS. Always unpin in finally.
 */
let pinnedUid: string | null = null;
export const pinSessionUid = (uid: string | null): void => {
  pinnedUid = uid;
};

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  plan_snapshot: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  completed_at: string | null;
}

export const listProjects = async (): Promise<DbProject[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbProject[];
};

export const createProject = async (name: string, description: string): Promise<DbProject> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  const uid = await sessionUid();
  const { data, error } = await sb
    .from("projects")
    .insert({ name, description, user_id: uid })
    .select()
    .single();
  if (error) throw error;
  return data as DbProject;
};

export interface DbGlyphInput {
  character: string;
  variant_number: number;
  strokes: Stroke[];
  status: string;
  is_saved: boolean;
}

/** Upsert by (project_id, character, variant_number) — autosave never duplicates. */
export const upsertGlyph = async (
  projectId: string,
  glyph: DbGlyphInput,
): Promise<void> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  const uid = await sessionUid();
  const { error } = await sb.from("glyphs").upsert(
    {
      project_id: projectId,
      user_id: uid,
      character: glyph.character,
      variant_number: glyph.variant_number,
      stroke_data: glyph.strokes,
      status: glyph.status,
      is_saved: glyph.is_saved,
      saved_at: glyph.is_saved ? new Date().toISOString() : null,
    },
    { onConflict: "project_id,character,variant_number" },
  );
  if (error) throw error;
};

export const listGlyphs = async (projectId: string): Promise<unknown[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { data, error } = await sb.from("glyphs").select("*").eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []) as unknown[];
};

export const readMyEntitlement = async (): Promise<unknown> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { data, error } = await sb.rpc("get_my_entitlement");
  if (error) throw error;
  return data;
};

const MIGRATION_FLAG_PREFIX = "typeme_migrated_";
// Global claim registry: local project id -> { uid, phone } of the login
// that already claimed it. Another PHONE can never steal it; the SAME phone
// may reclaim it under a fresh session (anonymous UIDs rotate per login,
// phone identity is stable). Legacy string entries (uid only) are honored
// conservatively: same-uid reuse only.
const CLAIM_KEY = "typeme_claimed_local";

interface ClaimRecord {
  u: string;
  p?: string | null;
}

const readClaimed = (): Record<string, ClaimRecord | string> => {
  try {
    return JSON.parse(localStorage.getItem(CLAIM_KEY) || "{}") as Record<string, ClaimRecord | string>;
  } catch {
    return {};
  }
};

const claimAllows = (
  entry: ClaimRecord | string | undefined,
  uid: string,
  loginPhone: string | null,
): boolean => {
  if (!entry) return true;
  if (typeof entry === "string") return entry === uid;
  if (entry.u === uid) return true;
  return !!loginPhone && !!entry.p && entry.p === loginPhone;
};

const DEV_LOG =
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: Record<string, string | boolean | undefined> })
    .env?.DEV === true;

export interface LocalProjectLike {
  id: string;
  name: string;
  description: string;
  status: string;
  characters: Record<string, CharacterData>;
  createdAt: string;
  updatedAt: string;
}

/**
 * One-time local → Supabase migration. Runs only with a live session, is
 * idempotent per uid (flag), preserves names/glyphs/variants/timestamps,
 * verifies by re-read, and never deletes local data. Returns the number of
 * projects migrated (0 when already done or when Supabase is unavailable).
 */
export const migrateLocalProjectsToSupabase = async (
  localProjects: LocalProjectLike[],
  loginPhoneE164: string | null = null,
): Promise<number> => {
  // Establish the backend session first (anonymous UID when enabled).
  // No session, no migration — local data stays exactly as it is.
  await ensureSupabaseSession().catch(() => {});
  const sb = getSupabase();
  if (!sb) return 0;
  const uid = await sessionUid().catch(() => null);
  if (!uid) return 0;

  const flag = `${MIGRATION_FLAG_PREFIX}${uid}`;
  try {
    if (localStorage.getItem(flag) === "1") return 0;
  } catch {
    return 0;
  }

  // localId -> server uuid map: the idempotency record. A local project
  // already mapped is never inserted again, even across crashed runs.
  const mapKey = `typeme_server_ids_${uid}`;
  let idMap: Record<string, string> = {};
  try {
    idMap = JSON.parse(localStorage.getItem(mapKey) || "{}") as Record<string, string>;
  } catch {
    idMap = {};
  }

  let migrated = 0;
  let mapDirty = false;
  const claimed = readClaimed();
  let claimedDirty = false;
  for (const lp of localProjects) {
    if (idMap[lp.id]) continue;
    // Another login identity already claimed this local project: never
    // migrate one account's leftovers into a different account. The same
    // phone may reclaim under a fresh session (see claimAllows).
    if (!claimAllows(claimed[lp.id], uid, loginPhoneE164)) continue;
    const { data, error } = await sb
      .from("projects")
      .insert({
        user_id: uid,
        name: lp.name,
        description: lp.description,
        status: lp.status === "generated" ? "generated" : "draft",
      })
      .select()
      .single();
    if (error || !data) continue;
    const row = data as DbProject;

    for (const [char, cd] of Object.entries(lp.characters ?? {})) {
      const strokes = (cd as CharacterData)?.strokes ?? [];
      if (!strokes.length) continue;
      await upsertGlyph(row.id, {
        character: char,
        variant_number: 0,
        strokes,
        status: "good",
        is_saved: true,
      }).catch(() => {});
      const variants = ((cd as CharacterData)?.variants ?? []) as Stroke[][];
      for (let i = 0; i < variants.length; i++) {
        if (!variants[i]?.length) continue;
        await upsertGlyph(row.id, {
          character: char,
          variant_number: i + 1,
          strokes: variants[i],
          status: "good",
          is_saved: true,
        }).catch(() => {});
      }
    }
    idMap[lp.id] = row.id;
    mapDirty = true;
    claimed[lp.id] = { u: uid, p: loginPhoneE164 };
    claimedDirty = true;
    migrated += 1;
  }

  // Persist the map, then verify by re-read before marking complete.
  // Local data is never deleted either way.
  if (mapDirty) {
    try {
      localStorage.setItem(mapKey, JSON.stringify(idMap));
    } catch {
      // ignore
    }
  }
  if (claimedDirty) {
    try {
      localStorage.setItem(CLAIM_KEY, JSON.stringify(claimed));
    } catch {
      // ignore
    }
  }
  const verify = await listProjects().catch(() => null);
  const serverIds = new Set((verify ?? []).map((p) => p.id));
  const allPresent = Object.values(idMap).every((id) => serverIds.has(id));
  if (allPresent) {
    try {
      localStorage.setItem(flag, "1");
    } catch {
      // ignore
    }
  }
  if (DEV_LOG) {
    console.info(
      `[typeme] migrate uid=${uid} migrated=${migrated} serverProjects=${serverIds.size}`,
    );
  }
  return migrated;
};

// ---------------------------------------------------------------------------
// Authenticated dashboard data source. Every function below derives ownership
// from the live Supabase session (auth.uid() via RLS) — callers never pass a
// user_id. Without a session each throws UNAUTHENTICATED and the app stays
// in local/guest mode.
// ---------------------------------------------------------------------------

export interface DbGlyphRow {
  id: string;
  project_id: string;
  user_id: string;
  character: string;
  variant_number: number;
  stroke_data: Stroke[];
  status: string | null;
  is_saved: boolean | null;
  updated_at?: string;
}

const guessCategory = (ch: string): CharacterCategory => {
  if (/^[A-Z]$/.test(ch)) return "uppercase";
  if (/^[a-z]$/.test(ch)) return "lowercase";
  if (/^[0-9]$/.test(ch)) return "numbers";
  return "symbols";
};

/**
 * Normalize one server project + its glyph rows into the existing FontProject
 * model. variant_number 0 is the main glyph; 1..n become variants[] in order.
 */
export const normalizeServerProject = (
  row: DbProject,
  glyphRows: DbGlyphRow[],
): FontProject => {
  const mains = new Map<string, DbGlyphRow>();
  const variantLists = new Map<string, DbGlyphRow[]>();
  for (const g of glyphRows) {
    if (!g || typeof g.character !== "string") continue;
    if ((g.variant_number ?? 0) === 0) {
      if (!mains.has(g.character)) mains.set(g.character, g);
    } else {
      const list = variantLists.get(g.character) ?? [];
      list.push(g);
      variantLists.set(g.character, list);
    }
  }
  const characters: Record<string, CharacterData> = {};
  for (const [ch, main] of mains) {
    const strokes = Array.isArray(main.stroke_data) ? main.stroke_data : [];
    const variants = (variantLists.get(ch) ?? [])
      .sort((a, b) => (a.variant_number ?? 0) - (b.variant_number ?? 0))
      .map((v) => (Array.isArray(v.stroke_data) ? v.stroke_data : []))
      .filter((s) => s.length > 0);
    characters[ch] = {
      char: ch,
      unicode: ch.codePointAt(0) ?? 0,
      category: guessCategory(ch),
      strokes,
      variants,
      qualityStatus: strokes.length > 0 ? "good" : "empty",
      lastUpdated: main.updated_at ? Date.parse(main.updated_at) : Date.now(),
    };
  }
  // Orphan variant rows (no main row yet) still count as work in progress.
  for (const [ch, list] of variantLists) {
    if (characters[ch]) continue;
    const ordered = list
      .sort((a, b) => (a.variant_number ?? 0) - (b.variant_number ?? 0))
      .map((v) => (Array.isArray(v.stroke_data) ? v.stroke_data : []))
      .filter((s) => s.length > 0);
    if (!ordered.length) continue;
    characters[ch] = {
      char: ch,
      unicode: ch.codePointAt(0) ?? 0,
      category: guessCategory(ch),
      strokes: [],
      variants: ordered,
      qualityStatus: "empty",
      lastUpdated: Date.now(),
    };
  }
  const completedCount = Object.values(characters).filter(
    (c) => c.strokes && c.strokes.length > 0,
  ).length;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    author: "You",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    characters,
    status: row.status === "generated" ? "generated" : "draft",
    characterCount: completedCount,
    completionPercentage: Math.round(
      (completedCount / ALL_CHARACTERS.length) * 100,
    ),
  };
};

/**
 * getMyProjects(): the authenticated dashboard source of truth. Returns only
 * the caller's rows — RLS scopes both queries to auth.uid(); no user_id ever
 * leaves the UI layer.
 */
export const loadMyProjects = async (): Promise<FontProject[]> => {
  const rows = await listProjects();
  const out: FontProject[] = [];
  for (const row of rows) {
    const glyphs = (await listGlyphs(row.id)) as DbGlyphRow[];
    out.push(normalizeServerProject(row, glyphs));
  }
  if (DEV_LOG) {
    const owners = [...new Set(rows.map((r) => r.user_id))];
    console.info(
      `[typeme] loadMyProjects projects=${rows.length} owners=${owners.length}`,
    );
  }
  return out;
};

export const updateServerProject = async (
  id: string,
  patch: {
    name?: string;
    description?: string;
    status?: string;
    last_opened_at?: string | null;
    updated_at?: string;
  },
): Promise<void> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { error } = await sb.from("projects").update(patch).eq("id", id);
  if (error) throw error;
};

/** Delete one owned project and its glyphs. Throws on any failure. */
export const deleteServerProject = async (id: string): Promise<void> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { error: glyphError } = await sb
    .from("glyphs")
    .delete()
    .eq("project_id", id);
  if (glyphError) throw glyphError;
  const { error: projectError } = await sb
    .from("projects")
    .delete()
    .eq("id", id);
  if (projectError) throw projectError;
};

/**
 * Remove stale variant rows at/after a cutoff (e.g. user deleted variants in
 * the editor). Without this, normalize would resurrect deleted variants.
 */export const deleteGlyphVariantsFrom = async (
  projectId: string,
  character: string,
  fromVariant: number,
): Promise<void> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { error } = await sb
    .from("glyphs")
    .delete()
    .eq("project_id", projectId)
    .eq("character", character)
    .gte("variant_number", fromVariant);
  if (error) throw error;
};

// ---------------------------------------------------------------------------
// Identity + checkout intent. Ownership always derives from the session.
// ---------------------------------------------------------------------------

/**
 * Tie the login phone number to the authenticated profile so fonts,
 * subscriptions and payments join to a human identity via user_id.
 * Allowed by profiles_update_own (verified live). Best-effort: callers
 * swallow failures and keep local mode working.
 */
export const syncProfilePhone = async (e164: string): Promise<void> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  const uid = await sessionUid();
  const { error } = await sb
    .from("profiles")
    .update({ phone: e164 })
    .eq("id", uid);
  if (error) throw error;
};

export interface DbSubscription {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
};

/**
 * Record a checkout intent as a PENDING subscription row owned by auth.uid().
 * Requires the pending-intent policies in supabase/typeme-master.sql.
 * Throws 42501 until they are applied — callers treat that as
 * "server trace unavailable" and keep the local demo activation.
 * Activation (pending -> active) stays backend-only (Razorpay webhook via
 * service_role); the entitlement RPC honors active rows exclusively.
 */
export const createPendingSubscription = async (
  plan: "pro",
  days = 30,
): Promise<DbSubscription> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  const uid = await sessionUid();
  const now = new Date();
  const row = {
    user_id: uid,
    plan,
    status: "pending",
    started_at: now.toISOString(),
    expires_at: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
  };
  const { data, error } = await sb
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as DbSubscription;
};

/** Read my subscription row (RLS-scoped). Null when none exists. */export const readMySubscription = async (): Promise<DbSubscription | null> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { data, error } = await sb.from("subscriptions").select("*").limit(1);
  if (error) throw error;
  const rows = (data ?? []) as DbSubscription[];
  return rows[0] ?? null;
};

export interface DbGeneratedFont {
  id: string;
  project_id: string;
  user_id: string;
  font_name: string;
  format: string;
  status: string;
  created_at: string;
}

/**
 * Associate a generated font with its project + auth.uid(). Callers
 * fire-and-forget after local generation; a throw means the row is absent
 * (policy or offline) and local artifacts stay authoritative for the demo.
 */
export const recordGeneratedFont = async (
  projectId: string,
  fontName: string,
  format: "otf" | "ttf",
): Promise<void> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  const uid = await sessionUid();
  const { error } = await sb.from("generated_fonts").insert({
    project_id: projectId,
    user_id: uid,
    font_name: fontName,
    format,
    status: "ready",
  });
  if (error) throw error;
};

/** "My Fonts" server source: current user's generated fonts only (RLS). */
export const listMyGeneratedFonts = async (): Promise<DbGeneratedFont[]> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  await sessionUid();
  const { data, error } = await sb
    .from("generated_fonts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbGeneratedFont[];
};
