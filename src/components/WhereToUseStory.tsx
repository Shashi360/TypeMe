import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Compass } from 'lucide-react';

/* ============================================================================
   TYPEME — "YOUR FONT DOESN'T BELONG IN ONE PLACE."
   Scroll-driven visual storytelling section.

   Design notes:
   - ONE shared handwriting phrase ("Make it yours.") travels across every
     scene surface. It is a single DOM element so the typeface can never
     drift between scenes.
   - Scroll progress is measured once per animation frame and written
     straight to CSS custom properties / transforms via refs. No React state
     updates during scroll, so the story never triggers a re-render.
   - Art is inline SVG + CSS transforms only. No images, no video.
   ========================================================================== */

interface WhereToUseStoryProps {
  onStartWriting: () => void;
  onExploreStyles: () => void;
}

interface Accent {
  line: string;
  soft: string;
  wash: string;
  deep: string;
  label: string;
  ink: string;
}

interface SceneDef {
  id: string;
  label: string;
  phrase: string;
  copy: string;
  accent: Accent;
  start: number;
  end: number;
}

/* Accent colors guide attention, they do not flood the section.
   Most of the surface stays white / off-white. */
const SCENES: SceneDef[] = [
  {
    id: 'journal',
    label: 'Journal',
    phrase: 'Make it yours.',
    copy: 'Your thoughts, your way.',
    accent: { line: '#3b82f6', soft: '#dbeafe', wash: '#eff6ff', deep: '#1d4ed8', label: '#1e40af', ink: '#1e293b' },
    start: 0,
    end: 0.2,
  },
  {
    id: 'invitation',
    label: 'Invitation',
    phrase: 'Make it yours.',
    copy: 'Add something personal to every celebration.',
    accent: { line: '#fb7185', soft: '#ffe4e6', wash: '#fff1f2', deep: '#e11d48', label: '#9f1239', ink: '#1f2937' },
    start: 0.2,
    end: 0.4,
  },
  {
    id: 'brand',
    label: 'Brand',
    phrase: 'Make it yours.',
    copy: 'Give your brand a human signature.',
    accent: { line: '#f59e0b', soft: '#fef3c7', wash: '#fffbeb', deep: '#b45309', label: '#92400e', ink: '#292524' },
    start: 0.4,
    end: 0.6,
  },
  {
    id: 'social',
    label: 'Social',
    phrase: 'Make it yours.',
    copy: 'Make every post feel unmistakably you.',
    accent: { line: '#a78bfa', soft: '#ede9fe', wash: '#f5f3ff', deep: '#7c3aed', label: '#5b21b6', ink: '#1f2937' },
    start: 0.6,
    end: 0.8,
  },
  {
    id: 'art',
    label: 'Art',
    phrase: 'Make it yours.',
    copy: 'Turn your handwriting into part of your creative style.',
    accent: { line: '#10b981', soft: '#d1fae5', wash: '#ecfdf5', deep: '#047857', label: '#065f46', ink: '#1f2937' },
    start: 0.8,
    end: 0.95,
  },
  {
    id: 'signature',
    label: 'Your Signature',
    phrase: 'Your name. Your mark.',
    copy: '',
    accent: { line: '#f97316', soft: '#ffedd5', wash: '#fff7ed', deep: '#c2410c', label: '#9a3412', ink: '#1c1917' },
    start: 0.95,
    end: 1,
  },
];

/* Where the travelling phrase sits, per scene, in stage units.
   Interpolated continuously so the phrase glides rather than jumps. */
const PHRASE_SLOTS: { x: number; y: number; scale: number; rotate: number }[] = [
  { x: 0, y: -2, scale: 1, rotate: -1 },
  { x: 0, y: -6, scale: 0.92, rotate: -2 },
  { x: 1, y: -2, scale: 0.86, rotate: -4 },
  { x: 0, y: -1, scale: 0.66, rotate: -2 },
  { x: 0, y: -3, scale: 1.12, rotate: -3 },
  { x: 0, y: -4, scale: 1.42, rotate: -1.5 },
];

