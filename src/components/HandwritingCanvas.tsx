import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stroke, Point, CharacterData } from '../types';
import { analyzeCharacterStrokes } from '../utils/qualityCheck';
import {
  RotateCcw,
  RotateCw,
  Trash2,
  Check,
  AlertTriangle,
  PenTool,
  Eraser,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Maximize2,
  Minimize2,
  Keyboard,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
  Cloud,
  CloudOff,
  SlidersHorizontal,
} from 'lucide-react';

export type PenStyle = 'gel' | 'fountain' | 'marker' | 'pencil';
export type GuidelineStyle = 'typography' | 'notebook' | 'dots' | 'blank';
export type EraserScale = 'small' | 'medium' | 'large';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface HandwritingCanvasProps {
  character: CharacterData;
  onSave: (char: string, strokes: Stroke[], variants?: Stroke[][]) => void;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  allCharacterList?: { char: string; category: string; hasStrokes: boolean }[];
  onSelectCharacter?: (char: string) => void;
  projectName?: string;
  completedCount?: number;
  totalCount?: number;
}

const VIRTUAL_WIDTH = 400;
const VIRTUAL_HEIGHT = 400;

const GUIDELINES = {
  ascender: 60,
  capHeight: 110,
  midline: 190,
  baseline: 300,
  descender: 360,
};

const ERASER_RADIUS: Record<EraserScale, number> = { small: 16, medium: 30, large: 52 };
const PEN_WIDTHS = { Fine: 3.5, Regular: 5.5, Bold: 8 } as const;

const WRITING_TIPS = [
  "Don't try to make it perfect. Make it yours.",
  'Write naturally — your little imperfections are part of the font.',
  'Keep your size consistent across every letter.',
  'Relax your hand and write normally.',
  'Stay between the cap line and the baseline.',
  'Slow down a little. Accuracy beats speed here.',
];

