/**
 * Central plan/entitlement system for TypeMe.
 *
 * Single source of truth for every plan decision in the product:
 * editor tools, character access, variants, processing, downloads.
 * UI, actions, and generation all read from here — never scatter
 * ad-hoc `tier === 'pro'` checks through the app.
 *
 * NOTE on architecture: TypeMe is a fully local product (localStorage
 * persistence, simulated checkout, on-device font generation). There is
 * no backend endpoint to enforce against, so these client-side
 * entitlements ARE the enforcement layer, shared by every surface.
 */

export type PlanId = "free" | "pro";

/** Free starter set: first 20 uppercase glyphs (A–T). */
export const FREE_CHARACTER_SET: readonly string[] = Object.freeze(
  Array.from("ABCDEFGHIJKLMNOPQRST"),
);

export const FREE_BRUSHES: readonly string[] = Object.freeze(["gel", "pencil"]);
export const FREE_STROKE_SIZES: readonly string[] = Object.freeze(["regular"]);
export const FREE_CANVAS_STYLES: readonly string[] = Object.freeze(["typography", "blank"]);

/** Max glyphs (Main + alternates) per character. */
export const PRO_MAX_VARIANTS_TOTAL = 4;
/** Free = Main only (zero alternates). */
export const FREE_MAX_ALTERNATES = 0;
export const PRO_MAX_ALTERNATES = PRO_MAX_VARIANTS_TOTAL - 1;

/** `creator` is a legacy paid tier — treat it as Pro everywhere. */
export const isPaidTier = (tier?: string | null): boolean =>
  tier === "pro" || tier === "creator";

export const planIdOf = (tier?: string | null): PlanId =>
  isPaidTier(tier) ? "pro" : "free";

export interface Entitlements {
  readonly isPro: boolean;
  readonly planLabel: string;
  canUseBrush: (brush: string) => boolean;
  canUseStrokeSize: (size: string) => boolean;
  canUseCanvasStyle: (style: string) => boolean;
  /** Max alternate variants (excluding Main) for this plan. */
  readonly maxAlternates: number;
  canCreateVariant: (existingAlternates: number) => boolean;
  canDownloadFont: () => boolean;
  /** Editable without an upgrade prompt. Grandfathers glyphs that already have ink. */
  isCharacterAllowed: (char: string, hasStrokes: boolean) => boolean;
}

export const getEntitlements = (tier?: string | null): Entitlements => {
  const isPro = isPaidTier(tier);
  return {
    isPro,
    planLabel: isPro ? "Pro" : "Free",
    canUseBrush: (brush) => isPro || (FREE_BRUSHES as readonly string[]).includes(brush),
    canUseStrokeSize: (size) => isPro || (FREE_STROKE_SIZES as readonly string[]).includes(size),
    canUseCanvasStyle: (style) => isPro || (FREE_CANVAS_STYLES as readonly string[]).includes(style),
    maxAlternates: isPro ? PRO_MAX_ALTERNATES : FREE_MAX_ALTERNATES,
    canCreateVariant: (existingAlternates) =>
      isPro ? existingAlternates < PRO_MAX_ALTERNATES : false,
    canDownloadFont: () => isPro,
    isCharacterAllowed: (char, hasStrokes) =>
      isPro || (FREE_CHARACTER_SET as readonly string[]).includes(char) || hasStrokes,
  };
};

export interface UpgradeCopy {
  feature: string;
  description: string;
  /** Checkmark bullets shown in the upgrade modal. */
  bullets?: string[];
}

const PRO_GENERAL = [
  "Full character set",
  "All brushes & stroke sizes",
  "Full font generation",
  "OTF download",
];

export const upgradeForBrush = (brush: string): UpgradeCopy => ({
  feature: `${brush.charAt(0).toUpperCase() + brush.slice(1)} brush`,
  description:
    "Create elegant variable-width handwriting strokes with Pro.",
  bullets: ["All 4 brush styles", "More natural handwriting", "Advanced font creation", "OTF download"],
});

export const upgradeForStrokeSize = (size: string): UpgradeCopy => ({
  feature: `${size.charAt(0).toUpperCase() + size.slice(1)} stroke`,
  description:
    "Extra stroke weights are a Pro feature. Upgrade to TypeMe Pro to unlock Fine, Regular and Bold.",
  bullets: ["Fine, Regular and Bold weights", "More natural handwriting", ...PRO_GENERAL.slice(2)],
});

export const upgradeForCanvasStyle = (style: string): UpgradeCopy => ({
  feature: `${style.charAt(0).toUpperCase() + style.slice(1)} canvas`,
  description:
    "Extra canvas styles are a Pro feature. Upgrade to TypeMe Pro to unlock Typography, Notebook, Dots and Blank.",
  bullets: ["All 4 canvas styles", "Guides that match your flow", ...PRO_GENERAL.slice(2)],
});

export const upgradeForVariants: UpgradeCopy = {
  feature: "Alternate variants",
  description:
    "Pro lets you create up to 4 styles per character (Main + 3 alternates). Upgrade to TypeMe Pro to unlock variants.",
  bullets: ["Up to 4 styles per character", "Richer, more natural fonts", "Advanced font creation", "OTF download"],
};

export const upgradeForCharacters: UpgradeCopy = {
  feature: "Full character set",
  description:
    "Free includes 20 starter characters (A–T). Upgrade to TypeMe Pro to unlock all 82+ glyphs — lowercase, numbers and symbols.",
  bullets: ["All 82+ glyphs", "Lowercase, numbers & symbols", "More variants", "Full font generation", "OTF download"],
};

export const upgradeForDownload: UpgradeCopy = {
  feature: "Font downloads",
  description:
    "Your font is ready. Upgrade to TypeMe Pro (₹99/month) to download your OTF font file.",
  bullets: ["OTF font download", "Install on any device", "Complete font generation", "Advanced processing"],
};