const KINETIC_WORDS = ['WRITE', 'CREATE', 'TYPE', 'SHARE'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* Hand-drawn marks that sketch themselves in as a scene settles.
   pathLength={1} lets every path share one dasharray unit. */
function Doodle({
  variant,
  color,
  className = '',
}: {
  variant: 'arrow' | 'underline' | 'circle' | 'star' | 'scribble' | 'dots' | 'bracket';
  color: string;
  className?: string;
}) {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    pathLength: 1,
  };
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path className="tm-doodle" {...common} d="M4 20 C 16 4, 40 2, 58 10" />
        <path className="tm-doodle" style={{ animationDelay: '180ms' }} {...common} d="M48 4 L 58 10 L 50 18" />
      </>
    ),
    underline: <path className="tm-doodle" {...common} d="M2 10 C 18 4, 38 16, 62 6" />,
    circle: (
      <>
        <path className="tm-doodle" {...common} d="M32 6 C 52 6, 60 18, 58 32 C 56 48, 40 58, 26 54 C 12 50, 6 36, 10 24 C 13 14, 22 7, 32 6 Z" />
        <path className="tm-doodle" style={{ animationDelay: '140ms' }} {...common} d="M40 14 C 48 24, 46 38, 36 44" />
      </>
    ),
    star: (
      <>
        <path className="tm-doodle" {...common} d="M16 3 L 20 13 L 30 14 L 22 21 L 24 31 L 16 26 L 8 31 L 10 21 L 2 14 L 12 13 Z" />
        <path className="tm-doodle" style={{ animationDelay: '120ms' }} {...common} d="M36 22 L 38 28 L 44 29 L 39 33 L 40 39 L 36 36 L 31 39 L 32 33 L 27 29 L 33 28 Z" />
      </>
    ),
    scribble: (
      <path className="tm-doodle" {...common} d="M2 26 C 8 8, 14 30, 20 14 C 26 4, 30 28, 36 16 C 42 6, 48 26, 56 12" />
    ),
    dots: (
      <>
        <circle className="tm-doodle tm-doodle-fill" {...common} cx="8" cy="22" r="3" />
        <circle className="tm-doodle tm-doodle-fill" style={{ animationDelay: '90ms' }} {...common} cx="22" cy="14" r="3" />
        <circle className="tm-doodle tm-doodle-fill" style={{ animationDelay: '180ms' }} {...common} cx="36" cy="24" r="3" />
        <circle className="tm-doodle tm-doodle-fill" style={{ animationDelay: '270ms' }} {...common} cx="50" cy="15" r="3" />
      </>
    ),
    bracket: <path className="tm-doodle" {...common} d="M26 2 C 10 8, 8 30, 16 40 C 20 45, 24 47, 28 47" />,
  };
  return (
    <svg viewBox="0 0 64 40" className={`w-full h-auto overflow-visible ${className}`} aria-hidden="true">
      {paths[variant]}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Scene surfaces. Each is a light, paper-like stage prop drawn in SVG.
   The travelling phrase is NOT here — it is a sibling so it stays identical
   across every scene.
   ------------------------------------------------------------------------- */

function JournalSurface({ a }: { a: Accent }) {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="tm-journal-cover" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a.deep} />
          <stop offset="100%" stopColor={a.line} />
        </linearGradient>
      </defs>
      {/* cover, opening */}
      <g className="tm-surface-journal">
        <rect x="16" y="14" width="288" height="212" rx="10" fill="url(#tm-journal-cover)" opacity="0.12" />
        <rect x="16" y="14" width="288" height="212" rx="10" fill="none" stroke={a.line} strokeWidth="1.5" opacity="0.5" />
        {/* spine */}
        <rect x="16" y="14" width="16" height="212" rx="8" fill={a.deep} opacity="0.18" />
        <line x1="32" y1="14" x2="32" y2="226" stroke={a.deep} strokeWidth="1.5" opacity="0.45" />
        {/* ruled page */}
        <g stroke={a.line} strokeWidth="1" opacity="0.22">
          {[70, 92, 114, 136, 158, 180].map((y) => (
            <line key={y} x1="46" y1={y} x2="286" y2={y} />
          ))}
        </g>
        <line x1="52" y1="46" x2="286" y2="46" stroke={a.deep} strokeWidth="1.5" opacity="0.35" />
        {/* date block */}
        <rect x="52" y="30" width="52" height="9" rx="4" fill={a.deep} opacity="0.3" />
        <rect x="112" y="32" width="34" height="5" rx="2.5" fill={a.ink} opacity="0.18" />
      </g>
      {/* elastic band */}
      <rect x="252" y="14" width="8" height="212" rx="4" fill={a.line} opacity="0.2" />
    </svg>
  );
}

