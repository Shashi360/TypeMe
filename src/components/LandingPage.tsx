import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Download,
  CheckCircle2,
  Type,
  Layers,
  Edit3,
  RotateCcw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Eye,
  PenTool,
  Check,
  BookOpen,
} from 'lucide-react';
import { WhereToUseStory } from './WhereToUseStory';
import AboutFounder from './AboutFounder';

interface LandingPageProps {
  onStartWriting: () => void;
  onExploreStyles: () => void;
  onOpenQuiz: () => void;
  onOpenLearn: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartWriting,
  onExploreStyles,
  onOpenQuiz,
  onOpenLearn,
}) => {
  // "Write to Type" Hero Interaction State (DRAW MODE COMES FIRST AS REQUESTED)
  const [heroInputText, setHeroInputText] = useState('TypeMe');
  const [heroMode, setHeroMode] = useState<'draw' | 'type'>('draw');
  const [heroPenWidth, setHeroPenWidth] = useState<number>(4);
  const [heroTextAlign, setHeroTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const heroCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [heroStrokes, setHeroStrokes] = useState<{ x: number; y: number }[][]>([[]]);
  const [isHeroDrawing, setIsHeroDrawing] = useState(false);

  // 3 Style Tabs state for "Not every 'a' looks the same" section
  const [activeVariationTab, setActiveVariationTab] = useState<0 | 1 | 2>(0);
  const variationTabsData = [
    {
      title: 'Style A₁ · Organic Slant',
      glyphLabel: 'a₁',
      subtitle: 'Slanted Cursive Flow',
      arrowLabel: 'Entry slant & momentum curve',
      explanation: 'Notice the fluid entry stroke and slight forward slant. Unlike rigid fonts where every "a" is an identical clone, your organic slant injects real human emotion and rhythm into every sentence.',
      // Distinct visual styling representation
      slant: '-rotate-6 font-handwriting italic text-amber-300',
    },
    {
      title: 'Style A₂ · Bouncy Loop',
      glyphLabel: 'a₂',
      subtitle: 'Rounded Bowl & Loop',
      arrowLabel: 'Rounded bowl & soft exit loop',
      explanation: 'Featuring a rounded bowl and soft exit loop. This variation appears naturally when writing mid-sentence, preventing machine-like repetition and adding delightful character.',
      slant: 'rotate-3 font-handwriting tracking-widest text-rose-300',
    },
    {
      title: 'Style A₃ · Sharp Terminal',
      glyphLabel: 'a₃',
      subtitle: 'Crisp Tail & Speed',
      arrowLabel: 'Crisp terminal & swift pen speed',
      explanation: 'A crisp, confident tail with faster pen speed. Real handwriting fluctuates with momentum—TypeMe’s OpenType engine cycles through these alternates automatically.',
      slant: '-rotate-2 font-handwriting font-extrabold text-sky-300',
    },
  ];

  // Fast Cycling Action Words for Hero Headline (e.g. "Make Your Handwriting Type. / Alive. / Yours.")
  const heroActionWords = [
    'Type.',
    'Alive.',
    'Yours.',
    'Real.',
    'Speak.',
    'Timeless.',
    'Downloadable.',
    'Everywhere.',
  ];
  const [heroWordIndex, setHeroWordIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroWordIndex((prev) => (prev + 1) % heroActionWords.length);
    }, 1600); // Fast, attentive rhythm
    return () => clearInterval(timer);
  }, [heroActionWords.length]);

  // Cycling words for "ONE FONT. MANY PLACES." (Kept strictly unchanged as requested)
  const cyclingWords = [
    'Notes.',
    'Stories.',
    'Invitations.',
    'Brands.',
    'Art.',
    'Journals.',
    'Projects.',
    'Letters.',
  ];
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCycleIndex((prev) => (prev + 1) % cyclingWords.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [cyclingWords.length]);

  // Font Explorer interactive category
  const explorerCategories = [
    {
      id: 'script',
      name: 'Script',
      desc: 'Elegant, expressive and flowing.',
      sample: 'Together under the evening stars.',
      font: 'font-handwriting',
      useCase: 'Weddings & luxury stationery',
    },
    {
      id: 'handwritten',
      name: 'Handwritten',
      desc: 'Personal, casual and human.',
      sample: 'Picked up coffee and fresh pastries.',
      font: 'font-pen',
      useCase: 'Daily journaling & digital notes',
    },
    {
      id: 'serif',
      name: 'Serif',
      desc: 'Literary, classic and refined.',
      sample: 'In the quiet library of memory.',
      font: 'font-serif',
      useCase: 'Books, editorial & formal prints',
    },
    {
      id: 'sans',
      name: 'Sans Serif',
      desc: 'Clean, modern and direct.',
      sample: 'CLARITY PRECEDES GOOD DESIGN',
      font: 'font-sans font-bold uppercase tracking-wider',
      useCase: 'Digital interfaces & posters',
    },
    {
      id: 'display',
      name: 'Display',
      desc: 'Designed to get immediate attention.',
      sample: 'MAKE TODAY UNFORGETTABLE',
      font: 'font-serif uppercase italic font-bold tracking-tight',
      useCase: 'Headlines, apparel & branding',
    },
    {
      id: 'monospace',
      name: 'Monospace',
      desc: 'Technical, retro and structured.',
      sample: 'TYPE_ID: 104_GLYPHS [OK]',
      font: 'font-mono',
      useCase: 'Code blocks & drafting tables',
    },
  ];
  const [selectedCategory, setSelectedCategory] = useState(explorerCategories[0]);

  // Precise Hero canvas drawing handlers (1:1 coordinates, zero offset)
  const getHeroCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleHeroPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsHeroDrawing(true);
    const pt = getHeroCoordinates(e);
    setHeroStrokes((prev) => [...prev, [pt]]);
  };

  const handleHeroPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isHeroDrawing) return;
    e.preventDefault();
    const pt = getHeroCoordinates(e);

    setHeroStrokes((prev) => {
      if (prev.length === 0) return [[pt]];
      const updated = [...prev];
      const lastStroke = updated[updated.length - 1];
      const lastPt = lastStroke[lastStroke.length - 1];
      if (lastPt && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) < 1.5) {
        return prev;
      }
      updated[updated.length - 1] = [...lastStroke, pt];
      return updated;
    });
  };

  const handleHeroPointerUp = () => {
    setIsHeroDrawing(false);
  };

  const clearHeroCanvas = () => {
    setHeroStrokes([]);
  };

  const undoHeroCanvas = () => {
    setHeroStrokes((prev) => prev.slice(0, -1));
  };

  // Redraw hero canvas with high-DPI scaling synchronized to DOM rect
  useEffect(() => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.max(200, Math.round(rect.width));
    const targetH = Math.max(120, Math.round(rect.height));

    if (canvas.width !== targetW * dpr || canvas.height !== targetH * dpr) {
      canvas.width = targetW * dpr;
      canvas.height = targetH * dpr;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Baseline guide
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(16, targetH * 0.72);
    ctx.lineTo(targetW - 16, targetH * 0.72);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw strokes
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = heroPenWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of heroStrokes) {
      if (stroke.length === 0) continue;
      if (stroke.length === 1) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, heroPenWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }, [heroStrokes, heroMode, heroPenWidth]);

  return (
    <div className="bg-neutral-50 text-neutral-900 relative selection:bg-amber-100 selection:text-neutral-900">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION WITH ANIMATED FAST ACTION WORD & EXPANDED DRAW PAD        */}
      {/* ========================================================================= */}
      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 border-b border-neutral-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
            {/* Left: Editorial Headline with Fast Cycling Word */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-neutral-500 font-mono">
                <span className="w-2 h-2 rounded-full bg-neutral-900 animate-pulse" />
                <span>Type + Me · The Personal Typography Studio</span>
              </div>

              {/* Fast Animated Headline: Make Your Handwriting [Type. / Alive. / Yours. / Real.] */}
              <div className="relative">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-neutral-900 tracking-tight font-serif text-balance leading-[1.08]">
                  Make Your <br />
                  <span className="relative inline-block mr-2 sm:mr-3">
                    Handwriting
                    {/* Animated handwritten flourish line under "Handwriting" */}
                    <svg
                      className="absolute -bottom-2 left-0 w-full h-3 text-neutral-900 overflow-visible"
                      viewBox="0 0 200 12"
                      fill="none"
                    >
                      <path
                        d="M 2 8 C 50 2, 130 3, 196 9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <span className="font-handwriting italic text-amber-950 font-bold transition-all duration-300 inline-block">
                    {heroActionWords[heroWordIndex]}
                  </span>
                </h1>
              </div>

              {/* Sliding Transformation Sequence */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200/80 max-w-lg">
                <span className="font-medium text-neutral-700">Your hand</span>
                <span>→</span>
                <span className="font-medium text-neutral-700">Your letters</span>
                <span>→</span>
                <span className="font-medium text-neutral-700">Your style</span>
                <span>→</span>
                <span className="font-bold text-neutral-900 underline decoration-amber-400 decoration-2">
                  Your font
                </span>
              </div>

              <p className="text-base sm:text-lg text-neutral-600 max-w-xl font-normal leading-relaxed text-balance">
                Write your letters. Build your font. Download your typeface. Use your handwriting wherever your creativity takes you.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={onStartWriting}
                  className="px-7 py-3.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>Create My Font</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={onExploreStyles}
                  className="px-6 py-3.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 rounded-xl transition-colors text-center cursor-pointer"
                >
                  Explore Handwriting
                </button>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-400 font-mono">
                <span>Write it once. Type it forever.</span>
                <span>·</span>
                <span>Mac & Windows</span>
                <span>·</span>
                <span>Word, Figma & GoodNotes</span>
              </div>
            </div>

            {/* Right: "WRITE TO TYPE" Interaction (DRAW FIRST WITH MORE SPACE & BOTTOM BUTTONS) */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xl shadow-neutral-200/60 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-900">
                      Write to Type
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono font-medium">
                      Try Drawing Below
                    </span>
                  </div>

                  {/* Draw comes first by default */}
                  <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-[11px]">
                    <button
                      onClick={() => setHeroMode('draw')}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        heroMode === 'draw'
                          ? 'bg-white font-semibold text-neutral-900 shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => setHeroMode('type')}
                      className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                        heroMode === 'type'
                          ? 'bg-white font-semibold text-neutral-900 shadow-2xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      Keyboard
                    </button>
                  </div>
                </div>

                {/* Stage 1: DRAW CANVAS OR KEYBOARD INPUT (SMOOTH TRANSITION & LOCKED HEIGHT) */}
                <div className="h-[400px] sm:h-[430px] flex flex-col justify-between overflow-hidden">
                  <div className="transition-all duration-300 ease-in-out w-full">
                    {heroMode === 'draw' ? (
                      <div className="space-y-3 animate-fadeIn">
                        {/* Spacious drawing surface */}
                        <div className="relative w-full h-64 sm:h-80 bg-neutral-50/70 rounded-2xl border border-neutral-200 overflow-hidden select-none touch-none shadow-inner">
                          <canvas
                            ref={heroCanvasRef}
                            onPointerDown={handleHeroPointerDown}
                            onPointerMove={handleHeroPointerMove}
                            onPointerUp={handleHeroPointerUp}
                            onPointerCancel={handleHeroPointerUp}
                            className="w-full h-full cursor-crosshair touch-none"
                          />
                          {heroStrokes.length === 0 && (
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-neutral-400 gap-1">
                              <PenTool className="w-5 h-5 text-neutral-300" />
                              <span className="text-xs font-mono">Draw with your mouse, finger, or stylus</span>
                            </div>
                          )}
                        </div>

                        {/* DOWN CONTROLS: Clear button and pen controls moved below canvas */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] font-mono">
                            <span>Pen:</span>
                            {[
                              { label: 'Fine', w: 2.5 },
                              { label: 'Medium', w: 4 },
                              { label: 'Bold', w: 6.5 },
                            ].map((item) => (
                              <button
                                key={item.label}
                                onClick={() => setHeroPenWidth(item.w)}
                                className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                                  heroPenWidth === item.w
                                    ? 'bg-neutral-900 text-white font-semibold'
                                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={undoHeroCanvas}
                              disabled={heroStrokes.length === 0}
                              className="px-2.5 py-1 text-[11px] font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-40 rounded-lg cursor-pointer transition-colors"
                            >
                              Undo
                            </button>
                            <button
                              onClick={clearHeroCanvas}
                              disabled={heroStrokes.length === 0}
                              className="px-2.5 py-1 text-[11px] font-medium bg-neutral-100 hover:bg-rose-50 text-neutral-600 hover:text-rose-700 disabled:opacity-40 rounded-lg cursor-pointer transition-colors"
                            >
                              Clear Canvas
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 animate-fadeIn">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={heroInputText}
                            onChange={(e) => setHeroInputText(e.target.value)}
                            placeholder="Type anything..."
                            className="w-full px-3.5 py-3 text-sm rounded-xl border border-neutral-200 bg-neutral-50/70 focus:bg-white focus:border-neutral-900 focus:outline-none transition-all"
                          />
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                            {['TypeMe', 'Alex', 'Coffee & Art', 'Yours truly'].map((preset) => (
                              <button
                                key={preset}
                                onClick={() => setHeroInputText(preset)}
                                className="px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-600 shrink-0 cursor-pointer transition-colors"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Stage 2: Font Output extending to bottom end with notebook rules and left/middle/right alignment on right top corner */}
                        <div className="h-64 sm:h-72 p-4 rounded-2xl bg-[#fdfbf7] border border-neutral-200/90 notebook-ruled-pattern flex flex-col justify-between transition-all duration-300 shadow-inner overflow-hidden">
                          <div className="flex items-center justify-between z-10">
                            <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">
                              02 · Realtime Digital Font Output
                            </span>

                            {/* Left, Middle, Right Alignment Toggle on Right Top Corner */}
                            <div className="flex items-center gap-0.5 bg-neutral-200/80 p-0.5 rounded-md text-[10px] font-mono">
                              {(['left', 'center', 'right'] as const).map((align) => (
                                <button
                                  key={align}
                                  onClick={() => setHeroTextAlign(align)}
                                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer capitalize ${
                                    heroTextAlign === align
                                      ? 'bg-neutral-900 text-white font-semibold'
                                      : 'text-neutral-600 hover:text-neutral-900'
                                  }`}
                                >
                                  {align === 'center' ? 'Middle' : align}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className={`py-3 z-10 ${heroTextAlign === 'center' ? 'text-center' : heroTextAlign === 'right' ? 'text-right' : 'text-left'}`}>
                            <p className="font-handwriting text-3xl sm:text-4xl text-neutral-900 leading-relaxed truncate">
                              {heroInputText || 'TypeMe'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[10px] z-10 pt-2 border-t border-neutral-200/50">
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded font-mono">
                              OpenType 1000 UPM · Live Preview
                            </span>
                            <span className="font-mono text-neutral-400">Baseline Aligned</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={onStartWriting}
                    className="w-full py-3 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mt-3"
                  >
                    <span>Turn My Handwriting Into Type</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. "YOUR HANDWRITING ALREADY HAS A PERSONALITY" (id="personality")        */}
      {/* ========================================================================= */}
      <section id="personality" className="py-20 bg-neutral-50 border-b border-neutral-200 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
            The Soul of Lettering
          </span>

          <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 font-serif tracking-tight text-balance">
            Your handwriting already has a personality.
          </h2>

          <p className="text-sm sm:text-base text-neutral-600 max-w-xl mx-auto leading-relaxed text-balance">
            The tiny curves. The uneven lines. The letters you write differently every time. That's what makes it yours.
          </p>

          {/* Individual characters with CLEAR, DISTINCT visual personalities */}
          <div className="py-6 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {/* Style 1: Cursive Slant */}
            <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs hover:border-neutral-900 transition-all flex flex-col items-center">
              <div className="h-20 flex items-center justify-center">
                <span className="font-handwriting italic font-bold text-6xl text-amber-950 -rotate-12">
                  a
                </span>
              </div>
              <span className="text-xs font-bold text-neutral-900 font-serif mt-2">Cursive Slant</span>
              <span className="text-[10px] font-mono text-neutral-400">fast & flowing</span>
            </div>

            {/* Style 2: Upright Geometric Print */}
            <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs hover:border-neutral-900 transition-all flex flex-col items-center">
              <div className="h-20 flex items-center justify-center">
                <span className="font-sans font-medium text-5xl text-neutral-800 scale-110 tracking-widest">
                  a
                </span>
              </div>
              <span className="text-xs font-bold text-neutral-900 font-serif mt-2">Upright Print</span>
              <span className="text-[10px] font-mono text-neutral-400">clean & architectural</span>
            </div>

            {/* Style 3: Expressive Slanted Loop */}
            <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs hover:border-neutral-900 transition-all flex flex-col items-center">
              <div className="h-20 flex items-center justify-center">
                <span className="font-pen font-bold text-7xl text-neutral-900 rotate-6">
                  a
                </span>
              </div>
              <span className="text-xs font-bold text-neutral-900 font-serif mt-2">Slanted Loop</span>
              <span className="text-[10px] font-mono text-neutral-400">high ascender touch</span>
            </div>

            {/* Style 4: Classic Open Counter / Hook */}
            <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs hover:border-neutral-900 transition-all flex flex-col items-center">
              <div className="h-20 flex items-center justify-center">
                <span className="font-serif italic font-extrabold text-6xl text-neutral-900 -rotate-2">
                  a
                </span>
              </div>
              <span className="text-xs font-bold text-neutral-900 font-serif mt-2">Open Counter</span>
              <span className="text-[10px] font-mono text-neutral-400">editorial double-hook</span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-neutral-500 italic max-w-md mx-auto">
            TypeMe preserves your unique character quirks into real digital OpenType glyphs.
          </p>

          <div className="pt-2">
            <button
              onClick={onStartWriting}
              className="px-6 py-3 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Create My Handwriting Font</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. "NOT EVERY A LOOKS THE SAME" — NATURAL VARIATIONS WITH 3 TABS & ARROWS  */}
      {/* ========================================================================= */}
      <section className="py-20 bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: Explanation & 3 Style Tabs */}
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
                  Organic OpenType Alternates
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 font-serif tracking-tight">
                  Not every 'a' looks the same.
                </h2>
                <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
                  Real handwriting changes naturally. When you write a note, neither the first nor the third 'a' is an exact clone. TypeMe preserves that authentic character with alternate glyphs.
                </p>
              </div>

              {/* 3 Interactive Style Tabs */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-xl">
                  {variationTabsData.map((tab, idx) => (
                    <button
                      key={tab.title}
                      onClick={() => setActiveVariationTab(idx as 0 | 1 | 2)}
                      className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        activeVariationTab === idx
                          ? 'bg-white text-neutral-900 shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      Style A{idx === 0 ? '₁' : idx === 1 ? '₂' : '₃'}
                    </button>
                  ))}
                </div>

                {/* Active Tab Explanation Box */}
                <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-3 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono uppercase text-neutral-900">
                      {variationTabsData[activeVariationTab].title}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Automatic OTF Cycling
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    {variationTabsData[activeVariationTab].explanation}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Specimen Card with Pointing Arrow */}
            <div className="lg:col-span-6 bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-3xl p-8 shadow-xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between relative z-10">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Live Specimen View — {variationTabsData[activeVariationTab].title}
                </span>
                <span className="text-xs font-mono text-amber-300">
                  Variation #{activeVariationTab + 1} of 3
                </span>
              </div>

              {/* Large Specimen Glyph Display */}
              <div className="py-8 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center justify-center relative z-10">
                <div className={`text-7xl sm:text-8xl tracking-wider transition-all duration-300 transform scale-105 ${variationTabsData[activeVariationTab].slant}`}>
                  {variationTabsData[activeVariationTab].glyphLabel}
                </div>

                {/* Pointing Arrow & Callout */}
                <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-mono text-white animate-bounce">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>{variationTabsData[activeVariationTab].arrowLabel}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-400 font-mono relative z-10">
                <span>Why your handwriting is better than machines</span>
                <span className="text-white">Zero robotic cloning</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. "YOUR FONT DOESN'T BELONG IN ONE PLACE." (id="where-to-use")           */}
      {/* Interactive scroll-driven visual story lives in its own component.        */}
      {/* ========================================================================= */}
      <WhereToUseStory onStartWriting={onStartWriting} onExploreStyles={onExploreStyles} />

      {/* ========================================================================= */}
      {/* 4b. ABOUT THE PERSON BEHIND TYPENE                                       */}
      {/* ========================================================================= */}
      <AboutFounder onStartWriting={onStartWriting} onExploreStyles={onExploreStyles} />

      {/* ========================================================================= */}
      {/* 5. FONT EXPLORER (Category Guide)                                         */}
      {/* ========================================================================= */}
      <section className="py-20 bg-neutral-50 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-xl">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
              Interactive Typography Guide
            </span>
            <h2 className="text-3xl font-extrabold text-neutral-900 font-serif tracking-tight mt-1">
              Font Explorer
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 mt-2">
              Select a category to discover what makes it unique before creating your own handwriting font.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-neutral-200 overflow-x-auto no-scrollbar max-w-2xl">
            {explorerCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory.id === cat.id
                    ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Selected Category Showcase */}
          <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
              <div>
                <h3 className="text-2xl font-bold font-serif text-neutral-900">
                  {selectedCategory.name}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">{selectedCategory.desc}</p>
              </div>
              <span className="text-xs font-mono bg-neutral-100 px-3 py-1 rounded-full text-neutral-700">
                Use case: {selectedCategory.useCase}
              </span>
            </div>

            <div className="p-8 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-center">
              <p className={`${selectedCategory.font} text-3xl sm:text-4xl text-neutral-900 my-2`}>
                "{selectedCategory.sample}"
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. "ONE FONT. MANY PLACES." (Unchanged, as requested)                     */}
      {/* ========================================================================= */}
      <section className="py-24 bg-white border-b border-neutral-200 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
            Universal Compatibility
          </span>

          <h2 className="text-4xl sm:text-6xl font-extrabold text-neutral-900 font-serif tracking-tight">
            ONE FONT. <br />
            MANY PLACES.
          </h2>

          {/* Smooth cycling word */}
          <div className="h-16 flex items-center justify-center">
            <span className="font-handwriting text-5xl sm:text-6xl text-amber-950 font-bold transition-all duration-300">
              {cyclingWords[cycleIndex]}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mx-auto pt-2">
            One installable TrueType file works seamlessly across all your creative tools.
          </p>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. HOW TYPEME WORKS (4 Core Steps) (id="how-it-works")                    */}
      {/* ========================================================================= */}
      <section id="how-it-works" className="py-20 bg-neutral-50 border-b border-neutral-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-xl">
            <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
              The Creation Pipeline
            </span>
            <h2 className="text-3xl font-extrabold text-neutral-900 font-serif tracking-tight mt-1">
              How TypeMe Works
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1">
              Four intuitive steps from hand strokes to an installed typeface on your machine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-2xs space-y-3">
              <span className="text-xs font-mono font-bold text-neutral-400">STEP 1</span>
              <h3 className="text-xl font-bold text-neutral-900 font-serif">Write</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Write your letters directly on TypeMe using your mouse, touchscreen, tablet, or Apple Pencil.
              </p>
              <div className="font-handwriting text-3xl text-neutral-900 pt-2">Aa Bb Cc</div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-2xs space-y-3">
              <span className="text-xs font-mono font-bold text-neutral-400">STEP 2</span>
              <h3 className="text-xl font-bold text-neutral-900 font-serif">Refine</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Review every character with our automated quality checker and rewrite anything you don't love.
              </p>
              <div className="text-xs text-emerald-700 font-mono pt-2">Quality: Verified ✓</div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-2xs space-y-3">
              <span className="text-xs font-mono font-bold text-neutral-400">STEP 3</span>
              <h3 className="text-xl font-bold text-neutral-900 font-serif">Build</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                TypeMe transforms your characters into true vector contours with standard optical side bearings.
              </p>
              <div className="text-xs text-neutral-900 font-mono pt-2">OpenType 1000 UPM</div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-neutral-200 shadow-2xs space-y-3">
              <span className="text-xs font-mono font-bold text-neutral-400">STEP 4</span>
              <h3 className="text-xl font-bold text-neutral-900 font-serif">Download</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Download your .TTF and .OTF font files and select them directly in Word, Photoshop, or GoodNotes.
              </p>
              <div className="text-xs font-mono text-neutral-900 pt-2 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> Ready to install
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FINAL EMOTIONAL CTA: "I made a font out of me."                         */}
      {/* ========================================================================= */}
      <section className="py-24 bg-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
            Your Typographic Story
          </span>

          <h2 className="text-4xl sm:text-6xl font-extrabold text-neutral-900 font-serif tracking-tight text-balance">
            "I made a font out of me."
          </h2>

          <p className="text-xs sm:text-sm text-neutral-600 max-w-lg mx-auto leading-relaxed">
            Your handwriting is uniquely yours. TypeMe preserves your natural strokes permanently and makes them usable everywhere.
          </p>

          <div className="pt-2">
            <button
              onClick={onStartWriting}
              className="px-8 py-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Create My Font</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
