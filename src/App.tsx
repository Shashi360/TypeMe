import React, { useState, useEffect, useRef } from 'react';
import { FontProject, User, AppView, Stroke, LegalDoc } from './types';
import {
  createInitialSampleProject,
  createArchitectSampleProject,
  createNewProject,
  ALL_CHARACTERS,
} from './utils/sampleData';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { WorkspaceView } from './components/WorkspaceView';
import { ReviewView } from './components/ReviewView';
import { PreviewStudioView } from './components/PreviewStudioView';
import { DownloadView } from './components/DownloadView';
import { PricingView } from './components/PricingView';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { GenerationModal } from './components/GenerationModal';
import { StyleQuizModal } from './components/StyleQuizModal';
import { LearnView } from './components/LearnView';
import { StyleExplorerView } from './components/StyleExplorerView';
import LegalView from './components/LegalView';
import { unregisterFontUrl } from './utils/fontGenerator';
import {
  migrateLocalProjectsToSupabase,
  loadMyProjects,
  createProject as createServerProject,
  updateServerProject,
  deleteServerProject,
  upsertGlyph as upsertServerGlyph,
  deleteGlyphVariantsFrom as deleteServerVariantsFrom,
  syncProfilePhone,
  createPendingSubscription,
  readMyEntitlement,
  recordGeneratedFont,
  pinSessionUid,
} from './utils/db';
import { ensureSupabaseSession, invalidateSessionCache } from './utils/supabaseSession';
import { getSupabase } from './utils/supabaseClient';
import { toE164Loose } from './utils/phone';

