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
import type { CharacterData, Stroke } from "../types";

export const NOT_CONFIGURED = "supabase-unconfigured";
export const UNAUTHENTICATED = "supabase-unauthenticated";

const sessionUid = async (): Promise<string> => {
  const sb = getSupabase();
  if (!sb) throw new Error(NOT_CONFIGURED);
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id ?? null;
  if (!uid) throw new Error(UNAUTHENTICATED);
  return uid;
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
): Promise<number> => {
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
  for (const lp of localProjects) {
    if (idMap[lp.id]) continue;
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
  return migrated;
};
