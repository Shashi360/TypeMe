import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Edit2,
  Eraser,
  Maximize2,
  Minimize2,
  PenTool,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  CharacterData,
  FontProject,
  Point,
  Stroke,
} from "../types";
import type { QualityAnalysis } from "../utils/qualityCheck";
import { analyzeCharacterStrokes } from "../utils/qualityCheck";

const analyzeQuality = (strokes: Stroke[]) => analyzeCharacterStrokes(strokes, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

const VIRTUAL_WIDTH = 400;
const VIRTUAL_HEIGHT = 400;

const MIN_POINT_SPACING = 0.8;
const MAX_POINTER_SAMPLES = 3;

type BrushType = "gel" | "fountain" | "marker" | "pencil";
type StrokeSize = "fine" | "regular" | "bold";
type CanvasStyle = "typography" | "notebook" | "dots" | "blank";
type ToolMode = "pen" | "eraser";

interface HandwritingCanvasProps {
  character: CharacterData;
  project?: FontProject;
  onSave: (data: CharacterData) => Promise<void> | void;
  onNext: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  completedCount?: number;
  totalCount?: number;
  projectName?: string;
  onClose?: () => void;
  allCharacterList?: { char: string; category: string; hasStrokes: boolean }[];
  onSelectCharacter?: (char: string) => void;
}

const BrushConfig = {
  gel: { lineWidthMultiplier: 1.05, opacity: 0.98 },
  fountain: { lineWidthMultiplier: 0.92, opacity: 0.96 },
  marker: { lineWidthMultiplier: 1.25, opacity: 0.94 },
  pencil: { lineWidthMultiplier: 0.85, opacity: 0.88 },
} as const;

const SizeConfig = {
  fine: 1.25,
  regular: 1.8,
  bold: 2.6,
} as const;

interface StrokeStyle {
  brush: BrushType;
  size: StrokeSize;
}

interface HistoryEntry {
  v: number;
  s: Stroke[];
  vs: Stroke[][];
  ss: StrokeStyle[];
  vss: StrokeStyle[][];
}

const cloneStrokes = (s: Stroke[]): Stroke[] => s.map((pts) => pts.map((p) => ({ ...p })));
const cloneVariants = (vs: Stroke[][]): Stroke[][] => vs.map((v) => cloneStrokes(v));
const cloneStyles = (ss: StrokeStyle[]): StrokeStyle[] => ss.map((s) => ({ ...s }));
const cloneVariantStyles = (vss: StrokeStyle[][]): StrokeStyle[][] => vss.map((v) => cloneStyles(v));

const styleFrom = (s: unknown, fallbackBrush: BrushType, fallbackSize: StrokeSize): StrokeStyle => {
  const b = (s as Partial<StrokeStyle> | null)?.brush;
  const z = (s as Partial<StrokeStyle> | null)?.size;
  return {
    brush: b === "gel" || b === "fountain" || b === "marker" || b === "pencil" ? b : fallbackBrush,
    size: z === "fine" || z === "regular" || z === "bold" ? z : fallbackSize,
  };
};

const getBrushColor = (brush: BrushType) => {
  switch (brush) {
    case "gel":
      return "#111111";
    case "fountain":
      return "#1A1A1A";
    case "marker":
      return "#0F0F0F";
    case "pencil":
      return "#1F1F1F";
    default:
      return "#111111";
  }
};

export const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  character,
  project,
  onSave,
  onNext,
  onPrevious,
  hasNext = true,
  hasPrevious = false,
  completedCount = 0,
  totalCount = 0,
  projectName = "My Handwriting",
  onClose,
  allCharacterList,
  onSelectCharacter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [strokes, setStrokes] = useState<Stroke[]>(character.strokes ?? []);
  const [variants, setVariants] = useState<Stroke[][]>(
    Array.isArray(character.variants) ? character.variants : [],
  );
  const [strokeStyles, setStrokeStyles] = useState<StrokeStyle[]>(() =>
    (character.strokes ?? []).map((_, i) => styleFrom((character as { strokeStyles?: unknown[] }).strokeStyles?.[i], "gel", "regular")),
  );
  const [variantStyles, setVariantStyles] = useState<StrokeStyle[][]>(() =>
    (Array.isArray(character.variants) ? character.variants : []).map((v, vi) =>
      v.map((_, si) => styleFrom((character as { variantStyles?: unknown[][] }).variantStyles?.[vi]?.[si], "gel", "regular")),
    ),
  );
  const [activeVariant, setActiveVariant] = useState<number>(-1);
  const [currentStroke, setCurrentStroke] = useState<Point[] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>("pen");
  const [brushType, setBrushType] = useState<BrushType>("gel");
  const [strokeSize, setStrokeSize] = useState<StrokeSize>("regular");
  const [canvasStyle, setCanvasStyle] = useState<CanvasStyle>("typography");
  const [eraserSize, setEraserSize] = useState(24);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showQuality, setShowQuality] = useState(false);
  const [quality, setQuality] = useState<QualityAnalysis | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [variantToDelete, setVariantToDelete] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  const [pointerId, setPointerId] = useState<number | null>(null);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [lastPointerTime, setLastPointerTime] = useState<number>(0);
  const [pointerSamples, setPointerSamples] = useState<Point[]>([]);
  const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const isEraser = toolMode === "eraser";

  const activeStrokes = useMemo(() => {
    if (activeVariant === -1) return strokes;
    return variants[activeVariant] ?? [];
  }, [activeVariant, strokes, variants]);

  const activeStyles = useMemo(() => {
    if (activeVariant === -1) return strokeStyles;
    return variantStyles[activeVariant] ?? [];
  }, [activeVariant, strokeStyles, variantStyles]);

  const setActiveStrokes = useCallback(
    (next: Stroke[], nextStyles?: StrokeStyle[]) => {
      if (activeVariant === -1) {
        setStrokes(next);
        if (nextStyles) setStrokeStyles(nextStyles);
      } else {
        setVariants((prev) => {
          const updated = [...prev];
          updated[activeVariant] = next;
          return updated;
        });
        if (nextStyles) {
          setVariantStyles((prev) => {
            const updated = [...prev];
            updated[activeVariant] = nextStyles;
            return updated;
          });
        }
      }
      setIsDirty(true);
    },
    [activeVariant],
  );

  const snapshotNow = useCallback(
    (): HistoryEntry => ({
      v: activeVariant,
      s: cloneStrokes(strokes),
      vs: cloneVariants(variants),
      ss: cloneStyles(strokeStyles),
      vss: cloneVariantStyles(variantStyles),
    }),
    [activeVariant, strokes, variants, strokeStyles, variantStyles],
  );

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, snapshotNow()]);
    setRedoStack([]);
  }, [snapshotNow]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, snapshotNow()]);
    setActiveVariant(snapshot.v);
    setStrokes(cloneStrokes(snapshot.s));
    setVariants(cloneVariants(snapshot.vs));
    setStrokeStyles(cloneStyles(snapshot.ss));
    setVariantStyles(cloneVariantStyles(snapshot.vss));
    setCurrentStroke(null);
    setIsDirty(true);
  }, [snapshotNow, undoStack.length]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, snapshotNow()]);
    setActiveVariant(snapshot.v);
    setStrokes(cloneStrokes(snapshot.s));
    setVariants(cloneVariants(snapshot.vs));
    setStrokeStyles(cloneStyles(snapshot.ss));
    setVariantStyles(cloneVariantStyles(snapshot.vss));
    setCurrentStroke(null);
    setIsDirty(true);
  }, [redoStack.length, snapshotNow]);

  const clear = useCallback(() => {
    if (activeStrokes.length === 0) return;
    pushUndo();
    setActiveStrokes([], []);
    setCurrentStroke(null);
    setQuality(null);
    setShowQuality(false);
  }, [activeStrokes.length, pushUndo, setActiveStrokes]);

  const removeVariant = useCallback(
    (idx: number) => {
      pushUndo();
      setVariants((prev) => prev.filter((_, i) => i !== idx));
      setVariantStyles((prev) => prev.filter((_, i) => i !== idx));
      if (activeVariant === idx) {
        setActiveVariant(-1);
      } else if (activeVariant > idx) {
        setActiveVariant(activeVariant - 1);
      }
      setVariantToDelete(null);
      setIsDirty(true);
    },
    [activeVariant, pushUndo],
  );

  const addVariant = useCallback(() => {
    // Maximum 4 total per character: Main + up to 3 alternates.
    if (variants.length >= 3) return;
    pushUndo();
    setVariants((prev) => [...prev, []]);
    setVariantStyles((prev) => [...prev, []]);
    setActiveVariant(variants.length);
    setIsDirty(true);
  }, [pushUndo, variants.length]);

  // Reset local glyph state whenever a different character is opened.
  // The same component instance is reused across A → B → A, so without
  // this the previous character's strokes/undo history would leak through.
  const charKeyRef = useRef(character.char);
  useEffect(() => {
    if (charKeyRef.current === character.char) return;
    charKeyRef.current = character.char;
    setStrokes(character.strokes ?? []);
    setVariants(Array.isArray(character.variants) ? character.variants : []);
    setStrokeStyles(
      (character.strokes ?? []).map((_, i) =>
        styleFrom((character as { strokeStyles?: unknown[] }).strokeStyles?.[i], "gel", "regular"),
      ),
    );
    setVariantStyles(
      (Array.isArray(character.variants) ? character.variants : []).map((v, vi) =>
        v.map((_, si) =>
          styleFrom((character as { variantStyles?: unknown[][] }).variantStyles?.[vi]?.[si], "gel", "regular"),
        ),
      ),
    );
    setActiveVariant(-1);
    setUndoStack([]);
    setRedoStack([]);
    setCurrentStroke(null);
    setQuality(null);
    setShowQuality(false);
    setVariantToDelete(null);
    setValidationMsg(null);
    setIsDirty(false);
  }, [character]);

  const switchVariant = useCallback(
    (idx: number) => {
      setActiveVariant(idx);
      setCurrentStroke(null);
      setQuality(null);
      setShowQuality(false);
    },
    [],
  );

  const performVariantDelete = useCallback(() => {
    if (variantToDelete === null) return;
    removeVariant(variantToDelete);
  }, [removeVariant, variantToDelete]);

  const performSave = useCallback(async () => {
    try {
      setIsSaving(true);
      const data: CharacterData = {
        ...character,
        strokes,
        variants,
        strokeStyles: cloneStyles(strokeStyles),
        variantStyles: cloneVariantStyles(variantStyles),
        lastUpdated: Date.now(),
      } as CharacterData;
      await onSave(data);
      setIsDirty(false);
      setValidationMsg(null);
      setLastSavedAt(Date.now());
    } catch (err) {
      console.error("Failed to save character:", err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [character, onSave, strokes, variants, strokeStyles, variantStyles]);

  const hasContent = useCallback(
    () => strokes.length > 0 || variants.some((v) => v.length > 0),
    [strokes.length, variants],
  );

  const requireContent = useCallback(() => {
    if (hasContent()) {
      setValidationMsg(null);
      return true;
    }
    setValidationMsg(`Write “${character.char}” first — draw something before saving.`);
    return false;
  }, [character.char, hasContent]);

  const handleSave = useCallback(() => {
    if (!requireContent()) return;
    performSave().catch(() => {});
  }, [performSave, requireContent]);

  const smartSaveAndNext = useCallback(async () => {
    if (!requireContent()) return;
    try {
      await performSave();
      setValidationMsg(null);
      onNext();
    } catch (err) {
      console.error("Save failed, not advancing:", err);
    }
  }, [onNext, performSave, requireContent]);

  const saveAndGo = useCallback(
    async (fn: () => void) => {
      try {
        await performSave();
        fn();
      } catch (err) {
        console.error("Save failed:", err);
      }
    },
    [performSave],
  );

  const runQualityCheck = useCallback(() => {
    const analysis = analyzeQuality(activeStrokes);
    setQuality(analysis);
    setShowQuality(true);
  }, [activeStrokes]);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      // Always map against the canvas element itself (not the padded
      // container) so the stroke lands exactly under the cursor/finger.
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const x = ((clientX - rect.left) / rect.width) * VIRTUAL_WIDTH;
      const y = ((clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT;
      if (Number.isNaN(x) || Number.isNaN(y)) return null;
      return { x, y };
    },
    [],
  );

  const eraseAt = useCallback(
    (p: Point) => {
      // Stroke-level erase: any stroke touched by the eraser is removed
      // whole, so it stays erased after redraw/switch/save. The eraser
      // slider is in screen px — convert it into virtual canvas units.
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const vRadius =
        rect && rect.width > 0
          ? Math.max(3, (eraserSize / rect.width) * VIRTUAL_WIDTH)
          : Math.max(3, eraserSize / 2);
      const next: Stroke[] = [];
      const nextStyles: StrokeStyle[] = [];
      activeStrokes.forEach((pts, i) => {
        const hit = pts.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) <= vRadius);
        if (!hit) {
          next.push(pts);
          nextStyles.push(activeStyles[i] ?? { brush: brushType, size: strokeSize });
        }
      });
      if (next.length !== activeStrokes.length) {
        setActiveStrokes(next, nextStyles);
      }
    },
    [activeStrokes, activeStyles, brushType, eraserSize, setActiveStrokes, strokeSize],
  );

  const capturePointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore — pointer capture is best-effort
    }
  }, []);

  const releasePointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  }, []);

  const startDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      capturePointer(e);
      if (isEraser) {
        pushUndo();
        setIsDrawing(true);
        setPointerId(e.pointerId);
        const p = getCanvasPoint(e.clientX, e.clientY);
        if (p) {
          // Erase immediately so a single tap also erases.
          eraseAt(p);
          setLastPoint(p);
          setLastPointerTime(e.timeStamp);
          setPointerSamples([p]);
          setEraserPos({ x: e.clientX, y: e.clientY });
        }
        e.preventDefault();
        return;
      }
      pushUndo();
      setIsDrawing(true);
      setPointerId(e.pointerId);
      const p = getCanvasPoint(e.clientX, e.clientY);
      if (p) {
        const pWithT: Point = { x: p.x, y: p.y };
        setCurrentStroke([pWithT]);
        setLastPoint(pWithT);
        setLastPointerTime(e.timeStamp);
        setPointerSamples([pWithT]);
      }
      e.preventDefault();
    },
    [capturePointer, eraseAt, getCanvasPoint, isEraser, pushUndo],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Layout determines CSS size; JS only adapts the internal bitmap.
    // Never write canvas.style.width/height here — that leaks the bitmap
    // size into CSS layout and forces the center column wider (feedback loop).
    const canvasRect = canvas.getBoundingClientRect();
    let cssW = canvasRect.width || 0;
    let cssH = canvasRect.height || 0;
    if (!cssW || !cssH) {
      const rect = container.getBoundingClientRect();
      const padX = container.clientWidth ? Math.max(0, rect.width - container.clientWidth) : 0;
      const padY = container.clientHeight ? Math.max(0, rect.height - container.clientHeight) : 0;
      cssW = Math.max(1, rect.width - padX);
      cssH = Math.max(1, rect.height - padY);
    }
    const scale = dpr;
    if (canvas.width !== Math.floor(cssW * scale) || canvas.height !== Math.floor(cssH * scale)) {
      canvas.width = Math.floor(cssW * scale);
      canvas.height = Math.floor(cssH * scale);
    }
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(w / VIRTUAL_WIDTH, h / VIRTUAL_HEIGHT);

    if (canvasStyle !== "blank") {
      ctx.save();
      ctx.globalAlpha = canvasStyle === "typography" ? 0.13 : 0.1;
      ctx.strokeStyle = "#9CA3AF";
      ctx.lineWidth = 0.7;
      ctx.setLineDash([2, 4]);
      const capY = VIRTUAL_HEIGHT * 0.24;
      const upperY = VIRTUAL_HEIGHT * 0.36;
      const baseY = VIRTUAL_HEIGHT * 0.64;
      const descY = VIRTUAL_HEIGHT * 0.8;
      if (canvasStyle === "typography" || canvasStyle === "notebook") {
        ctx.beginPath();
        ctx.moveTo(10, capY);
        ctx.lineTo(VIRTUAL_WIDTH - 10, capY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, upperY);
        ctx.lineTo(VIRTUAL_WIDTH - 10, upperY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, baseY);
        ctx.lineTo(VIRTUAL_WIDTH - 10, baseY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, descY);
        ctx.lineTo(VIRTUAL_WIDTH - 10, descY);
        ctx.stroke();
      }
      if (canvasStyle === "notebook") {
        ctx.globalAlpha = 0.09;
        ctx.setLineDash([1, 6]);
        for (let y = 24; y <= VIRTUAL_HEIGHT - 20; y += 18) {
          ctx.beginPath();
          ctx.moveTo(10, y);
          ctx.lineTo(VIRTUAL_WIDTH - 10, y);
          ctx.stroke();
        }
      }
      if (canvasStyle === "dots") {
        ctx.globalAlpha = 0.1;
        ctx.setLineDash([]);
        const spacing = 16;
        for (let x = 20; x < VIRTUAL_WIDTH - 20; x += spacing) {
          for (let y = 20; y < VIRTUAL_HEIGHT - 20; y += spacing) {
            ctx.beginPath();
            ctx.arc(x, y, 0.7, 0, Math.PI * 2);
            ctx.fillStyle = "#9CA3AF";
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.font = "bold 160px ui-serif, Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0F172A";
    ctx.fillText(character.char, VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
    ctx.restore();

    const allStrokes = activeStrokes;
    for (let i = 0; i < allStrokes.length; i++) {
      const pts = allStrokes[i];
      if (pts.length < 1) continue;
      // Each stored stroke keeps the brush/size it was drawn with, so
      // changing tools only affects new strokes — never old ones.
      const st = activeStyles[i] ?? { brush: brushType, size: strokeSize };
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = getBrushColor(st.brush);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = BrushConfig[st.brush].opacity;
      const baseWidth = 1.2 * SizeConfig[st.size] * BrushConfig[st.brush].lineWidthMultiplier;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, baseWidth * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.beginPath();
        for (let j = 0; j < pts.length; j++) {
          const p = pts[j];
          if (j === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.lineWidth = baseWidth;
        ctx.stroke();
      }
      ctx.restore();
    }

    if (currentStroke && currentStroke.length > 0 && !isEraser) {
      ctx.save();
      ctx.strokeStyle = getBrushColor(brushType);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = BrushConfig[brushType].opacity;
      const baseWidth = 1.2 * SizeConfig[strokeSize] * BrushConfig[brushType].lineWidthMultiplier;
      if (currentStroke.length === 1) {
        ctx.beginPath();
        ctx.arc(currentStroke[0].x, currentStroke[0].y, baseWidth * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      } else {
        ctx.beginPath();
        for (let j = 0; j < currentStroke.length; j++) {
          const p = currentStroke[j];
          if (j === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.lineWidth = baseWidth;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }, [activeStrokes, activeStyles, brushType, canvasStyle, character.char, currentStroke, dpr, isEraser, strokeSize]);

  const moveDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || (pointerId !== null && e.pointerId !== pointerId)) return;
      const p = getCanvasPoint(e.clientX, e.clientY);
      if (!p) return;
      setEraserPos({ x: e.clientX, y: e.clientY });
      const now = e.timeStamp;
      const dt = now - lastPointerTime;
      const dist = lastPoint ? Math.hypot(p.x - lastPoint.x, p.y - lastPoint.y) : 0;
      const shouldAdd = lastPoint === null || dist >= MIN_POINT_SPACING || dt > 32;
      if (shouldAdd) {
        const pWithT: Point = { x: p.x, y: p.y };
        setPointerSamples((prev) => [...prev.slice(-MAX_POINTER_SAMPLES), pWithT]);
        if (isEraser) {
          eraseAt(pWithT);
          setLastPoint(pWithT);
          setLastPointerTime(now);
        } else {
          setCurrentStroke((prev) => (prev ? [...prev, pWithT] : [pWithT]));
          setLastPoint(pWithT);
          setLastPointerTime(now);
        }
      }
      e.preventDefault();
    },
    [eraseAt, getCanvasPoint, isDrawing, isEraser, lastPoint, lastPointerTime, pointerId],
  );

  const endDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (pointerId !== null && e.pointerId !== pointerId) return;
      releasePointer(e);
      setIsDrawing(false);
      setPointerId(null);
      setEraserPos(null);
      if (!isEraser && currentStroke && currentStroke.length > 0) {
        const stroke: Stroke = currentStroke.map((p) => ({ x: p.x, y: p.y }));
        setActiveStrokes([...activeStrokes, stroke], [...activeStyles, { brush: brushType, size: strokeSize }]);
        setCurrentStroke(null);
        setValidationMsg(null);
      }
      setLastPoint(null);
      setPointerSamples([]);
      e.preventDefault();
    },
    [activeStrokes, activeStyles, brushType, currentStroke, isEraser, pointerId, releasePointer, setActiveStrokes, strokeSize],
  );

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerId !== null && e.pointerId !== pointerId) return;
    releasePointer(e);
    setIsDrawing(false);
    setPointerId(null);
    setCurrentStroke(null);
    setLastPoint(null);
    setPointerSamples([]);
    setEraserPos(null);
    e.preventDefault();
  }, [pointerId, releasePointer]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  useEffect(() => {
    const handleResize = () => {
      draw();
      setDpr(window.devicePixelRatio || 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current ?? document.documentElement;
    if (!document.fullscreenElement) {
      (el.requestFullscreen as (() => Promise<void>) | undefined)?.call(el)?.then(
        () => setIsFullscreen(true),
        () => {},
      );
    } else {
      (document.exitFullscreen as (() => Promise<void>) | undefined)?.call(document)?.then(
        () => setIsFullscreen(false),
        () => {},
      );
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setDpr(window.devicePixelRatio || 1);
      draw();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [draw]);

  const handleClose = useCallback(() => {
    if (!onClose) return;
    // Flush any pending work before leaving so nothing is lost.
    saveAndGo(() => onClose());
  }, [onClose, saveAndGo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      // Single-key shortcuts must not hijack normal typing.
      if (typing && !e.metaKey && !e.ctrlKey) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          redo();
        } else if (e.key === "s") {
          e.preventDefault();
          performSave().catch(() => {});
        }
      }
      if (e.key === "e") {
        e.preventDefault();
        setToolMode((prev) => (prev === "eraser" ? "pen" : "eraser"));
      }
      if (e.key === "p") {
        e.preventDefault();
        setToolMode("pen");
      }
      if (e.key === "c" && e.shiftKey) {
        e.preventDefault();
        clear();
      }
      if (e.key === "q") {
        e.preventDefault();
        runQualityCheck();
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcuts((s) => !s);
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        setVariantToDelete(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clear, performSave, redo, runQualityCheck, undo]);

  useEffect(() => {
    let timeout: number | undefined;
    if (isDirty) {
      timeout = window.setTimeout(() => {
        performSave().catch(() => {});
      }, 800);
    }
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [isDirty, performSave]);

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isCompleted =
    strokes.length > 0 || variants.some((v) => v.length > 0);
  const category = character.category || "uppercase";
  const proj: any = project || {};
  const charsObj = proj?.characters;
  const allChars: CharacterData[] = Array.isArray(charsObj)
    ? charsObj
    : typeof charsObj === "object" && charsObj !== null
      ? Object.values(charsObj)
      : [];

  const categoryGroups = useMemo(() => {
    const upper = allChars.filter((c: any) => (c.category || "uppercase") === "uppercase");
    const lower = allChars.filter((c: any) => c.category === "lowercase");
    const nums = allChars.filter((c: any) => c.category === "numbers");
    const symbols = allChars.filter((c: any) => c.category === "symbols");
    return { upper, lower, nums, symbols };
  }, [allChars]);

  const getCategoryProgress = (group: CharacterData[]) => {
    const done = group.filter((c: any) => (c as any)?.completed || (c.strokes?.length ?? 0) > 0).length;
    return { done, total: group.length };
  };

  const alpha = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const alphaLower = Array.from("abcdefghijklmnopqrstuvwxyz");
  const digits = Array.from("0123456789");
  const symbolsList = ["!", "@", "#", "$", "%", "&", "*", "(", ")", "-", "_", "+", "=", "{", "}", "[", "]", "|", "\\", "/", "?", "<", ">", ",", ".", ";", ":", "'", '"'];

  const renderCharGrid = (list: string[]) => (
    <div className="grid grid-cols-6 gap-1.5 px-3 pb-2">
      {list.map((ch) => {
        const charData = allChars.find((c: any) => c.char === ch);
        const completed = (charData as any)?.completed || (charData?.strokes?.length ?? 0) > 0;
        const isCurrent = character.char === ch;
        return (
          <button
            key={ch}
            type="button"
            onClick={() => {
              saveAndGo(() => {
                if (onSelectCharacter) {
                  onSelectCharacter(ch);
                } else {
                  window.dispatchEvent(new CustomEvent("typeme:select-char", { detail: ch }));
                }
              });
            }}
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-medium transition-all ${
              isCurrent
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : completed
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            {ch}
            {completed && !isCurrent ? (
              <Check className="absolute -right-0.5 -top-0.5 h-3 w-3 text-emerald-600" />
            ) : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-[#FAFAF7] overflow-hidden"
      data-testid="handwriting-canvas"
    >
      {/* Decorative blurred accents - subtle */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-10 h-40 w-40 rounded-full bg-sky-200/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 top-32 h-40 w-40 rounded-full bg-purple-200/20 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-20 left-1/3 h-32 w-32 rounded-full bg-amber-100/30 blur-3xl" />

      {/* Top Application Bar */}
      <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#E8E8E3] bg-white/95 px-2 shadow-sm backdrop-blur sm:h-16 sm:px-4 md:h-[68px] lg:h-[72px]">
        {/* Left */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-sm">
              <span className="font-handwriting text-xl font-bold text-amber-200">M</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-baseline">
                <span className="text-sm font-bold tracking-tight text-neutral-900 sm:text-base">Type</span>
                <span className="font-handwriting text-lg font-bold italic text-neutral-900 sm:text-xl -ml-0.5">Me</span>
              </span>
              <span className="hidden text-sm font-medium text-neutral-500 sm:inline">•</span>
              <span className="hidden truncate text-sm font-medium text-neutral-700 sm:inline">{projectName}</span>
              <Edit2 className="ml-1 h-3.5 w-3.5 text-neutral-400" />
            </div>
          </div>
          <div className="hidden items-center gap-2.5 rounded-full border border-[#E8E8E3] bg-neutral-50 px-3 py-1.5 lg:flex">
            <span className="text-xs font-medium text-neutral-600">
              {completedCount} / {totalCount} written
            </span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        {/* Center */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
          <div className="flex items-center gap-2 rounded-full border border-[#E8E8E3] bg-white px-2.5 py-1 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 font-serif text-base font-semibold text-white">
              {character.char}
            </span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-neutral-400">Current</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 sm:flex">
            {isSaving || isDirty ? (
              <span>Saving…</span>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label="Saved" />
                <span>Autosaved</span>
              </>
            )}
            <Check className="h-3.5 w-3.5" />
          </div>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E8E3] bg-white text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E8E3] bg-white text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm">
            <Crown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pro Plan</span>
          </div>
        </div>
      </header>

      {/* Main workspace */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 p-2 sm:gap-4 sm:p-3 lg:p-4">
        {/* Top row: sidebar + canvas + tools */}
        <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-2 overflow-hidden sm:gap-3 md:grid-cols-[minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_220px] xl:grid-cols-[260px_minmax(0,1fr)_240px] lg:px-2">
          {/* Left Sidebar */}
          <aside className="hidden h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E8E8E3] bg-white shadow-sm lg:flex">
            {/* Categories */}
            <div className="flex flex-col gap-2 p-3">
              {(
                [
                  { key: "upper", name: "A–Z", count: getCategoryProgress(categoryGroups.upper), active: category === "uppercase", bg: "bg-sky-50", border: "border-sky-100" },
                  { key: "lower", name: "a–z", count: getCategoryProgress(categoryGroups.lower), active: category === "lowercase", bg: "bg-violet-50", border: "border-violet-100" },
                  { key: "nums", name: "0–9", count: getCategoryProgress(categoryGroups.nums), active: category === "numbers", bg: "bg-amber-50", border: "border-amber-100" },
                  { key: "symbols", name: "Symbols", count: getCategoryProgress(categoryGroups.symbols), active: category === "symbols", bg: "bg-pink-50", border: "border-pink-100" },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    // Switch category without forcing scroll; preserve first char selection if desired
                    const group = cat.key === "upper" ? alpha : cat.key === "lower" ? alphaLower : cat.key === "nums" ? digits : symbolsList;
                    if (group[0]) {
                      saveAndGo(() => {
                        if (onSelectCharacter) onSelectCharacter(group[0]);
                        else window.dispatchEvent(new CustomEvent("typeme:select-char", { detail: group[0] }));
                      });
                    }
                  }}
                  className={`group flex items-center justify-between rounded-xl border p-2.5 text-left transition-all hover:shadow-sm ${
                    cat.active ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : `${cat.bg} ${cat.border}`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold shadow-sm ${
                        cat.active ? "bg-white/15 text-white" : "bg-white/90 text-neutral-800"
                      }`}
                    >
                      {cat.key === "upper" ? "A" : cat.key === "lower" ? "a" : cat.key === "nums" ? "0" : "#"}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-xs font-semibold ${cat.active ? "text-white" : "text-neutral-900"}`}>{cat.name}</span>
                      <span className={`text-[10px] ${cat.active ? "text-neutral-300" : "text-neutral-500"}`}>
                        {cat.count.done} / {cat.count.total}
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${cat.active ? "text-neutral-300" : "text-neutral-400"}`}
                  />
                </button>
              ))}
            </div>

            {/* Character grid for selected category */}
            <div className="flex min-h-0 flex-1 flex-col border-t border-[#E8E8E3]">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  {category === "uppercase" ? "A–Z" : category === "lowercase" ? "a–z" : category === "numbers" ? "0–9" : "Symbols"}
                </span>
                <span className="text-[10px] text-neutral-400">{completedCount}/{totalCount}</span>
              </div>
              <div className="flex flex-1 flex-wrap content-start justify-start gap-1 overflow-hidden px-3 pb-3">
                {(category === "uppercase" ? alpha : category === "lowercase" ? alphaLower : category === "numbers" ? digits : symbolsList).map((ch) => {
                  const cd = allChars.find((c: any) => c.char === ch);
                  const done = (cd as any)?.completed || (cd?.strokes?.length ?? 0) > 0;
                  const cur = character.char === ch;
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        saveAndGo(() => {
                          if (onSelectCharacter) onSelectCharacter(ch);
                          else window.dispatchEvent(new CustomEvent("typeme:select-char", { detail: ch }));
                        });
                      }}
                      className={`relative flex h-7 w-7 items-center justify-center rounded-md border text-xs font-medium transition-all ${
                        cur ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {ch}
                      {done && !cur ? <Check className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 text-emerald-600" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom motivational removed as requested */}
          </aside>

          {/* Center Canvas */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center">
            <div className="flex w-full min-w-0 max-w-full flex-1 flex-col items-center rounded-2xl border border-[#E8E8E3] bg-white shadow-sm sm:rounded-3xl lg:max-w-[min(100%,920px)] xl:max-w-[min(100%,980px)] 2xl:max-w-[min(100%,1040px)]">
              {/* Canvas header */}
              <div className="flex shrink-0 flex-col items-center gap-2 border-b border-[#E8E8E3] px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 font-serif text-2xl font-semibold text-neutral-900 shadow-sm sm:h-12 sm:w-12 sm:text-3xl">
                    {character.char}
                  </span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
                      <Check className="h-3 w-3" /> Completed
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Canvas card */}
              <div className="relative flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-hidden p-2 sm:p-3 lg:p-4">
                {variantToDelete !== null ? (
                  <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 flex items-center gap-3 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-800 shadow-sm">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Delete this variant? Your handwriting in it will be permanently removed.</span>
                    <button type="button" onClick={() => setVariantToDelete(null)} className="rounded-full border border-rose-200 bg-white px-2 py-0.5 font-medium">Cancel</button>
                    <button type="button" onClick={performVariantDelete} className="rounded-full bg-rose-700 px-2 py-0.5 font-medium text-white">Delete</button>
                  </div>
                ) : null}
                {validationMsg ? (
                  <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 flex items-center gap-3 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-800 shadow-sm">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{validationMsg}</span>
                    <button type="button" onClick={() => setValidationMsg(null)} className="rounded-full border border-rose-200 bg-white px-2 py-0.5 font-medium">OK</button>
                  </div>
                ) : null}

                {/* Top-right creative note */}
                {/* Creative note removed as requested */}

                {/* Canvas stage */}
                <div
                  ref={containerRef}
                  className="relative m-auto flex min-h-0 w-full min-w-0 items-center justify-center rounded-2xl border border-[#F0F0EC] bg-[#FFFDF7] p-1 sm:p-2 lg:p-4"
                  style={{
                    overflow: "hidden",
                    aspectRatio: "1 / 1",
                    // Keep the square writing surface inside the available
                    // viewport height (header + toolbar + padding accounted
                    // for) so it never touches the header or action bar and
                    // never stretches — it only ever shrinks to fit.
                    maxWidth: "min(100%, max(280px, calc(100dvh - 340px)))",
                    maxHeight: "100%",
                  }}
                >
                  {isEraser && eraserPos ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none fixed z-30 rounded-full border-2 border-neutral-400 bg-neutral-200/40 backdrop-blur-sm"
                      style={{
                        left: eraserPos.x - eraserSize / 2,
                        top: eraserPos.y - eraserSize / 2,
                        width: eraserSize,
                        height: eraserSize,
                      }}
                    />
                  ) : null}
                  <canvas
                    ref={canvasRef}
                    onPointerDown={startDrawing}
                    onPointerMove={moveDrawing}
                    onPointerUp={endDrawing}
                    onPointerCancel={handlePointerCancel}
                    className="block h-full w-full max-w-full touch-none cursor-crosshair"
                    style={{ touchAction: "none" }}
                  />
                  {/* Bottom canvas message */}
                  <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
                    <span className="text-[9px] uppercase tracking-[0.32em] text-neutral-300 sm:text-[10px]">WRITE NATURALLY</span>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Right Tool Panel */}
          <aside className="hidden h-full w-full min-h-0 flex-col gap-2 sm:gap-3 lg:flex lg:flex-col" style={{ overflow: "hidden" }}>
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[#E8E8E3] bg-white shadow-sm">
              {/* Pen/Eraser */}
              <div className="flex flex-col gap-2 p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Tool</span>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#E8E8E3] bg-neutral-50 p-1">
                  <button
                    type="button"
                    onClick={() => setToolMode("pen")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      toolMode === "pen" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-700 hover:bg-white"
                    }`}
                  >
                    <PenTool className="h-3.5 w-3.5" /> Pen
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolMode("eraser")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      toolMode === "eraser" ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-700 hover:bg-white"
                    }`}
                  >
                    <Eraser className="h-3.5 w-3.5" /> Eraser
                  </button>
                </div>
                {toolMode === "eraser" ? (
                  <div className="flex flex-col gap-1.5 rounded-xl border border-[#E8E8E3] bg-neutral-50 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500">Eraser Size</span>
                      <span className="text-[10px] font-medium text-neutral-700">{eraserSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={6}
                      max={80}
                      step={1}
                      value={eraserSize}
                      onChange={(e) => setEraserSize(Number(e.target.value))}
                      className="h-1 w-full accent-neutral-900"
                    />
                  </div>
                ) : null}
              </div>

              {/* Brush */}
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Brush</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["gel", "fountain", "marker", "pencil"] as BrushType[]).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrushType(b)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors ${
                        brushType === b ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      <span className="capitalize">{b}</span>
                      <div className="flex h-3 w-full items-center justify-center">
                        {b === "gel" && <div className="h-[3px] w-14 rounded-full bg-current" />}
                        {b === "fountain" && (
                          <svg viewBox="0 0 56 12" className="h-3 w-14" aria-hidden="true">
                            <path d="M3 8 C 16 2, 38 2, 53 7" stroke="currentColor" strokeWidth="2.6" fill="none" strokeLinecap="round" />
                          </svg>
                        )}
                        {b === "marker" && <div className="h-2 w-14 rounded-full bg-current opacity-70 blur-[0.4px]" />}
                        {b === "pencil" && <div className="h-[2px] w-14 bg-current opacity-60" style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 5px)" }} />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stroke Size */}
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Stroke Size</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["fine", "regular", "bold"] as StrokeSize[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStrokeSize(s)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs capitalize transition-colors ${
                        strokeSize === s ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {s}
                      <div className="flex h-3 w-full items-center justify-center">
                        {s === "fine" && <span className="text-lg leading-none">·</span>}
                        {s === "regular" && <div className="h-0.5 w-8 rounded-full bg-current" />}
                        {s === "bold" && <div className="h-1.5 w-8 rounded-full bg-current" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas Style */}
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Canvas Style</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["typography", "notebook", "dots", "blank"] as CanvasStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setCanvasStyle(style)}
                      className={`flex items-center justify-center rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors ${
                        canvasStyle === style ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant */}
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Variant</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => switchVariant(-1)}
                    className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded-lg border px-2 text-xs font-medium ${
                      activeVariant === -1 ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white hover:border-neutral-300"
                    }`}
                  >
                    Main
                  </button>
                  {variants.map((v, i) => (
                    <div key={i} className="relative">
                      <button
                        type="button"
                        onClick={() => switchVariant(i)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-medium ${
                          activeVariant === i ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white hover:border-neutral-300"
                        }`}
                      >
                        {i + 1}
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete variant ${i + 1}`}
                        onClick={() => {
                          // Empty variants delete immediately; ones with
                          // handwriting require confirmation.
                          if ((v ?? []).length === 0) {
                            removeVariant(i);
                          } else {
                            setVariantToDelete(i);
                          }
                        }}
                        className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-[9px] text-rose-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {variants.length < 3 ? (
                    <button
                      type="button"
                      onClick={addVariant}
                      className="inline-flex h-7 items-center justify-center rounded-lg border border-dashed border-[#E8E8E3] bg-white px-2 text-xs font-medium text-neutral-600 hover:border-neutral-300"
                    >
                      + Add
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Bottom decoration */}
              <div className="mt-auto border-t border-[#E8E8E3] p-3">
                {/* Decorative note removed as requested */}
              </div>
            </div>
          </aside>
        </div>

        {/* Character strip removed as requested */}

        {/* Bottom Action Bar */}
        <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-[#E8E8E3] bg-white px-2 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-2.5">
          <div className="flex items-center justify-center gap-1.5 sm:justify-start">
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCw className="h-3.5 w-3.5" /> Redo
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={activeStrokes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
            <button
              type="button"
              onClick={runQualityCheck}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300"
            >
              Quality
            </button>
            <button
              type="button"
              onClick={() => setShowShortcuts((s) => !s)}
              className="hidden items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 sm:inline-flex"
            >
              Shortcuts
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 sm:justify-end">
            {hasPrevious && onPrevious ? (
              <button
                type="button"
                onClick={() => saveAndGo(() => onPrevious())}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-900 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={smartSaveAndNext}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800"
            >
              Save & Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showQuality && quality ? (
        <div className="absolute bottom-4 left-1/2 z-20 w-[min(92vw,320px)] -translate-x-1/2 rounded-2xl border border-[#E8E8E3] bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-900">Quality: {quality.status}</span>
            <button type="button" onClick={() => setShowQuality(false)} className="text-neutral-400 hover:text-neutral-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-600">{quality.feedback}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-neutral-500">
            <span>Points: {quality.pointCount}</span>
            <span>Strokes: {quality.strokeCount}</span>
            <span>Bounds: {Math.round(quality.bounds.width)}×{Math.round(quality.bounds.height)}</span>
          </div>
        </div>
      ) : null}

      {showShortcuts ? (
        <div className="absolute left-1/2 top-1/2 z-30 w-[min(92vw,320px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E8E8E3] bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-900">Shortcuts</span>
            <button type="button" onClick={() => setShowShortcuts(false)} className="text-neutral-400 hover:text-neutral-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
            <span>Ctrl+Z Undo</span>
            <span>Ctrl+Shift+Z/⌘+Y Redo</span>
            <span>Ctrl+S Save</span>
            <span>E Toggle Eraser</span>
            <span>P Pen</span>
            <span>Shift+C Clear</span>
            <span>Q Quality</span>
            <span>? Shortcuts</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