function InvitationSurface({ a }: { a: Accent }) {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="tm-inv-paper" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffdfa" />
          <stop offset="100%" stopColor={a.wash} />
        </linearGradient>
      </defs>
      <g className="tm-surface-invitation">
        {/* deckled paper */}
        <path
          d="M44 26 L 276 26 L 276 214 L 44 214 Z"
          fill="url(#tm-inv-paper)"
          stroke={a.line}
          strokeWidth="1.5"
          opacity="0.95"
        />
        {/* ornamental corner flourishes */}
        <path className="tm-doodle" pathLength={1} fill="none" stroke={a.line} strokeWidth="1.6" d="M58 46 C 74 40, 88 50, 92 64" />
        <path className="tm-doodle" style={{ animationDelay: '120ms' }} pathLength={1} fill="none" stroke={a.line} strokeWidth="1.6" d="M262 46 C 246 40, 232 50, 228 64" />
        <path className="tm-doodle" style={{ animationDelay: '200ms' }} pathLength={1} fill="none" stroke={a.line} strokeWidth="1.6" d="M58 194 C 74 200, 88 190, 92 176" />
        <path className="tm-doodle" style={{ animationDelay: '280ms' }} pathLength={1} fill="none" stroke={a.line} strokeWidth="1.6" d="M262 194 C 246 200, 232 190, 228 176" />
        {/* rules */}
        <rect x="112" y="60" width="96" height="6" rx="3" fill={a.deep} opacity="0.35" />
        <rect x="132" y="76" width="56" height="4" rx="2" fill={a.ink} opacity="0.2" />
        <rect x="96" y="184" width="128" height="5" rx="2.5" fill={a.ink} opacity="0.16" />
      </g>
    </svg>
  );
}

function BrandSurface({ a }: { a: Accent }) {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="tm-brand-tin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a.wash} />
          <stop offset="55%" stopColor="#fff" />
          <stop offset="100%" stopColor={a.soft} />
        </linearGradient>
      </defs>
      <g className="tm-surface-brand">
        {/* label / pouch */}
        <path d="M78 54 L 242 54 L 256 78 L 244 206 L 76 206 L 64 78 Z" fill="url(#tm-brand-tin)" stroke={a.line} strokeWidth="1.5" />
        {/* top seal */}
        <rect x="76" y="42" width="168" height="16" rx="4" fill={a.deep} opacity="0.22" />
        <line x1="76" y1="50" x2="244" y2="50" stroke={a.deep} strokeWidth="1" opacity="0.4" />
        {/* label plate */}
        <rect x="96" y="76" width="128" height="104" rx="8" fill="#fff" stroke={a.line} strokeWidth="1" opacity="0.9" />
        {/* brand mark */}
        <g className="tm-surface-brand-mark">
          <circle cx="160" cy="100" r="10" fill="none" stroke={a.deep} strokeWidth="1.8" />
          <path className="tm-doodle" pathLength={1} fill="none" stroke={a.deep} strokeWidth="1.8" d="M150 100 L 157 100 L 161 92 L 166 110 L 171 100 L 178 100" />
        </g>
        <rect x="120" y="122" width="80" height="5" rx="2.5" fill={a.ink} opacity="0.22" />
        <rect x="132" y="136" width="56" height="5" rx="2.5" fill={a.ink} opacity="0.14" />
        <rect x="142" y="160" width="36" height="10" rx="5" fill={a.deep} opacity="0.28" />
      </g>
    </svg>
  );
}