const MILESTONES: { at: number; text: string }[] = [
  { at: 10, text: "You're getting a typeface." },
  { at: 25, text: 'Your handwriting is taking shape.' },
  { at: 40, text: 'Almost yours.' },
  { at: 52, text: 'Your handwriting is ready to become a font.' },
];

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: 'uppercase', label: 'A-Z' },
  { key: 'lowercase', label: 'a-z' },
  { key: 'numbers', label: '0-9' },
  { key: 'symbols', label: 'Symbols' },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  character,
  onSave,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  allCharacterList = [],
  onSelectCharacter,
  projectName = 'Your typeface',
  completedCount,
  totalCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeStrokeRef = useRef<Point[]>([]);
  const isDrawingRef = useRef(false);
  const pointerTypeRef = useRef<string | null>(null);
  const erasingRef = useRef(false);
  const primaryRef = useRef<Stroke[]>(character.strokes ? clone(character.strokes) : []);
  const dirtyRef = useRef(false);
  const celebratedRef = useRef<number>(0);

  const [strokes, setStrokes] = useState<Stroke[]>(() => (character.strokes ? clone(character.strokes) : []));
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [variants, setVariants] = useState<Stroke[][]>(() =>
    character.variants ? clone(character.variants) : [],
  );
  const [activeVariant, setActiveVariant] = useState(-1);
  const [variantToDelete, setVariantToDelete] = useState<number | null>(null);

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penStyle, setPenStyle] = useState<PenStyle>('gel');
  const [strokeWidth, setStrokeWidth] = useState<number>(PEN_WIDTHS.Regular);
  const [eraserScale, setEraserScale] = useState<EraserScale>('medium');
  const [guidelineStyle, setGuidelineStyle] = useState<GuidelineStyle>('typography');
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [activeTab, setActiveTab] = useState('uppercase');

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [milestone, setMilestone] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<'chars' | 'tools'>('chars');
  const [tipIndex, setTipIndex] = useState(0);
  const [stageBox, setStageBox] = useState(0);

  const eraserRadius = ERASER_RADIUS[eraserScale];
  const activeStrokes = activeVariant === -1 ? strokes : variants[activeVariant] ?? [];

  // ---------------------------------------------------------------- rendering
  // Everything the renderer needs is mirrored into a ref so a frame that is
  // already in flight can never repaint with stale strokes and wipe fresh ink.
  const liveRef = useRef({
    strokes,
    variants,
    activeVariant,
    penStyle,
    strokeWidth,
    guidelineStyle,
    showGuidelines,
    char: character.char,
  });
  liveRef.current = {
    strokes,
    variants,
    activeVariant,
    penStyle,
    strokeWidth,
    guidelineStyle,
    showGuidelines,
    char: character.char,
  };

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { strokes: liveStrokes, variants: liveVariants, activeVariant: liveVariant } = liveRef.current;
    const { penStyle: livePen, strokeWidth: liveWidth } = liveRef.current;
    const { guidelineStyle: liveGuideline, showGuidelines: liveShow, char: liveChar } = liveRef.current;
    const committed = liveVariant === -1 ? liveStrokes : liveVariants[liveVariant] ?? [];
    const liveActive = liveVariant === -1 ? liveStrokes : liveVariants[liveVariant] ?? [];
    const pending = activeStrokeRef.current;

    // The backing store is sized to the displayed box (times DPR) while all
    // drawing happens in the fixed 400x400 virtual coordinate space.
    const scale = canvas.width / VIRTUAL_WIDTH;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (liveShow && liveGuideline !== 'blank') {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      if (liveGuideline === 'typography') {
        ctx.strokeStyle = '#e7e5e4';
        [GUIDELINES.ascender, GUIDELINES.capHeight, GUIDELINES.descender].forEach((y) => {
          ctx.beginPath();
          ctx.moveTo(18, y);
          ctx.lineTo(VIRTUAL_WIDTH - 18, y);
          ctx.stroke();
        });
        ctx.strokeStyle = '#d6d3d1';
        ctx.beginPath();
        ctx.moveTo(18, GUIDELINES.midline);
        ctx.lineTo(VIRTUAL_WIDTH - 18, GUIDELINES.midline);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#a8a29e';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(18, GUIDELINES.baseline);
        ctx.lineTo(VIRTUAL_WIDTH - 18, GUIDELINES.baseline);
        ctx.stroke();
      } else if (liveGuideline === 'notebook') {
        ctx.strokeStyle = '#e7e5e4';
        for (let y = 40; y <= 360; y += 32) {
          ctx.beginPath();
          ctx.moveTo(18, y);
          ctx.lineTo(VIRTUAL_WIDTH - 18, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = '#a8a29e';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(18, GUIDELINES.baseline);
        ctx.lineTo(VIRTUAL_WIDTH - 18, GUIDELINES.baseline);
        ctx.stroke();
      } else {
        ctx.setLineDash([]);
        ctx.fillStyle = '#d6d3d1';
        for (let x = 30; x <= 370; x += 28) {
          for (let y = 30; y <= 370; y += 28) {
            ctx.beginPath();
            ctx.arc(x, y, 1.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.strokeStyle = '#a8a29e';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(20, GUIDELINES.baseline);
        ctx.lineTo(VIRTUAL_WIDTH - 20, GUIDELINES.baseline);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (liveActive.length === 0 && pending.length === 0) {
      ctx.save();
      ctx.font = '250px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(28, 25, 23, 0.05)';
      ctx.fillText(liveChar, VIRTUAL_WIDTH / 2, GUIDELINES.baseline);
      ctx.restore();
    }

    const drawStroke = (pts: Point[], width: number) => {
      if (pts.length === 0) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = livePen === 'pencil' ? '#334155' : '#1c1917';
      const w = livePen === 'marker' ? width * 1.35 : livePen === 'pencil' ? Math.max(2.5, width * 0.85) : width;
      if (pts.length === 1) {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }
      if (livePen === 'fountain') {
        for (let i = 0; i < pts.length - 1; i += 1) {
          const a = pts[i];
          const b = pts[i + 1];
          const angle = Math.atan2(b.y - a.y, b.x - a.x);
          ctx.lineWidth = Math.max(1.5, width * (0.5 + Math.abs(Math.cos(angle - Math.PI / 4)) * 0.9));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      } else {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i += 1) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }
      ctx.restore();
    };

    committed.forEach((s) => drawStroke(s, liveWidth));
    if (pending.length > 0) drawStroke(pending, liveWidth);
  }, []);

  const schedulePaint = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      paint();
    });
  }, [paint]);

  // Repaint after every render, and whenever the backing store is resized.
  useEffect(() => {
    schedulePaint();
  });

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // Size the square stage to whatever room the editor actually has.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      const side = Math.floor(Math.min(rect.width, rect.height));
      if (side < 160) return;
      if (side !== stageBox) setStageBox(side);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the backing store matched to the displayed size on every layout change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const display = canvas.getBoundingClientRect();
    const side = Math.max(1, Math.round((display.width || stageBox || VIRTUAL_WIDTH) * dpr));
    const square = Math.min(side, Math.max(1, Math.round((display.height || side / dpr) * dpr)));
    if (canvas.width !== square || canvas.height !== square) {
      canvas.width = square;
      canvas.height = square;
    }
    schedulePaint();
  }, [stageBox, schedulePaint]);

  // Lock page scroll (html + body) while the editor is open, otherwise the page
