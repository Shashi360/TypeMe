/**
 * Centralized native-app handoff for TypeMe ("openTypeMeExperience").
 *
 * Every "Create / Open in app" entry point flows through here — never
 * duplicate this logic per button.
 *
 * HONESTY CONTRACT (read before changing):
 * - The browser cannot reliably detect installed apps. We never claim it can.
 * - Native handoff is only attempted when real app identifiers are
 *   configured below. They are currently empty (no native app shipped),
 *   so this module resolves straight to the web fallback. Do NOT invent
 *   schemes, store URLs, or install detection heuristics.
 * - The install prompt only appears when the browser reports a REAL
 *   installable PWA (beforeinstallprompt). Otherwise it stays hidden and
 *   the web flow continues uninterrupted.
 * - The user can always choose "Continue on Web"; dismissal is remembered
 *   (30 days) so we never nag on every visit.
 */

export interface AppIdentifiers {
  /** e.g. "typeme" (custom scheme) — empty until the native app ships. */
  customScheme: string;
  /** e.g. "https://typeme.com/create" (Universal Link / App Link target). */
  universalUrl: string;
  /** e.g. Intent URI for Android — empty until configured. */
  androidIntentUri: string;
}

export const APP_IDENTIFIERS: AppIdentifiers = {
  customScheme: "",
  universalUrl: "",
  androidIntentUri: "",
};

const DISMISS_KEY = "typeMeAppPromptDismissed";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const isHandoffConfigured = (): boolean =>
  APP_IDENTIFIERS.customScheme !== "" || APP_IDENTIFIERS.universalUrl !== "";

export type Platform = "ios" | "android" | "desktop";

export const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
};

export const isStandalone = (): boolean => {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  } catch {
    // ignore
  }
  return false;
};

/** True once the user dismissed the prompt and the dismissal is still fresh. */
export const isPromptDismissed = (): boolean => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
};

export const dismissPrompt = (): void => {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // ignore
  }
};

// ---- PWA install availability (real signal only) ----

let deferredInstallPrompt: unknown = null;
const installListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installListeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installListeners.forEach((fn) => fn());
  });
}

export const isInstallAvailable = (): boolean => deferredInstallPrompt !== null;

export const onInstallAvailabilityChange = (fn: () => void): (() => void) => {
  installListeners.add(fn);
  return () => {
    installListeners.delete(fn);
  };
};

export const promptInstall = async (): Promise<boolean> => {
  const e = deferredInstallPrompt as {
    prompt: () => Promise<void>;
    userChoice?: Promise<{ outcome: string }>;
  } | null;
  if (!e) return false;
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice?.outcome === "accepted";
  } catch {
    return false;
  }
};

export interface HandoffResult {
  /** True only when a native app actually took over (page hidden). */
  openedInApp: boolean;
}

/**
 * Attempt a native handoff, then fall back to web.
 * Today this always falls back (no identifiers configured) — by design.
 */
export const requestAppHandoff = async (destination?: string): Promise<HandoffResult> => {
  if (!isHandoffConfigured() || typeof window === "undefined" || typeof document === "undefined") {
    return { openedInApp: false };
  }

  return new Promise((resolve) => {
    let settled = false;
    const target =
      destination ||
      APP_IDENTIFIERS.universalUrl ||
      (APP_IDENTIFIERS.customScheme ? `${APP_IDENTIFIERS.customScheme}://create` : "");
    if (!target) {
      resolve({ openedInApp: false });
      return;
    }

    const onHide = () => {
      if (!settled && document.hidden) {
        settled = true;
        cleanup();
        resolve({ openedInApp: true });
      }
    };
    const cleanup = () => {
      document.removeEventListener("visibilitychange", onHide);
    };
    document.addEventListener("visibilitychange", onHide);

    try {
      window.location.href = target;
    } catch {
      // fall through to timeout fallback
    }

    window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve({ openedInApp: false });
      }
    }, 1500);
  });
};

export interface ExperienceRequest {
  /** Deep destination to preserve across app/web handoff. */
  destination?: string;
  /** Called when the web flow should continue (normal case today). */
  onContinueWeb: () => void;
}

/**
 * openTypeMeExperience — the ONE entry point for "Create My Font" on
 * mobile/tablet: try native handoff when configured, otherwise continue
 * on web. Never traps the user; never redirects blindly.
 */
export const openTypeMeExperience = async (req: ExperienceRequest): Promise<void> => {
  const handoff = await requestAppHandoff(req.destination);
  if (!handoff.openedInApp) {
    req.onContinueWeb();
  }
};