function SocialSurface({ a }: { a: Accent }) {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="tm-social-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f3f46" />
          <stop offset="100%" stopColor="#18181b" />
        </linearGradient>
      </defs>
      {/* Original interface: no third-party app chrome. */}
      <g className="tm-surface-social">
        <rect x="104" y="12" width="112" height="216" rx="20" fill="url(#tm-social-body)" />
        <rect x="110" y="20" width="100" height="200" rx="14" fill="#fff" />
        {/* status row */}
        <rect x="122" y="32" width="34" height="5" rx="2.5" fill="#d4d4d8" />
        <circle cx="196" cy="34" r="4" fill={a.line} opacity="0.5" />
        {/* composer card */}
        <rect x="120" y="52" width="80" height="86" rx="10" fill={a.wash} stroke={a.soft} strokeWidth="1" />
        <circle cx="136" cy="68" r="7" fill={a.line} opacity="0.35" />
        <rect x="148" y="64" width="36" height="5" rx="2.5" fill="#a1a1aa" />
        <rect x="134" y="86" width="52" height="4" rx="2" fill="#d4d4d8" />
        <rect x="134" y="98" width="40" height="4" rx="2" fill="#d4d4d8" />
        {/* engagement row */}
        <g className="tm-surface-social-hearts">
          <circle cx="134" cy="150" r="5" fill={a.line} opacity="0.45" />
          <circle cx="152" cy="150" r="5" fill={a.line} opacity="0.3" />
          <circle cx="170" cy="150" r="5" fill={a.line} opacity="0.2" />
        </g>
        <rect x="120" y="166" width="52" height="5" rx="2.5" fill="#d4d4d8" />
        <rect x="120" y="180" width="70" height="4" rx="2" fill="#e4e4e7" />
        {/* home indicator */}
        <rect x="146" y="206" width="28" height="3" rx="1.5" fill="#d4d4d8" />
      </g>
    </svg>
  );
}

function ArtSurface({ a }: { a: Accent }) {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="tm-art-poster" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor={a.wash} />
        </linearGradient>
      </defs>
      <g className="tm-surface-art">
        <rect x="66" y="16" width="188" height="208" rx="4" fill="url(#tm-art-poster)" stroke={a.line} strokeWidth="1.5" />
        {/* gallery frame line */}
        <rect x="80" y="30" width="160" height="150" rx="2" fill="none" stroke={a.line} strokeWidth="1" opacity="0.35" />
        {/* abstract shapes */}
        <circle className="tm-surface-art-shape" cx="118" cy="72" r="20" fill={a.line} opacity="0.3" />
        <path className="tm-surface-art-shape" d="M188 52 L 224 108 L 152 108 Z" fill={a.deep} opacity="0.22" />
        <path className="tm-doodle" pathLength={1} fill="none" stroke={a.deep} strokeWidth="2" d="M92 150 C 120 132, 148 168, 176 148 C 196 134, 212 156, 232 142" />
        <path className="tm-doodle" style={{ animationDelay: '160ms' }} pathLength={1} fill="none" stroke={a.line} strokeWidth="2" d="M96 172 C 130 158, 168 186, 224 166" />
        {/* caption rule */}
        <rect x="80" y="196" width="72" height="6" rx="3" fill={a.ink} opacity="0.24" />
        <rect x="80" y="208" width="44" height="4" rx="2" fill={a.ink} opacity="0.14" />
      </g>
    </svg>
  );
}

function SignatureSurface({ a }: { a: Accent }) {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="tm-sig-canvas" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor={a.wash} />
        </linearGradient>
      </defs>
      <g className="tm-surface-signature">
        <rect x="52" y="20" width="216" height="200" rx="8" fill="url(#tm-sig-canvas)" stroke={a.line} strokeWidth="1.5" opacity="0.9" />
        {/* baseline guide */}
        <line x1="76" y1="132" x2="244" y2="132" stroke={a.line} strokeWidth="1" strokeDasharray="4 5" opacity="0.5" />
        <rect x="76" y="44" width="60" height="6" rx="3" fill={a.ink} opacity="0.18" />
        <rect x="76" y="58" width="40" height="4" rx="2" fill={a.ink} opacity="0.12" />
        {/* flourish */}
        <path className="tm-doodle" pathLength={1} fill="none" stroke={a.line} strokeWidth="1.8" d="M96 176 C 130 166, 156 190, 192 176 C 214 166, 232 180, 246 172" />
      </g>
    </svg>
  );
}