// behind the overlay can still be wheel/touch scrolled.
  useEffect(() => {
    const root = document.documentElement;
    const previousRoot = root.style.overflow;
    const previousBody = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousRoot;
      document.body.style.overflow = previousBody;
    };
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Load the character when the target changes.
  useEffect(() => {
    const loaded = character.strokes ? clone(character.strokes) : [];
    primaryRef.current = loaded;
    dirtyRef.current = false;
    setStrokes(loaded);
    setVariants(character.variants ? clone(character.variants) : []);
    setActiveVariant(-1);
    setUndoStack([]);
    setRedoStack([]);
    setSaveState('idle');
    setMilestone(null);
    activeStrokeRef.current = [];
    const ownCategory = character.category;
    if (ownCategory) setActiveTab(ownCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.char]);

  // Rotating writing tip.
  useEffect(() => {
    const id = window.setInterval(() => setTipIndex((i) => (i + 1) % WRITING_TIPS.length), 9000);
    return () => window.clearInterval(id);
  }, []);

  const quality = useMemo(
    () => analyzeCharacterStrokes(activeStrokes, VIRTUAL_WIDTH, VIRTUAL_HEIGHT),
    [activeStrokes],
  );

  const done = completedCount ?? allCharacterList.filter((c) => c.hasStrokes).length;
  const total = totalCount ?? allCharacterList.length;
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  const tabChars = useMemo(
    () => allCharacterList.filter((c) => c.category === activeTab),
    [allCharacterList, activeTab],
  );

  const currentIndex = allCharacterList.findIndex((c) => c.char === character.char);

  // ----------------------------------------------------------------- history
  const pushUndo = useCallback((snapshot: Stroke[]) => {
    setUndoStack((prev) => {
      const next = [...prev, clone(snapshot)];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
    setRedoStack([]);
  }, []);

  const writeStrokes = useCallback(
    (next: Stroke[]) => {
      dirtyRef.current = true;
      if (activeVariant === -1) {
        primaryRef.current = next;
        setStrokes(next);
      } else
        setVariants((prev) => {
          const copy = [...prev];
          copy[activeVariant] = next;
          return copy;
        });
    },
    [activeVariant],
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, clone(activeStrokes)]);
    writeStrokes(clone(previous));
  }, [undoStack, activeStrokes, writeStrokes]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, clone(activeStrokes)]);
    writeStrokes(clone(next));
  }, [redoStack, activeStrokes, writeStrokes]);

  const clear = useCallback(() => {
    if (activeStrokes.length === 0) return;
    pushUndo(activeStrokes);
    writeStrokes([]);
  }, [activeStrokes, pushUndo, writeStrokes]);

  // ------------------------------------------------------------------ canvas
  const toCanvasPoint = useCallback(
    (e: { clientX: number; clientY: number; pressure?: number }): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      return {
        x: ((e.clientX - rect.left) / rect.width) * VIRTUAL_WIDTH,
        y: ((e.clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT,
        pressure: e.pressure && e.pressure > 0 ? e.pressure : undefined,
      };
    },
    [],
  );

  // Eraser ring position, measured inside the square stage (not the viewport).
  const setStagePoint = useCallback((e: { clientX: number; clientY: number }) => {
    // Measure the canvas itself: the ring is absolutely positioned inside the
    // square stage, and stageRef is the larger centring wrapper around it.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    setEraserCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const eraseAt = useCallback(
    (point: Point) => {
      const radius = eraserRadius;
      const next: Stroke[] = [];
      let changed = false;
      activeStrokes.forEach((stroke) => {
        const survivors = stroke.filter((p) => Math.hypot(p.x - point.x, p.y - point.y) > radius);
        if (survivors.length !== stroke.length) {
          changed = true;
          if (survivors.length > 1) next.push(survivors);
        } else {
          next.push(stroke);
        }
      });
      if (!changed) return;
      if (!erasingRef.current) {
        erasingRef.current = true;
        pushUndo(activeStrokes);
      }
      writeStrokes(next);
    },
    [activeStrokes, eraserRadius, pushUndo, writeStrokes],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (pointerTypeRef.current === 'pen' && e.pointerType === 'touch') return;
      pointerTypeRef.current = e.pointerType;
      const point = toCanvasPoint(e);
      if (!point) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best effort */
      }
      isDrawingRef.current = true;
      erasingRef.current = false;
      if (tool === 'eraser') {
        setStagePoint(e);
        eraseAt(point);
        return;
      }
      pushUndo(activeStrokes);
      activeStrokeRef.current = [point];
      schedulePaint();
    },
    [tool, toCanvasPoint, eraseAt, pushUndo, activeStrokes, schedulePaint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === 'eraser') setStagePoint(e);
      if (!isDrawingRef.current) return;
      e.preventDefault();
      if (pointerTypeRef.current === 'pen' && e.pointerType === 'touch') return;

      if (tool === 'eraser') {
        // Consume every coalesced sample so fast drags erase without gaps.
        const samples = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
        const list = samples.length ? samples : [e.nativeEvent];
        list.forEach((sample) => {
          const p = toCanvasPoint(sample);
          if (p) eraseAt(p);
        });
        return;
      }

      const pts = activeStrokeRef.current;
      const push = (x: number, y: number) => {
        const last = pts[pts.length - 1];
        // Sub-pixel spacing keeps fast movement smooth instead of angular.
        if (last && Math.hypot(x - last.x, y - last.y) < 0.8) return;
        pts.push({ x, y });
      };
      const samples = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
      if (samples.length) {
        samples.forEach((sample) => {
          const p = toCanvasPoint(sample);
          if (p) push(p.x, p.y);
        });
      } else {
        const p = toCanvasPoint(e);
        if (p) push(p.x, p.y);
      }
      schedulePaint();
    },
    [tool, toCanvasPoint, eraseAt, schedulePaint],
  );

  const finishStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;
      erasingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture is best effort */
      }
      if (tool === 'eraser') return;
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = [];
      if (finished.length === 0) {
        setUndoStack((prev) => prev.slice(0, -1));
        schedulePaint();
        return;
      }
      writeStrokes([...activeStrokes, finished]);
    },
    [tool, writeStrokes, activeStrokes, schedulePaint],
  );

  // ------------------------------------------------------------------ saving
  const commit = useCallback((): boolean => {
    const primary = activeVariant === -1 ? activeStrokes : primaryRef.current;
    const finalVariants =
      activeVariant === -1 ? variants : variants.map((v, i) => (i === activeVariant ? activeStrokes : v));
    try {
      onSave(character.char, clone(primary), finalVariants.length ? clone(finalVariants) : undefined);
      if (activeVariant === -1) primaryRef.current = clone(primary);
      dirtyRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, [activeVariant, activeStrokes, variants, character.char, onSave]);

  const performSave = useCallback(() => {
    if (activeStrokes.length === 0) {
      commit();
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1200);
      return;
    }
    setSaveState('saving');
    window.setTimeout(() => {
      setSaveState(commit() ? 'saved' : 'error');
      window.setTimeout(() => setSaveState((s) => (s === 'error' ? 'error' : 'idle')), 1600);
    }, 260);
  }, [activeStrokes.length, commit]);

  // Autosave: debounced so pointer movement never triggers it.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const id = window.setTimeout(() => {
      setSaveState('saving');
      window.setTimeout(() => {
        setSaveState(commit() ? 'saved' : 'error');
      }, 200);
    }, 1400);
    return () => window.clearTimeout(id);
  }, [activeStrokes, commit]);

  // Milestones fire once, the first time the count crosses a threshold.
  useEffect(() => {
    const hit = [...MILESTONES].reverse().find((m) => done >= m.at);
    if (!hit || hit.at <= celebratedRef.current) return;
    celebratedRef.current = hit.at;
    setMilestone(hit.text);
    const id = window.setTimeout(() => setMilestone(null), 3600);
    return () => window.clearTimeout(id);
  }, [done]);

  const saveAndGo = useCallback(
    (go?: () => void) => {
      if (activeStrokes.length === 0) {
        commit();
        go?.();
        return;
      }
      setSaveState('saving');
      window.setTimeout(() => {
        const ok = commit();
        setSaveState(ok ? 'saved' : 'error');
        if (ok) go?.();
        else
          window.setTimeout(() => {
            setSaveState((s) => (s === 'error' ? 'error' : 'idle'));
          }, 1600);
      }, 260);
    },
    [activeStrokes.length, commit],
  );

  // Smart next: jump to the next character that still needs work.
  const nextIncomplete = useCallback(() => {
    if (allCharacterList.length === 0) return onNext;
    const idx = allCharacterList.findIndex((c) => c.char === character.char);
    for (let i = idx + 1; i < allCharacterList.length; i += 1) {
      if (!allCharacterList[i].hasStrokes) {
        return () => onSelectCharacter?.(allCharacterList[i].char);
      }
    }
    return onNext;
  }, [allCharacterList, character.char, onNext, onSelectCharacter]);

  const smartSaveAndNext = useCallback(() => {
    const go = nextIncomplete();
    saveAndGo(go);
  }, [nextIncomplete, saveAndGo]);

  // ----------------------------------------------------------------- variants
  const selectVariant = useCallback(
    (index: number) => {
      if (index === activeVariant) return;
      setActiveVariant(index);
      setUndoStack([]);
      setRedoStack([]);
      activeStrokeRef.current = [];
    },
    [activeVariant],
  );

  const addVariant = useCallback(() => {
    if (variants.length >= 3) return;
    setVariants((prev) => [...prev, []]);
    setActiveVariant(variants.length);
  }, [variants.length]);

  const confirmVariantDelete = useCallback(
    (index: number) => {
      const target = index === activeVariant ? activeStrokes : variants[index] ?? [];
      if (target.length === 0) {
        setVariants((prev) => prev.filter((_, i) => i !== index));
        if (activeVariant === index) setActiveVariant(-1);
        return;
      }
      setVariantToDelete(index);
    },
    [activeVariant, activeStrokes, variants],
  );

  const performVariantDelete = useCallback(() => {
    if (variantToDelete === null) return;
    const index = variantToDelete;
    setVariants((prev) => prev.filter((_, i) => i !== index));
    if (activeVariant === index) setActiveVariant(-1);
    else if (activeVariant > index) setActiveVariant(activeVariant - 1);
    setVariantToDelete(null);
  }, [variantToDelete, activeVariant]);

  const switchCharacter = useCallback(
    (char: string) => {
      if (char === character.char) return;
      commit();
      onSelectCharacter?.(char);
    },
    [character.char, commit, onSelectCharacter],
  );

  // -------------------------------------------------------------- shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        performSave();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        smartSaveAndNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        saveAndGo(() => onPrevious?.());
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === '1') {
        setTool('pen');
        setPenStyle('gel');
      } else if (e.key === '2') {
        setTool('pen');
        setPenStyle('fountain');
      } else if (e.key === '3') {
        setTool('pen');
        setPenStyle('marker');
      } else if (e.key === '4') {
        setTool('pen');
        setPenStyle('pencil');
      } else if (e.key.toLowerCase() === 'e') {
        setTool('eraser');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, performSave, smartSaveAndNext, saveAndGo, onPrevious, onClose]);

  const statusLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
      ? 'Saved'
      : saveState === 'error'
      ? "Couldn't save — your work is still here"
      : online
      ? 'Autosaved'
      : 'Saved locally';

  // The shortcut sheet floats over the panel so opening it never reflows or
  // pushes the controls out of view.
  useEffect(() => {
    if (!showShortcuts) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-shortcuts-panel]') || target.closest('[aria-label="Keyboard shortcuts"]')) return;
      setShowShortcuts(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowShortcuts(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showShortcuts]);

  const renderStage = (pad: string) => (
    <div
      ref={stageRef}
      className={`flex min-h-0 flex-1 items-center justify-center overflow-hidden ${pad}`}
    >
      <div
        data-testid="handwriting-stage"
        className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
        style={stageBox ? { width: stageBox, height: stageBox } : { width: '100%', aspectRatio: '1 / 1' }}
      >
        <canvas
          data-testid="editor-canvas"
          ref={canvasRef}
          className={`block h-full w-full touch-none select-none ${
            tool === 'eraser' ? (isHovering ? 'cursor-none' : 'cursor-default') : 'cursor-crosshair'
          }`}
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerEnter={() => setIsHovering(true)}
          onPointerLeave={() => {
            setIsHovering(false);
            setEraserCursor(null);
          }}
        />
        {tool === 'eraser' && isHovering && eraserCursor && stageBox ? (
          <div
            aria-hidden="true"
            data-testid="eraser-ring"
            className="pointer-events-none absolute rounded-full border-2 border-neutral-900 bg-neutral-900/10"
            style={{
              left: eraserCursor.x,
              top: eraserCursor.y,
              width: (eraserRadius / VIRTUAL_WIDTH) * stageBox * 2,
              height: (eraserRadius / VIRTUAL_HEIGHT) * stageBox * 2,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ) : null}
        {activeStrokes.length === 0 && activeStrokeRef.current.length === 0 ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-stone-300"
          >
            Write naturally
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      data-testid="handwriting-editor"
      className="fixed inset-0 z-[70] flex h-dvh w-full flex-col overflow-hidden bg-neutral-50 text-neutral-900"
    >
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
{/* ------------------------------------------------- LEFT: controls */}
        <aside className="relative flex max-h-[56dvh] w-full shrink-0 flex-col overflow-hidden border-b border-neutral-200 bg-white lg:max-h-none lg:h-full lg:w-[clamp(296px,25vw,352px)] lg:border-b-0 lg:border-r">
          <header className="shrink-0 border-b border-neutral-100 px-3 pb-2 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">
                  {projectName}
                </p>
                <p className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-serif text-base font-semibold leading-none text-neutral-900">
                    {done}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400">
                    / {total} written
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPanelOpen((v) => !v)}
                  title={panelOpen ? 'Hide controls' : 'Show controls'}
                  aria-label={panelOpen ? 'Hide controls' : 'Show controls'}
                  aria-expanded={panelOpen}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 lg:hidden"
                >
                  <SlidersHorizontal
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${panelOpen ? '' : 'rotate-90'}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setShowShortcuts((s) => !s)}
                  title="Keyboard shortcuts"
                  aria-label="Keyboard shortcuts"
                  aria-expanded={showShortcuts}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  <Keyboard className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded((s) => !s)}
                  title={isExpanded ? 'Restore layout' : 'Focus canvas'}
                  aria-label={isExpanded ? 'Restore layout' : 'Focus canvas'}
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onClose()}
                  title="Save and close"
                  aria-label="Save and close"
                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Font completion"
              >
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span
                aria-live="polite"
                title={statusLabel}
                aria-label={statusLabel}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none transition-colors ${
                  saveState === 'error'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : saveState === 'saving'
                    ? 'border-neutral-200 bg-neutral-100 text-neutral-500'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {saveState === 'saving' ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : saveState === 'error' ? (
                  <AlertCircle className="h-2.5 w-2.5" />
                ) : online ? (
                  <Cloud className="h-2.5 w-2.5" />
                ) : (
                  <CloudOff className="h-2.5 w-2.5" />
                )}
                {saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved' : online ? 'Autosaved' : 'Local'}
              </span>
            </div>
          </header>

          {/* Shortcut sheet: floats, never reflows the panel */}
          <div
            data-shortcuts-panel
            data-testid="editor-shortcuts"
            role="dialog"
            aria-label="Keyboard shortcuts"
            className={`absolute right-2 top-[3.4rem] z-30 w-[15.5rem] origin-top-right rounded-xl border border-neutral-200 bg-white p-2.5 shadow-lg transition-all duration-200 ease-out ${
              showShortcuts
                ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                : 'pointer-events-none translate-y-1 scale-[0.97] opacity-0'
            }`}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">Shortcuts</p>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-[10px] text-neutral-600">
              {[
                ['Enter', 'save & next'],
                ['\u2190', 'previous'],
                ['Ctrl+Z', 'undo'],
                ['Ctrl+Y', 'redo'],
                ['1\u20134', 'pens'],
                ['E', 'eraser'],
                ['Esc', 'close'],
              ].map(([key, label]) => (
                <React.Fragment key={key}>
                  <dt>
                    <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[9px] text-neutral-800">
                      {key}
                    </kbd>
                  </dt>
                  <dd className="self-center">{label}</dd>
                </React.Fragment>
              ))}
            </dl>
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2.5 ${
              panelOpen ? '' : 'hidden lg:flex'
            }`}
          >
            {/* mobile section switch — keeps every control reachable without scrolling */}
            <div className="mb-2 flex shrink-0 gap-1 rounded-lg bg-neutral-100 p-0.5 lg:hidden">
              {(['chars', 'tools'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPanelTab(key)}
                  aria-pressed={panelTab === key}
                  className={`flex-1 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                    panelTab === key ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {key === 'chars' ? 'Characters' : 'Tools'}
                </button>
              ))}
            </div>

            {/* ------------------------------------------------ characters */}
            <div
              className={`min-h-0 flex-1 flex-col gap-2.5 ${
                panelTab === 'chars' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <div className="flex shrink-0 items-center gap-2.5">
                <span
                  key={character.char}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 font-serif text-xl font-semibold text-neutral-900"
                >
                  {character.char}
                </span>
                <p className="min-w-0 flex-1 text-[10px] leading-tight text-neutral-500">
                  <span className="block truncate font-medium capitalize text-neutral-800">
                    {character.category}
                    {currentIndex >= 0 ? ` \u00b7 ${currentIndex + 1} of ${allCharacterList.length}` : ''}
                  </span>
                  <span className="truncate">{milestone ?? WRITING_TIPS[tipIndex]}</span>
                </p>
              </div>

              <div className="flex shrink-0 gap-1 rounded-lg bg-neutral-100 p-0.5">
                {CATEGORY_TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      aria-pressed={isActive}
                      className={`flex-1 cursor-pointer rounded-md px-1 py-1 font-mono text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                        isActive ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div
                className={`grid min-h-0 flex-1 content-start gap-1 ${
                  activeTab === 'uppercase' || activeTab === 'lowercase'
                    ? 'grid-cols-7 sm:grid-cols-9'
                    : 'grid-cols-7 sm:grid-cols-10'
                }`}
              >
                {tabChars.map((c) => {
                  const isCurrent = c.char === character.char;
                  return (
                    <button
                      key={c.char}
                      type="button"
                      onClick={() => switchCharacter(c.char)}
                      title={c.hasStrokes ? `${c.char} \u2014 completed` : `${c.char} \u2014 not written yet`}
                      aria-label={c.hasStrokes ? `${c.char}, completed` : `${c.char}, not written yet`}
                      aria-current={isCurrent}
                      className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-md border text-[11px] font-medium leading-none transition-all duration-150 hover:border-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                        isCurrent
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                          : c.hasStrokes
                          ? 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'
                          : 'border-dashed border-neutral-300 bg-white text-neutral-400 hover:border-neutral-500'
                      }`}
                    >
                      {c.char}
                      {c.hasStrokes ? (
                        <span
                          className={`absolute right-[3px] top-[3px] h-1 w-1 rounded-full bg-blue-500 transition-transform duration-200 ${
                            isCurrent ? 'scale-125' : ''
                          }`}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------ tools */}
            <div
              className={`min-h-0 flex-1 flex-col gap-2.5 ${
                panelTab === 'tools' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <div className="flex shrink-0 gap-1 rounded-lg bg-neutral-100 p-0.5">
                {(['pen', 'eraser'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTool(t)}
                    aria-pressed={tool === t}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                      tool === t ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    {t === 'pen' ? <PenTool className="h-3.5 w-3.5" /> : <Eraser className="h-3.5 w-3.5" />}
                    {t}
                  </button>
                ))}
              </div>

              {tool === 'pen' ? (
                <div className="grid shrink-0 grid-cols-4 gap-1">
                  {(['gel', 'fountain', 'marker', 'pencil'] as PenStyle[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPenStyle(s)}
                      aria-pressed={penStyle === s}
                      className={`cursor-pointer rounded-md border px-1 py-1.5 text-[10px] capitalize leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                        penStyle === s
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid shrink-0 grid-cols-3 gap-1">
                  {(['small', 'medium', 'large'] as EraserScale[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEraserScale(s)}
                      aria-pressed={eraserScale === s}
                      className={`cursor-pointer rounded-md border px-1 py-1.5 text-[10px] capitalize leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                        eraserScale === s
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {tool === 'pen' ? (
                <div className="flex shrink-0 gap-1">
                  {(Object.keys(PEN_WIDTHS) as (keyof typeof PEN_WIDTHS)[]).map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setStrokeWidth(PEN_WIDTHS[label])}
                      aria-pressed={strokeWidth === PEN_WIDTHS[label]}
                      className={`flex-1 cursor-pointer rounded-md border py-1 text-[10px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                        strokeWidth === PEN_WIDTHS[label]
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setShowGuidelines((v) => !v)}
                  aria-pressed={showGuidelines}
                  title={showGuidelines ? 'Hide guidelines' : 'Show guidelines'}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-1.5 text-[10px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                    showGuidelines
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                  }`}
                >
                  {showGuidelines ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
                {(['typography', 'notebook', 'dots', 'blank'] as GuidelineStyle[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setGuidelineStyle(s);
                      setShowGuidelines(s !== 'blank');
                    }}
                    aria-pressed={guidelineStyle === s}
                    className={`flex-1 cursor-pointer truncate rounded-md border px-1 py-1 text-[10px] capitalize leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                      guidelineStyle === s
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => selectVariant(-1)}
                  aria-pressed={activeVariant === -1}
                  className={`shrink-0 cursor-pointer rounded-md border px-1.5 py-1 text-[10px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 ${
                    activeVariant === -1
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                  }`}
                >
                  Main
                </button>
                {variants.map((v, i) => (
                  <span key={i} className="inline-flex min-w-0 items-center overflow-hidden rounded-md border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => selectVariant(i)}
                      aria-pressed={activeVariant === i}
                      className={`min-w-0 cursor-pointer truncate px-1.5 py-1 text-[10px] leading-none transition-colors ${
                        activeVariant === i ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      Alt {i + 1}
                      {v.length > 0 ? ' \u2022' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmVariantDelete(i)}
                      aria-label={`Delete alternate ${i + 1}`}
                      className="cursor-pointer px-1 py-1 text-neutral-400 transition-colors hover:text-rose-600"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                {variants.length < 3 ? (
                  <button
                    type="button"
                    onClick={addVariant}
                    aria-label="Add alternate"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md border border-dashed border-neutral-300 px-1.5 py-1 text-[10px] leading-none text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-900"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                ) : null}
              </div>

              <div className="mt-auto flex shrink-0 items-start gap-1.5 border-t border-neutral-100 pt-2 text-[10px] leading-snug">
                <span data-testid="editor-stroke-count" className="shrink-0 font-mono text-neutral-500">
                  {activeStrokes.length}
                  {activeStrokes.length === 1 ? ' stroke' : ' strokes'}
                </span>
                {activeStrokes.length === 0 ? (
                  <span className="truncate text-neutral-400">Start writing \u2014 nothing is lost, it autosaves.</span>
                ) : (
                  <span
                    className={
                      quality.status === 'good'
                        ? 'text-emerald-600'
                        : quality.status === 'warning'
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }
                  >
                    {quality.feedback}
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>
        {/* ------------------------------------------------- RIGHT: editor */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-neutral-50">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2">
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-neutral-400">Writing</span>
              <span
                data-testid="editor-current-char"
                className="font-serif text-lg font-semibold leading-none text-neutral-900"
              >
                {character.char}
              </span>
            </p>
            {milestone ? (
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{milestone}</span>
              </span>
            ) : null}
          </div>

          {variantToDelete !== null ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-2 text-[11px] text-rose-800">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Delete alternate {variantToDelete + 1}? Its strokes will be removed.
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setVariantToDelete(null)}
                  className="cursor-pointer rounded-md border border-rose-200 bg-white px-2 py-1 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={performVariantDelete}
                  className="cursor-pointer rounded-md bg-rose-700 px-2 py-1 font-medium text-white transition-colors hover:bg-rose-800"
                >
                  Delete
                </button>
              </span>
            </div>
          ) : null}

          {renderStage(isExpanded ? '' : 'px-0 py-0')}

          {/* sticky action bar */}
          <div className="shrink-0 border-t border-neutral-200 bg-white px-3 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Redo
                </button>
                <button
                  type="button"
                  onClick={clear}
                  disabled={activeStrokes.length === 0}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-medium text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {hasPrevious && onPrevious ? (
                  <button
                    type="button"
                    onClick={() => saveAndGo(() => onPrevious())}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={performSave}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-900 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={smartSaveAndNext}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  Save &amp; Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
