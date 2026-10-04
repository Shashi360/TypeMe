export type CharacterCategory = 'uppercase' | 'lowercase' | 'numbers' | 'symbols';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type Stroke = Point[];

export type QualityStatus = 'good' | 'warning' | 'error' | 'empty';

export interface CharacterData {
  char: string;
  unicode: number;
  category: CharacterCategory;
  strokes: Stroke[];
  variants?: Stroke[][]; // Alternate handwriting versions (e.g. a1, a2, a3)
  strokeStyles?: { brush: string; size: string }[]; // Parallel to strokes: tool used per stroke
  variantStyles?: { brush: string; size: string }[][]; // Parallel to variants
  qualityStatus: QualityStatus;
  qualityFeedback?: string;
  lastUpdated?: number;
}

export interface FontProject {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  characters: Record<string, CharacterData>;
  status: 'draft' | 'generated';
  ttfBlobUrl?: string;
  otfBlobUrl?: string;
  fontFamilyName?: string;
  characterCount: number;
  completionPercentage: number;
  lastGeneratedAt?: string;
  fileSizeBytes?: number;
}

export interface User {
  phone: string;
  name: string;
  isLoggedIn: boolean;
  isAdmin?: boolean;
  /**
   * Stable local account ID (deterministic per phone, see
   * utils/identity.ts). Scopes caches/logs only — NEVER database
   * ownership, which is always auth.uid() from a live Supabase session.
   */
  accountId?: string;
  tier: 'free' | 'creator' | 'pro';
  fontsCreatedCount: number;
  totalDownloads: number;
  /**
   * Local subscription record (single-device demo architecture — a future
   * backend/Supabase record is authoritative when present). Never delete
   * user data on expiry; only entitlement flips back to Free.
   */
  subscription?: {
    plan: 'pro';
    status: 'active' | 'expired';
    startedAt: number;
    expiresAt: number;
  };
}

export interface CommunityFont {
  id: string;
  name: string;
  creator: string;
  story: string;
  category: 'Casual' | 'Elegant' | 'Playful' | 'Minimal' | 'Bold' | 'Messy' | 'Calligraphy' | 'Vintage' | 'Artistic' | 'Signature';
  previewText: string;
  downloads: number;
  fontFamily: string;
}

export type AppView = 
  | 'landing'
  | 'dashboard'
  | 'workspace'
  | 'review'
  | 'preview'
  | 'download'
  | 'pricing'
  | 'learn'
  | 'explore'
  | 'quiz'
  | 'gallery'
  | 'legal'
  | 'admin';

export type LegalDoc = 'privacy' | 'terms' | 'licensing';