const SURFACES: Record<string, (p: { a: Accent }) => React.ReactElement> = {
  journal: JournalSurface,
  invitation: InvitationSurface,
  brand: BrandSurface,
  social: SocialSurface,
  art: ArtSurface,
  signature: SignatureSurface,
};

const DOODLES: Record<string, { variant: 'arrow' | 'underline' | 'circle' | 'star' | 'scribble' | 'dots' | 'bracket'; pos: string; w: string }[]> = {
  journal: [
    { variant: 'underline', pos: 'left-[6%] top-[74%]', w: 'w-20 sm:w-28' },
    { variant: 'star', pos: 'right-[8%] top-[16%]', w: 'w-8 sm:w-11' },
  ],
  invitation: [
    { variant: 'arrow', pos: 'left-[8%] top-[18%]', w: 'w-16 sm:w-24' },
    { variant: 'dots', pos: 'right-[10%] top-[72%]', w: 'w-14 sm:w-20' },
  ],
  brand: [
    { variant: 'circle', pos: 'left-[5%] top-[26%]', w: 'w-16 sm:w-24' },
    { variant: 'bracket', pos: 'right-[9%] top-[20%]', w: 'w-12 sm:w-16' },
  ],
  social: [
    { variant: 'scribble', pos: 'left-[4%] top-[72%]', w: 'w-20 sm:w-28' },
    { variant: 'star', pos: 'right-[7%] top-[18%]', w: 'w-7 sm:w-10' },
  ],
  art: [
    { variant: 'underline', pos: 'left-[6%] top-[20%]', w: 'w-16 sm:w-24' },
    { variant: 'arrow', pos: 'right-[8%] top-[66%]', w: 'w-16 sm:w-22' },
  ],
  signature: [
    { variant: 'underline', pos: 'left-[14%] top-[80%]', w: 'w-24 sm:w-36' },
    { variant: 'dots', pos: 'right-[12%] top-[24%]', w: 'w-14 sm:w-20' },
  ],
};

