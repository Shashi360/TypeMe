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
  tier: 'free' | 'creator' | 'pro';
  fontsCreatedCount: number;
  totalDownloads: number;
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