export default function App() {
  // User state
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('typeme_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Projects state
  const [projects, setProjects] = useState<FontProject[]>(() => {
    try {
      const saved = localStorage.getItem('typeme_projects');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [createInitialSampleProject(), createArchitectSampleProject()];
  });

  // Active project ID (restored after refresh when still present)
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('typeme_nav') || 'null') as {
        projectId?: string;
      } | null;
      if (saved?.projectId && projects.some((p) => p.id === saved.projectId)) {
        return saved.projectId as string;
      }
    } catch {
      // ignore
    }
    return projects[0]?.id || '';
  });

  // ---- Supabase-backed mode ---------------------------------------------
  // serverUid !== null means a real Supabase session exists and Supabase is
  // the authoritative project source. null = guest/local mode (localStorage).
  // While serverLoading, the local cache stays on screen; it is replaced by
  // the verified server response, never merged.
  const [serverUid, setServerUid] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const serverRun = useRef(0);
  // Ref mirrors for async save paths: event/callback closures captured
  // before establishment finished must still observe the live mode and the
  // live active project (never a stale render's values).
  const serverUidRef = useRef<string | null>(null);
  const setServerUidSync = (v: string | null) => {
    serverUidRef.current = v;
    setServerUid(v);
  };
  const activeIdRef = useRef(activeProjectId);
  useEffect(() => {
    activeIdRef.current = activeProjectId;
  }, [activeProjectId]);
  // True while the mode decision is in flight (mirrors serverLoading state
  // for stale closures).
  const establishingRef = useRef(false);
  // Resolves when the in-flight establish finishes; lets mutations that land
  // inside the establishing window wait for the mode decision instead of
  // guessing local vs server.
  const serverSettled = useRef<Promise<void> | null>(null);
  const settleServer = () => serverSettled.current?.catch(() => {});
  // Bumped on every server-confirmed mutation. The initial server snapshot
  // must never clobber newer state (e.g. project created while the first
  // load was still in flight) — in that case we refetch and apply fresh.
  const serverMut = useRef(0);

  // ---- Identity isolation ---------------------------------------------
  // Demo-auth reality: Supabase anon sessions are per-browser, while login
  // identities (phones) are per-human. The session remembers which login
  // claimed it first (owner key). A DIFFERENT login on the same browser
  // session never reads that account's server data: it runs local-only
  // under a phone-scoped cache key. Same login returns to full server mode.
  // With production phone-auth (one auth.user per phone) the owner always
  // matches and this degrades to a harmless extra check.
  const SESSION_OWNER_PREFIX = 'typeme_session_owner_';
  const GUEST_PROJECTS_KEY = 'typeme_projects';
  const scopedLocalKey = (e164: string | null) =>
    e164 ? `typeme_projects_local_${e164.replace(/\D/g, '')}` : GUEST_PROJECTS_KEY;
  const scopedUserKey = (e164: string | null) =>
    e164 ? `typeme_user_${e164.replace(/\D/g, '')}` : null;
  // Current local cache key. Server mode ignores it (Supabase authoritative).
  const localKeyRef = useRef<string>(GUEST_PROJECTS_KEY);
  const projectsRef = useRef<FontProject[]>(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const readLocalList = (key: string): FontProject[] => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? (parsed as FontProject[]) : [];
    } catch {
      return [];
    }
  };

  const DEV_APP =
    typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

  const enterServerMode = async (baseLocal: FontProject[], phoneRaw?: string | null) => {
    // Join an in-flight establish instead of racing it: two concurrent
    // runs mint two sessions and split-brain the migration (projects under
    // one UID, glyphs under another → RLS rejects half the flight).
    if (establishingRef.current && serverSettled.current) {
      await serverSettled.current.catch(() => {});
      return;
    }
    const run = ++serverRun.current;
    setServerLoading(true);
    establishingRef.current = true;
    let resolveSettled: () => void = () => {};
    serverSettled.current = new Promise<void>((res) => {
      resolveSettled = res;
    });
    try {
      const uid = await ensureSupabaseSession();
      if (run !== serverRun.current) return;
      // Pin this UID for the whole flight (see pinSessionUid).
      pinSessionUid(uid);
      const e164 = phoneRaw ? toE164Loose(phoneRaw) : null;
      // Session ownership gate: a login identity that did not establish
      // this browser session must never see its server account. Run
      // local-only under a phone-scoped cache instead of migrating into it.
      let owner: string | null = null;
      try {
        owner = localStorage.getItem(`${SESSION_OWNER_PREFIX}${uid}`);
      } catch {
        owner = null;
      }
      if (e164 && owner && owner !== e164) {
        if (DEV_APP) {
          console.info(
            `[typeme] session owned by another login; local-only mode (no server read/migrate)`
          );
        }
        setServerUidSync(null);
        localKeyRef.current = scopedLocalKey(e164);
        const scoped = readLocalList(localKeyRef.current);
        setProjects(scoped);
        setActiveProjectId(scoped[0]?.id || '');
        return;
      }
      setServerUidSync(uid);
      localKeyRef.current = GUEST_PROJECTS_KEY;
      if (e164 && !owner) {
        try {
          localStorage.setItem(`${SESSION_OWNER_PREFIX}${uid}`, e164);
        } catch {
          // ignore
        }
      }
      // Tie the login phone to this profile (production identity join:
      // profiles.phone <-> projects/subscriptions via user_id).
      if (e164) syncProfilePhone(e164).catch(() => {});
      if (DEV_APP) {
        console.info(`[typeme] server mode uid=${uid}`);
      }
      // Backend truth wins both ways: a server-activated Pro is adopted;
      // a server-EXPIRED subscription forces Free even when the local
      // cache still says Pro. A merely pending/absent server row leaves
      // the local demo state untouched.
      readMyEntitlement()
        .then((ent) => {
          const e = ent as {
            plan?: string;
            isPro?: boolean;
            isActive?: boolean;
            startedAt?: number | null;
            expiresAt?: number | null;
          } | null;
          if (run !== serverRun.current || !e) return;
          if (e.isPro && e.isActive) {
            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    tier: 'pro',
                    subscription: {
                      plan: 'pro',
                      status: 'active',
                      startedAt: e.startedAt ?? Date.now(),
                      expiresAt: e.expiresAt ?? Date.now() + 30 * 24 * 60 * 60 * 1000,
                    },
                  }
                : prev
            );
          } else if (e.expiresAt && !e.isActive) {
            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    tier: 'free',
                    subscription: {
                      plan: 'pro',
                      status: 'expired',
                      startedAt: e.startedAt ?? Date.now(),
                      expiresAt: e.expiresAt ?? Date.now(),
                    },
                  }
                : prev
            );
          }
        })
        .catch(() => {});
      // Re-read the local caches: projects created while the session was
      // being established, plus this login's phone-scoped local work, are
      // not in the login-time snapshot. Union by id; the claim registry
      // inside migrateLocalProjectsToSupabase still blocks cross-account
      // claims and local data is never deleted.
      let base = baseLocal;
      try {
        const seen = new Set(base.map((p) => p?.id));
        for (const key of [GUEST_PROJECTS_KEY, scopedLocalKey(e164)]) {
          const stored = readLocalList(key);
          const extra = stored.filter((p) => p && !seen.has(p.id));
          for (const p of extra) seen.add(p.id);
          if (extra.length) base = [...base, ...extra];
        }
      } catch {
        // ignore — fall back to the login-time snapshot
      }
      const v0 = serverMut.current;
      await migrateLocalProjectsToSupabase(base).catch(() => {});
      if (run !== serverRun.current) return;
      let server = await loadMyProjects();
      if (run !== serverRun.current) return;
      if (serverMut.current !== v0) {
        // A server-confirmed mutation landed mid-load; refetch so the
        // snapshot applied below includes it instead of erasing it.
        server = await loadMyProjects();
        if (run !== serverRun.current) return;
      }
      setProjects(server);
      setActiveProjectId((prev) =>
        server.some((p) => p.id === prev) ? prev : server[0]?.id || ''
      );
    } catch {
      // No session / unreachable: stay in local mode, keep local data.
      if (run !== serverRun.current) return;
      setServerUidSync(null);
    } finally {
      if (run === serverRun.current) {
        setServerLoading(false);
        establishingRef.current = false;
      }
      pinSessionUid(null);
      resolveSettled();
    }
  };

  // Refresh with a restored login re-establishes the server session so the
  // dashboard and editor read the same Supabase rows (no manual restart).
  const serverRestored = useRef(false);
  useEffect(() => {
    if (!user || serverRestored.current) return;
    serverRestored.current = true;
    void enterServerMode(projects, user.phone).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Supabase auth lifecycle: SIGNED_IN (e.g. session established elsewhere)
  // re-enters server mode when logged in but sourceless; SIGNED_OUT drops
  // server state and restores this identity's local cache. Supabase data is
  // never deleted here — only local session/cache state.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (!serverUidRef.current) return;
        serverRun.current += 1;
        setServerUidSync(null);
        setServerLoading(false);
        establishingRef.current = false;
        invalidateSessionCache();
        try {
          const local = readLocalList(localKeyRef.current);
          if (local.length) {
            setProjects(local);
            setActiveProjectId(local[0]?.id || '');
          }
        } catch {
          // ignore
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (user && !serverUidRef.current && !establishingRef.current) {
          serverRestored.current = true;
          void enterServerMode(projectsRef.current, user.phone).catch(() => {});
        }
      }
    });
    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Navigation state (restored after refresh so reloads stay on the same page)
  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (!user) return 'landing';
    try {
      const saved = JSON.parse(localStorage.getItem('typeme_nav') || 'null') as {
        view?: AppView;
      } | null;
      const restorable: AppView[] = [
        'dashboard',
        'workspace',
        'review',
        'preview',
        'download',
        'pricing',
        'learn',
        'explore',
        'gallery',
        'legal',
        'landing',
      ];
      if (saved?.view && restorable.includes(saved.view)) return saved.view;
    } catch {
      // ignore
    }
    return 'dashboard';
  });

  // Every view starts at the top (login, tabs, footer links, back/forward).
  // Anchor navigation scrolls to its section afterwards via its own timer.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [currentView]);

  // Persist navigation so a refresh restores the same view + project.
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(
          'typeme_nav',
          JSON.stringify({ view: currentView, projectId: activeProjectId })
        );
      } else {
        localStorage.removeItem('typeme_nav');
      }
    } catch {
      // ignore
    }
  }, [user, currentView, activeProjectId]);

  // Browser back/forward moves through app views instead of leaving the app.
  const historyInit = useRef(false);
  const popNavigating = useRef(false);
  useEffect(() => {
    // State changes caused by back/forward must not push a new entry,
    // or the forward stack would be destroyed.
    if (popNavigating.current) {
      popNavigating.current = false;
      return;
    }
    const state = { view: currentView, projectId: activeProjectId };
    try {
      if (!historyInit.current) {
        historyInit.current = true;
        window.history.replaceState(state, '');
      } else {
        window.history.pushState(state, '');
      }
    } catch {
      // ignore (non-browser contexts)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state as { view?: AppView; projectId?: string } | null;
      if (!s || !s.view) return;
      popNavigating.current = true;
      if (s.projectId) setActiveProjectId(s.projectId);
      setCurrentView(s.view);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);

  // Legal document state
  const [legalDoc, setLegalDoc] = useState<LegalDoc>('privacy');

  const openLegal = (doc: LegalDoc) => {
    setLegalDoc(doc);
    setCurrentView('legal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sync state to localStorage. The global key holds the CURRENT session
  // user; a per-phone snapshot preserves each login's subscription/tier so
  // another number logging in later can neither read nor clobber it.
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('typeme_user', JSON.stringify(user));
        const key = scopedUserKey(user.phone ? toE164Loose(user.phone) : null);
        if (key) localStorage.setItem(key, JSON.stringify(user));
      } else {
        localStorage.removeItem('typeme_user');
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    // Server mode: Supabase is authoritative; never overwrite any local
    // cache with server rows. Otherwise persist to the CURRENT cache key:
    // the shared guest key, or the login's phone-scoped key after an
    // ownership mismatch — never another account's data.
    if (serverUid) return;
    try {
      localStorage.setItem(localKeyRef.current, JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects, serverUid]);

  // Active project helper
  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  // Auth handler
  const handleAuthSuccess = (authenticatedUser: User, isNewUser: boolean) => {
    // Same-phone re-login must not reset a live local subscription: carry
    // the still-active sub/tier (and counters) from THIS phone's own
    // snapshot. A different phone starts clean — snapshots are per-phone
    // so one number can never inherit another's plan.
    let nextUser = authenticatedUser;
    try {
      const nextE164 = authenticatedUser.phone
        ? toE164Loose(authenticatedUser.phone)
        : null;
      const key = scopedUserKey(nextE164);
      const prev = key
        ? (JSON.parse(localStorage.getItem(key) || 'null') as User | null)
        : null;
      const sub = prev?.subscription;
      if (
        prev &&
        (prev.tier === 'pro' || prev.tier === 'creator') &&
        sub?.status === 'active' &&
        sub.expiresAt > Date.now()
      ) {
        nextUser = {
          ...authenticatedUser,
          tier: prev.tier,
          subscription: sub,
          fontsCreatedCount: prev.fontsCreatedCount,
          totalDownloads: prev.totalDownloads,
        };
      }
    } catch {
      // ignore — fall back to the fresh login object
    }
    setUser(nextUser);
    // Fresh authentication: drop any cached UID from a previous account so
    // the mode decision below reads the live session, then migrate local
    // work into this account and replace the dashboard source.
    // Runs in the background; local cache stays visible meanwhile.
    serverRestored.current = true;
    invalidateSessionCache();
    void enterServerMode(projects, nextUser.phone).catch(() => {});
    if (isNewUser) {
      setOnboardingModalOpen(true);
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleLogout = () => {
    // Drop server state first so nothing from this account can leak into
    // the next session, then end the Supabase session itself: the next
    // login establishes its own session (real auth users are permanent
    // server-side, so returning users recover their data). The SIGNED_OUT
    // listener below is a no-op once server state is already cleared.
    // Restore this identity's own local cache.
    serverRun.current += 1;
    setServerUidSync(null);
    setServerLoading(false);
    establishingRef.current = false;
    invalidateSessionCache();
    try {
      const local = readLocalList(localKeyRef.current);
      if (local.length) {
        setProjects(local);
        setActiveProjectId(local[0]?.id || '');
      }
    } catch {
      // ignore — keep in-memory state
    }
    localKeyRef.current = GUEST_PROJECTS_KEY;
    // End the Supabase session for REAL (non-anonymous) logins so the next
    // account starts clean. Anonymous device sessions stay sticky: signing
    // them out would orphan their server rows with no recovery path, while
    // the ownership gate already isolates mismatched logins app-side.
    try {
      void (async () => {
        try {
          const sb = getSupabase();
          const { data } = (await sb?.auth.getUser()) ?? { data: { user: null } };
          const anon = (data?.user as { is_anonymous?: boolean } | null)?.is_anonymous;
          if (data?.user && anon !== true) await sb?.auth.signOut();
        } catch {
          // ignore
        }
      })();
    } catch {
      // ignore
    }
    setUser(null);
    setCurrentView('landing');
  };

  // Project management handlers
  const handleStartNewFont = () => {
    setCreateError(null);
    setOnboardingModalOpen(true);
  };

  const handleCreateProject = async (name: string, description: string) => {
    // A create landing inside the establishing window waits for the mode
    // decision so it never writes to the wrong source of truth.
    if (establishingRef.current) await settleServer();
    if (serverUidRef.current) {
      // Authenticated: the project exists only after Supabase confirms it.
      // On failure the onboarding modal stays open with the input preserved.
      try {
        const row = await createServerProject(name, description);
        const serverProj: FontProject = {
          id: row.id,
          name: row.name,
          description: row.description ?? description,
          author: user?.name || 'You',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          characters: {},
          status: 'draft',
          characterCount: 0,
          completionPercentage: 0,
        };
        setCreateError(null);
        serverMut.current += 1;
        setProjects((prev) => [serverProj, ...prev]);
        setActiveProjectId(serverProj.id);
        setOnboardingModalOpen(false);
        setCurrentView('workspace');
      } catch (err) {
        console.error('Supabase project creation failed:', err);
        setCreateError('supabase-create-failed');
      }
      return;
    }
    const authorName = user?.name || 'You';
    const newProj = createNewProject(name, description, authorName);
    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newProj.id);
    setOnboardingModalOpen(false);
    setCurrentView('workspace');
  };

  const handleOpenProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setCurrentView('workspace');
    // Best-effort recency marker; never blocks opening.
    if (serverUidRef.current) {
      updateServerProject(projectId, {
        last_opened_at: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  const handleDuplicateProject = async (projectId: string) => {
    const orig = projects.find((p) => p.id === projectId);
    if (!orig) return;
    if (serverUidRef.current) {
      // Authenticated: the copy exists only after Supabase confirms it.
      pinSessionUid(serverUidRef.current);
      try {
        const row = await createServerProject(
          `${orig.name} (Copy)`,
          orig.description
        );
        for (const [ch, cd] of Object.entries(orig.characters ?? {})) {
          if (!cd.strokes?.length) continue;
          await upsertServerGlyph(row.id, {
            character: ch,
            variant_number: 0,
            strokes: cd.strokes,
            status: 'good',
            is_saved: true,
          });
          const vs = cd.variants ?? [];
          for (let i = 0; i < vs.length; i++) {
            if (!vs[i]?.length) continue;
            await upsertServerGlyph(row.id, {
              character: ch,
              variant_number: i + 1,
              strokes: vs[i],
              status: 'good',
              is_saved: true,
            });
          }
        }
        const copy: FontProject = {
          ...JSON.parse(JSON.stringify(orig)),
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          status: 'draft',
          ttfBlobUrl: undefined,
          otfBlobUrl: undefined,
        };
        serverMut.current += 1;
        setProjects((prev) => [copy, ...prev]);
      } catch (err) {
        console.error('Supabase project duplication failed:', err);
      } finally {
        pinSessionUid(null);
      }
      return;
    }

    const copy: FontProject = {
      ...JSON.parse(JSON.stringify(orig)),
      id: `font_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${orig.name} (Copy)`,
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      updatedAt: 'Just now',
      status: 'draft',
      ttfBlobUrl: undefined,
      otfBlobUrl: undefined,
    };

    setProjects((prev) => [copy, ...prev]);
  };

  const handleUpdateProjectName = (projectId: string, newName: string) => {
    const prevName = projects.find((p) => p.id === projectId)?.name;
    const updated = projects.map((p) => (p.id === projectId ? { ...p, name: newName } : p));
    setProjects(updated);
    if (serverUidRef.current) {
      // Revert on server failure so the UI never shows an unpersisted name.
      updateServerProject(projectId, { name: newName }).catch(() => {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, name: prevName ?? p.name } : p))
        );
      });
      return;
    }
    try {
      localStorage.setItem('typeme_projects', JSON.stringify(updated));
    } catch {}
  };

  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const handleDeleteProject = async (projectId: string) => {
    if (projects.length <= 1) {
      setDeleteBlocked(true);
      return;
    }
    if (serverUidRef.current) {
      // Delete server-side first; the row stays visible if that fails.
      pinSessionUid(serverUidRef.current);
      try {
        await deleteServerProject(projectId);
      } catch (err) {
        console.error('Supabase project deletion failed:', err);
        pinSessionUid(null);
        return;
      }
      pinSessionUid(null);
      serverMut.current += 1;
    }
    const updated = projects.filter((p) => p.id !== projectId);
    setProjects(updated);
    if (activeProjectId === projectId) {
      setActiveProjectId(updated[0].id);
    }
  };

  const handleUpdateCharacter = async (
    char: string,
    strokes: Stroke[],
    variants?: Stroke[][],
    strokeStyles?: { brush: string; size: string }[],
    variantStyles?: { brush: string; size: string }[][],
  ) => {
    // Like create: never persist against a mode that is still being decided.
    // serverLoading/activeProjectId come from refs: this callback may be a
    // stale closure captured before establishment finished.
    if (establishingRef.current) await settleServer();
    const liveUid = serverUidRef.current;
    const targetId = activeIdRef.current;
    if (liveUid) {
      // Authenticated: persist to Supabase BEFORE touching UI state, so the
      // editor's saved indicator (and its retry pill on throw) reflects the
      // real persistence result. Strokes are never shown as saved early.
      // The whole multi-upsert flight is pinned to one UID (no split-brain
      // if the session rotates mid-save).
      pinSessionUid(liveUid);
      try {
        await upsertServerGlyph(targetId, {
          character: char,
          variant_number: 0,
          strokes,
          status: strokes.length > 0 ? 'good' : 'empty',
          is_saved: true,
        });
        const vs = variants ?? [];
        for (let i = 0; i < vs.length; i++) {
          if (!vs[i]?.length) continue;
          await upsertServerGlyph(targetId, {
            character: char,
            variant_number: i + 1,
            strokes: vs[i],
            status: 'good',
            is_saved: true,
          });
        }
        // Drop server variant rows the user deleted locally.
        await deleteServerVariantsFrom(targetId, char, vs.length + 1);
        await updateServerProject(targetId, {
          updated_at: new Date().toISOString(),
        });
      } finally {
        pinSessionUid(null);
      }
      serverMut.current += 1;
    }
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== activeProjectId) return proj;

        const updatedChars = { ...proj.characters };
        const oldData = updatedChars[char] || {
          char,
          unicode: char.charCodeAt(0),
          category: 'uppercase',
          strokes: [],
          qualityStatus: 'empty',
        };

        updatedChars[char] = {
          ...oldData,
          strokes,
          variants: variants || oldData.variants,
          strokeStyles: strokeStyles || oldData.strokeStyles,
          variantStyles: variantStyles || oldData.variantStyles,
          qualityStatus: strokes.length > 0 ? 'good' : 'empty',
          lastUpdated: Date.now(),
        };

        const completedCount = Object.values(updatedChars).filter(
          (c) => c.strokes && c.strokes.length > 0
        ).length;
        const totalChars = ALL_CHARACTERS.length;
        const completionPct = Math.round((completedCount / totalChars) * 100);

        return {
          ...proj,
          characters: updatedChars,
          characterCount: completedCount,
          completionPercentage: completionPct,
          updatedAt: 'Just now',
        };
      })
    );
  };

  // Generation complete handler
  const handleGenerationComplete = (result: {
    otfBlobUrl: string;
    registeredFontFamily: string;
    fileSizeBytes: number;
  }) => {
    // Release previously generated blob URLs before replacing them so
    // repeated generations don't leak object URLs for the session.
    const prev = projects.find((p) => p.id === activeProjectId);
    if (prev?.otfBlobUrl) unregisterFontUrl(prev.otfBlobUrl);
    if (prev?.ttfBlobUrl) {
      try {
        URL.revokeObjectURL(prev.ttfBlobUrl);
      } catch {}
    }
    setProjects((prev) =>
      prev.map((proj) => {
        if (proj.id !== activeProjectId) return proj;
        return {
          ...proj,
          status: 'generated',
          ttfBlobUrl: undefined,
          otfBlobUrl: result.otfBlobUrl,
          fontFamilyName: result.registeredFontFamily,
          fileSizeBytes: result.fileSizeBytes,
          lastGeneratedAt: 'Just now',
        };
      })
    );
    // Associate the artifact server-side (user_id + project_id ownership).
    // Best-effort: local blobs stay authoritative for the demo session.
    if (serverUidRef.current) {
      const pid = activeIdRef.current;
      recordGeneratedFont(pid, result.registeredFontFamily, 'otf').catch(() => {});
      updateServerProject(pid, { status: 'generated' }).catch(() => {});
    }

    setGenerationModalOpen(false);
    setCurrentView('download');
  };

  // Increment download stats
  const handleIncrementDownload = () => {
    if (user) {
      setUser({
        ...user,
        totalDownloads: (user.totalDownloads || 0) + 1,
      });
    }
  };

  // Upgrade user tier (demo checkout). Records a local 30-day subscription;
  // expiry later flips entitlement back to Free without touching user data.
  // Requires a real logged-in user: guests are sent to login and Pro is
  // never granted to a fabricated account.
  const handleUpgradeTier = (tier: 'creator' | 'pro' = 'creator') => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    const now = Date.now();
    const subscription = {
      plan: 'pro' as const,
      status: 'active' as const,
      startedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    };
    if (serverUidRef.current) {
      // Production trace: phone join + pending subscription row owned by
      // auth.uid(). Requires migrations/02-checkout-intent.sql; until it is
      // applied this 42501s and the local demo activation below still holds.
      const e164 = toE164Loose(user.phone);
      if (e164) syncProfilePhone(e164).catch(() => {});
      if (tier === 'pro') {
        createPendingSubscription('pro', 30).catch((err) => {
          console.warn('Pending subscription not recorded (apply supabase/typeme-master.sql policies):', err);
        });
      }
    }
    setUser({
      ...user,
      tier,
      subscription,
    });
  };

  // Subscription expiry: entitlement returns to Free, projects and
  // handwriting are never deleted. Runs on load and whenever the user
  // record changes.
  useEffect(() => {
    if (!user || (user.tier !== 'pro' && user.tier !== 'creator')) return;
    const sub = user.subscription;
    if (sub && sub.status === 'active' && sub.expiresAt <= Date.now()) {
      setUser({
        ...user,
        tier: 'free',
        subscription: { ...sub, status: 'expired' },
      });
    }
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900 font-sans selection:bg-amber-100 selection:text-neutral-900">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onStartNewFont={handleStartNewFont}
        onOpenQuiz={() => setQuizModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        <div key={currentView} className="animate-fadeIn transition-all duration-300 ease-in-out">
          {currentView === 'landing' && (
            <LandingPage
              onStartWriting={() => {
                if (!user) {
                  handleStartNewFont();
                } else {
                  setCurrentView('dashboard');
                }
              }}
              onExploreStyles={() => setCurrentView('explore')}
              onOpenQuiz={() => setQuizModalOpen(true)}
              onOpenLearn={() => setCurrentView('learn')}
              onSeePricing={() => setCurrentView('pricing')}
            />
          )}

          {currentView === 'dashboard' && user && (
            <DashboardView
              user={user}
              projects={projects}
              onOpenProject={handleOpenProject}
              onCreateNewProject={handleStartNewFont}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onUpdateProjectName={handleUpdateProjectName}
              onPreviewProject={(id) => {
                setActiveProjectId(id);
                setCurrentView('preview');
              }}
              onDownloadProject={(id) => {
                setActiveProjectId(id);
                setGenerationModalOpen(true);
              }}
              onOpenPricing={() => setCurrentView('pricing')}
            />
          )}

          {currentView === 'workspace' && activeProject && (
            <WorkspaceView
              project={activeProject}
              onUpdateCharacter={handleUpdateCharacter}
              onRenameProject={(name) => handleUpdateProjectName(activeProject.id, name)}
              tier={user?.tier ?? 'free'}
              onUpgrade={() => setCurrentView('pricing')}
              onBackToDashboard={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onOpenReview={() => setCurrentView('review')}
              onOpenPreview={() => setCurrentView('preview')}
              onGenerateFont={() => setGenerationModalOpen(true)}
            />
          )}

          {currentView === 'review' && activeProject && (
            <ReviewView
              project={activeProject}
              onUpdateCharacter={handleUpdateCharacter}
              onBackToWorkspace={() => setCurrentView('workspace')}
              onContinueToPreview={() => setCurrentView('preview')}
              tier={user?.tier ?? 'free'}
              onUpgrade={() => setCurrentView('pricing')}
            />
          )}

          {currentView === 'preview' && activeProject && (
            <PreviewStudioView
              project={activeProject}
              onBackToWorkspace={() => setCurrentView('workspace')}
              onGenerateFont={() => setGenerationModalOpen(true)}
            />
          )}

          {currentView === 'download' && activeProject && (
            <DownloadView
              project={activeProject}
              onPreview={() => setCurrentView('preview')}
              onCreateAnother={handleStartNewFont}
              onBackToDashboard={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onIncrementDownload={handleIncrementDownload}
              tier={user?.tier ?? 'free'}
              onUpgrade={() => setCurrentView('pricing')}
            />
          )}

          {currentView === 'learn' && (
            <LearnView
              onBackToHome={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onStartWriting={() => {
                if (!user) handleStartNewFont();
                else setCurrentView('workspace');
              }}
            />
          )}

          {currentView === 'explore' && (
            <StyleExplorerView
              onBackToHome={() => setCurrentView(user ? 'dashboard' : 'landing')}
              onStartWriting={() => {
                if (!user) handleStartNewFont();
                else setCurrentView('workspace');
              }}
            />
          )}

          {currentView === 'legal' && (
            <LegalView
              doc={legalDoc}
              onOpenDoc={(doc) => {
                setLegalDoc(doc);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigate={(view) => {
                setCurrentView(view);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onStartWriting={() => {
                if (!user) handleStartNewFont();
                else setCurrentView('dashboard');
              }}
            />
          )}

          {currentView === 'pricing' && (
            <PricingView
              user={user}
              onUpgradeTier={handleUpgradeTier}
              onStartFree={() => {
                if (!user) setAuthModalOpen(true);
                else setCurrentView('dashboard');
              }}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}
        </div>
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={(view, anchorId) => {
          if (anchorId) {
            if (currentView !== 'landing') {
              setCurrentView('landing');
              setTimeout(() => {
                const el = document.getElementById(anchorId);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.pageYOffset - 76;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }, 120);
            } else {
              const el = document.getElementById(anchorId);
              if (el) {
                const y = el.getBoundingClientRect().top + window.pageYOffset - 76;
                window.scrollTo({ top: y, behavior: 'smooth' });
              }
            }
          } else {
            setCurrentView(view);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onStartWriting={() => {
          if (!user) handleStartNewFont();
          else setCurrentView('dashboard');
        }}
        onOpenLegal={openLegal}
        onExploreStyles={() => {
          setCurrentView('explore');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenLearn={() => {
          setCurrentView('learn');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        currentView={currentView}
        onOpenQuiz={() => setQuizModalOpen(true)}
      />

      {/* Auth Modal (Mobile OTP Flow) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Cannot-delete-last-font notice */}
      {deleteBlocked ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm"
          onClick={() => setDeleteBlocked(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Cannot delete font"
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl font-bold text-neutral-900">Keep at least one font</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              This is your last font project, so it can't be deleted. Create a new font first, then delete this one if you like.
            </p>
            <button
              type="button"
              onClick={() => setDeleteBlocked(false)}
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Okay
            </button>
          </div>
        </div>
      ) : null}

      {/* Onboarding Modal ("What should we call your font?") */}
      <OnboardingModal
        isOpen={onboardingModalOpen}
        onClose={() => {
          setCreateError(null);
          setOnboardingModalOpen(false);
        }}
        onCreateProject={handleCreateProject}
        serverError={createError}
      />

      {/* Style Quiz Modal ("Which Font Are You?") */}
      <StyleQuizModal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        onStartFontWithStyle={(styleName) => {
          handleCreateProject(
            `My ${styleName} Font`,
            `Personal handwriting inspired by ${styleName}.`
          );
        }}
      />

      {/* Font Generation Modal (Compiles glyphs via opentype.js) */}
      {activeProject && (
        <GenerationModal
          isOpen={generationModalOpen}
          project={activeProject}
          onClose={() => setGenerationModalOpen(false)}
          onGenerationComplete={handleGenerationComplete}
          onPreviewFont={() => {
            setGenerationModalOpen(false);
            setCurrentView('preview');
          }}
          onReview={() => {
            setGenerationModalOpen(false);
            setCurrentView('review');
          }}
          tier={user?.tier ?? 'free'}
          onUpgrade={() => {
            setGenerationModalOpen(false);
            setCurrentView('pricing');
          }}
        />
      )}
    </div>
  );
}