export const WhereToUseStory: React.FC<WhereToUseStoryProps> = ({ onStartWriting, onExploreStyles }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const phraseRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const penRef = useRef<HTMLSpanElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const connectorRef = useRef<SVGPathElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const [reduced, setReduced] = useState(false);
  const [activeScene, setActiveScene] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const paint = useCallback(() => {
    frameRef.current = null;
    const track = trackRef.current;
    const phrase = phraseRef.current;
    if (!track || !phrase) return;

    const rect = track.getBoundingClientRect();
    const travel = track.offsetHeight - window.innerHeight;
    const p = travel > 0 ? clamp(-rect.top / travel, 0, 1) : 0;

    track.style.setProperty('--p', p.toFixed(4));

    /* --- travelling handwriting phrase ------------------------------- */
    let slotIdx = 0;
    for (let i = 0; i < PHRASE_SLOTS.length - 1; i++) {
      if (p >= SCENES[i].start) slotIdx = i;
    }
    const from = SCENES[slotIdx];
    const to = SCENES[Math.min(slotIdx + 1, SCENES.length - 1)];
    const span = Math.max(to.end - from.start, 0.0001);
    const local = clamp((p - from.start) / span, 0, 1);
    const e = easeInOut(local);
    const a = PHRASE_SLOTS[slotIdx];
    const b = PHRASE_SLOTS[Math.min(slotIdx + 1, PHRASE_SLOTS.length - 1)];
    const x = lerp(a.x, b.x, e);
    const y = lerp(a.y, b.y, e);
    const sc = lerp(a.scale, b.scale, e);
    const rot = lerp(a.rotate, b.rotate, e);

    phrase.style.setProperty('--tx', `${x}%`);
    phrase.style.setProperty('--ty', `${y}%`);
    phrase.style.transform = `translate(-50%, -50%) translate(${x}%, ${y - p * 6}%) scale(${sc}) rotate(${rot}deg)`;
    phrase.style.opacity = p < 0.012 ? '0' : '1';
    /* written-on reveal + travelling pen tip */
    const reveal = easeOut(clamp(p / 0.12, 0, 1));
    phrase.style.setProperty('--reveal', reveal.toFixed(4));
    if (penRef.current) {
      penRef.current.style.transform = `translateX(${(reveal * 100).toFixed(2)}%) rotate(${reveal < 1 ? -18 : 0}deg)`;
      penRef.current.style.opacity = reveal < 1 ? '1' : '0';
    }

    /* --- scenes ------------------------------------------------------- */
    for (let i = 0; i < SCENES.length; i++) {
      const el = sceneRefs.current[i];
      if (!el) continue;
      const s = SCENES[i];
      const raw = clamp((p - s.start) / Math.max(s.end - s.start, 0.0001), 0, 1);
      const isLast = i === SCENES.length - 1;
      const fadeIn = clamp(raw / 0.22, 0, 1);
      const fadeOut = isLast ? 1 : clamp((1 - raw) / 0.22, 0, 1);
      const opacity = isLast ? fadeIn : Math.min(fadeIn, fadeOut);
      el.style.opacity = opacity.toFixed(3);
      /* surfaces arrive with a shallow 3D lean, as if turned on a table */
      const lean = (1 - easeOut(raw)) * 14;
      const rise = (1 - easeOut(raw)) * 26;
      const scale = 0.94 + easeOut(raw) * 0.06;
      el.style.transform = `translateY(${rise.toFixed(2)}%) scale(${scale.toFixed(3)}) rotateX(${lean.toFixed(2)}deg)`;
      el.style.setProperty('--d', easeOut(clamp(raw / 0.55, 0, 1)).toFixed(4));
      el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
    }

    /* --- travelling pen connector ------------------------------------ */
    if (connectorRef.current) {
      const c = clamp(p / 0.96, 0, 1);
      connectorRef.current.style.strokeDashoffset = String(1 - easeInOut(c));
      /* the connector takes the hue of whichever scene is arriving */
      const next = SCENES[slotIdx + 1] || SCENES[slotIdx];
      connectorRef.current.style.stroke = slotIdx >= SCENES.length - 1 ? SCENES[slotIdx].accent.line : next.accent.line;
    }
    if (railRef.current) {
      railRef.current.style.setProperty('--rp', p.toFixed(4));
    }

    /* label/rail sync (cheap: only fires when the scene actually changes) */
    const current = SCENES.reduce((acc, s, i) => (p >= s.start ? i : acc), 0);
    setActiveScene((prev) => (prev === current ? prev : current));
  }, []);

  const onScroll = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    if (reduced) return;
    const wide = window.matchMedia('(min-width: 1024px)');
    const run = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (wide.matches) {
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        onScroll();
      }
    };
    run();
    wide.addEventListener('change', run);
    return () => {
      wide.removeEventListener('change', run);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [reduced, onScroll]);

  /* progress reset when the section leaves the viewport */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting && frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }
        }
      },
      { rootMargin: '20% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const isSignature = activeScene === SCENES.length - 1;
  const KineticRail = (
    <div className="pointer-events-none select-none" aria-hidden="true">
      {KINETIC_WORDS.map((w, i) => {
        const on = activeScene >= i + 1;
        return (
          <span
            key={w}
            className="block font-mono text-[10px] sm:text-[11px] tracking-[0.2em] transition-all duration-700"
            style={{
              color: on ? '#18181b' : '#c9c5bf',
              opacity: on ? 1 : 0.5,
              transform: `translateX(${on ? 0 : -10}px)`,
              fontWeight: on ? 700 : 400,
            }}
          >
            {w}
            {i < KINETIC_WORDS.length - 1 && <span className="text-neutral-300 ml-2">↓</span>}
          </span>
        );
      })}
    </div>
  );

  const Phrase = (
    <div
      ref={phraseRef}
      className="tm-phrase absolute left-1/2 top-1/2 z-30 select-none"
      style={{ ['--reveal' as string]: 0 }}
    >
      <div className="relative">
        <span className="tm-phrase-text font-handwriting whitespace-nowrap leading-[1.1] block">
          {isSignature ? 'Your name. Your mark.' : 'Make it yours.'}
        </span>
        <span
          ref={penRef}
          className="tm-pen absolute -top-1 sm:-top-2 left-0 w-5 sm:w-7 h-5 sm:h-7 pointer-events-none"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path
              d="M4 20 L 14 10 L 19 15 L 9 20 Z"
              fill="#111827"
              opacity="0.9"
              stroke="#fafaf9"
              strokeWidth="0.8"
            />
            <path d="M14 10 L 19 15" stroke="#fafaf9" strokeWidth="0.8" />
          </svg>
        </span>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id="where-to-use"
      className="relative bg-white scroll-mt-20 overflow-x-clip"
      style={{ ['--p' as string]: 0 }}
    >
      {/* soft paper wash — keeps the section light, not flat */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 520px at 50% -8%, #fafaf9 0%, #ffffff 62%, #ffffff 100%)',
        }}
      />

      {/* ===================== HEADLINE ===================== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-28 pb-8 sm:pb-12">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-500 text-[10px] font-mono uppercase tracking-[0.2em]">
            One handwriting · Many places
          </span>

          <h2 className="mt-5 text-[clamp(1.85rem,6.2vw,4.25rem)] leading-[1.04] font-extrabold tracking-tight text-stone-900 text-balance">
            <span className="font-handwriting font-bold text-stone-900 pr-1">Your font</span>
            <span className="text-neutral-400"> doesn't belong in </span>
            <span className="relative inline-block whitespace-nowrap">
              <span className="relative z-10">one place.</span>
              <svg
                className="absolute -bottom-1 left-0 w-full h-[0.32em] overflow-visible"
                viewBox="0 0 200 14"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M2 10 C 40 3, 78 12, 118 6 C 150 1.5, 176 9, 198 5"
                  fill="none"
                  stroke="url(#tm-hl)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  pathLength={1}
                  className="tm-hl-stroke"
                />
                <defs>
                  <linearGradient id="tm-hl" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="50%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h2>

          <p className="mt-5 text-base sm:text-xl font-medium text-stone-500">
            Write it once. Bring it everywhere.
          </p>
        </div>
      </div>

      {/* ===================== DESKTOP: STICKY SCROLL STORY =====================
          Visibility is owned by CSS (.tm-stage / .tm-stack) so that reduced
          motion can swap layouts without fighting Tailwind's lg: utilities. */}
      <div className="tm-stage">
        <div ref={trackRef} className="tm-track relative h-[560vh]">
          <div className="sticky top-0 h-screen overflow-hidden flex items-center">
            <div className="w-full max-w-6xl mx-auto px-8 grid grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-12 items-center">
              {/* ---- narrative column ---- */}
              <div className="relative z-20 h-[380px]">
                {SCENES.map((s, i) => {
                  const Surface = SURFACES[s.id];
                  const isOn = activeScene === i;
                  return (
                    <div
                      key={s.id}
                      className="absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-out"
                      style={{
                        opacity: isOn ? 1 : 0,
                        transform: `translateY(${isOn ? 0 : 18}px)`,
                        pointerEvents: 'none',
                      }}
                    >
                      <span
                        className="inline-flex w-fit items-center gap-2 px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.18em] border"
                        style={{
                          color: s.accent.label,
                          borderColor: s.accent.line + '55',
                          backgroundColor: s.accent.wash,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: s.accent.line }}
                        />
                        {s.label}
                      </span>

                      <p className="mt-4 text-[1.6rem] leading-[1.15] font-extrabold tracking-tight text-stone-900">
                        {s.phrase}
                      </p>
                      {s.copy && (
                        <p className="mt-2.5 text-sm leading-relaxed text-stone-500 max-w-[30ch]">{s.copy}</p>
                      )}
                    </div>
                  );
                })}

                {/* progress rail */}
                <div className="absolute -left-7 top-1/2 -translate-y-1/2 hidden xl:block">
                  <div ref={railRef} className="tm-rail relative flex flex-col gap-3">
                    {SCENES.map((s, i) => (
                      <span
                        key={s.id}
                        className="block w-1 rounded-full transition-all duration-500"
                        style={{
                          height: i === activeScene ? 22 : 8,
                          backgroundColor: i <= activeScene ? s.accent.line : '#e7e5e4',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* ---- visual stage ---- */}
              <div className="relative h-[440px]">
                <div className="absolute inset-0">
                  {/* connector: one travelling pen stroke, never black */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      ref={connectorRef}
                      className="tm-connector"
                      d="M14 84 C 30 66, 40 92, 54 72 C 68 52, 76 74, 88 56"
                      fill="none"
                      pathLength={1}
                    />
                  </svg>

                  {SCENES.map((s, i) => {
                    const Surface = SURFACES[s.id];
                    return (
                      <div
                        key={s.id}
                        ref={(el) => {
                          sceneRefs.current[i] = el;
                        }}
                        className="tm-scene absolute inset-0 flex items-center justify-center"
                        style={{ opacity: 0, ['--d' as string]: 0 }}
                      >
                        <div className="relative w-full max-w-[420px]">
                          <div
                            className="absolute -inset-6 rounded-[28px] -z-10"
                            style={{ background: `radial-gradient(closest-side, ${s.accent.wash}, transparent 78%)` }}
                          />
                          <Surface a={s.accent} />

                          {DOODLES[s.id].map((d, k) => (
                            <div
                              key={`${s.id}-${d.variant}-${k}`}
                              className={`absolute ${d.pos} ${d.w} tm-doodle-wrap`}
                              style={{ ['--dc' as string]: s.accent.line }}
                            >
                              <Doodle variant={d.variant} color={s.accent.line} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* the one phrase, travelling across every surface */}
                  {Phrase}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== MOBILE / TABLET: STACKED STORY ===================== */}
      <div className="tm-stack max-w-6xl mx-auto px-4 sm:px-6 pb-6">
        <div className="flex justify-center pb-2">{KineticRail}</div>

        <div className="space-y-6 sm:space-y-8">
          {SCENES.map((s) => {
            const Surface = SURFACES[s.id];
            return (
              <article
                key={s.id}
                className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase tracking-[0.16em] border"
                    style={{
                      color: s.accent.label,
                      borderColor: s.accent.line + '55',
                      backgroundColor: s.accent.wash,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.accent.line }} />
                    {s.label}
                  </span>
                  <span className="font-mono text-[10px] text-stone-300">0{SCENES.indexOf(s) + 1}</span>
                </div>

                {/* full-width visual, text below so nothing overlaps */}
                <div className="relative w-full rounded-2xl overflow-hidden" style={{ backgroundColor: s.accent.wash }}>
                  <div className="px-3 py-4 sm:py-6">
                    <Surface a={s.accent} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/85 to-transparent" />
                  <div className="absolute inset-x-0 bottom-2 flex justify-center">
                    <span className="font-handwriting text-xl sm:text-2xl text-stone-900 px-3 text-center">
                      {s.phrase}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm font-semibold text-stone-900">{s.label === 'Your Signature' ? s.phrase : s.phrase}</p>
                {s.copy && <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{s.copy}</p>}
              </article>
            );
          })}
        </div>
      </div>

      {/* ===================== CLOSING ===================== */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 sm:pb-28 text-center">
        <div className="tm-closing">
          <p className="font-handwriting text-2xl text-stone-700 leading-tight">
            One handwriting.
            <br />
            Endless places.
          </p>
          <h3 className="mt-5 text-[clamp(1.6rem,5vw,3rem)] leading-[1.08] font-extrabold tracking-tight text-stone-900 text-balance">
            One handwriting. Endless places.
          </h3>
          <p className="mt-4 text-sm sm:text-base text-stone-500 max-w-md mx-auto leading-relaxed">
            Create your font once and take your handwriting wherever you create.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              onClick={onStartWriting}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer shadow-sm"
            >
              <span>Create My Font</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onExploreStyles}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-stone-300 bg-white text-stone-800 text-sm font-semibold hover:border-stone-900 hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Explore TypeMe</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhereToUseStory;
