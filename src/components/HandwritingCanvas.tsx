import {
  AlertCircle,
  AlignJustify,
  ArrowRight,
  Brush,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Edit2,
  Eraser,
  Grip,
  LayoutGrid,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PenTool,
  RotateCcw,
  RotateCw,
  Ruler,
  Sparkles,
  Square,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  FREE_CHARACTER_SET,
  getEntitlements,
  upgradeForBrush,
  upgradeForCanvasStyle,
  upgradeForCharacters,
  upgradeForStrokeSize,
  upgradeForVariants,
  type UpgradeCopy,
} from "../utils/entitlements";
import { UpgradeModal } from "./UpgradeModal";
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
  onRenameProject?: (name: string) => void;
  tier?: string;
  onUpgrade?: () => void;
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

/**
 * Small gold crown pinned to Pro-only options (brushes, sizes, styles,
 * + Add). Locked controls keep their normal look and stay clickable —
 * tapping one opens the upgrade modal via the trySelect* choke points.
 */
const ProCrown: React.FC = () => (
  <Crown
    className="pointer-events-none absolute right-1 top-1 h-3 w-3 text-amber-500"
    fill="currentColor"
    aria-label="Pro"
  />
);

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
  onRenameProject,
  tier = "free",
  onUpgrade,
  onClose,
  allCharacterList,
  onSelectCharacter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const sheetWasOpen = useRef(false);
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
  // Ref mirrors for the pointer guards: state updates are async, so a burst
  // of synchronous events (fast stylus, coalesced moves, synthetic dispatch)
  // must still see the drawing session started by pointerdown.
  const isDrawingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  // Last hover position for the eraser ring (gates re-renders by distance).
  const eraserHoverRef = useRef<{ x: number; y: number } | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("pen");
  const [brushType, setBrushType] = useState<BrushType>("gel");
  const [strokeSize, setStrokeSize] = useState<StrokeSize>("regular");
  const [canvasStyle, setCanvasStyle] = useState<CanvasStyle>("typography");
  const [eraserSize, setEraserSize] = useState(24);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  // Surfaces persistence failures (e.g. storage quota) instead of failing
  // silently — unsaved strokes are never dropped, retry stays available.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showQuality, setShowQuality] = useState(false);
  const [quality, setQuality] = useState<QualityAnalysis | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);
  const [mobileSheet, setMobileSheet] = useState<"brush" | "size" | "style" | "variant" | "more" | "characters" | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradeCopy | null>(null);

  const ent = useMemo(() => getEntitlements(tier), [tier]);
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

  const proj: unknown = project ?? {};
  const charsObj = (proj as { characters?: unknown })?.characters;
  const allChars: CharacterData[] = Array.isArray(charsObj)
    ? (charsObj as CharacterData[])
    : typeof charsObj === "object" && charsObj !== null
      ? Object.values(charsObj as Record<string, CharacterData>)
      : [];

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
    // Cap history so marathon sessions can't grow memory without bound.
    setUndoStack((prev) => [...prev, snapshotNow()].slice(-50));
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
    // Clearing changes persisted state — mark dirty so autosave persists the
    // empty canvas instead of leaving a stale saved dot behind.
    setIsDirty(true);
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
    if (!ent.canCreateVariant(variants.length)) {
      if (!ent.isPro) {
        setUpgrade(upgradeForVariants);
      } else {
        setValidationMsg("Maximum 4 variants per character.");
      }
      return;
    }
    pushUndo();
    setVariants((prev) => [...prev, []]);
    setVariantStyles((prev) => [...prev, []]);
    setActiveVariant(variants.length);
    setIsDirty(true);
  }, [ent, pushUndo, variants.length]);

  // Lock page scroll while the editor is open so no page scrollbar appears.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
    setUpgrade(null);
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
      setSaveError(null);
      setValidationMsg(null);
      setLastSavedAt(Date.now());
    } catch (err) {
      console.error("Failed to save character:", err);
      setSaveError("Save failed — strokes kept. Tap to retry.");
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

  // ---- Plan-gated selections: one choke point per control so the desktop
  // panel and the mobile sheets share identical entitlement behavior. ----
  const trySelectBrush = useCallback(
    (b: BrushType): boolean => {
      if (!ent.canUseBrush(b)) {
        setUpgrade(upgradeForBrush(b));
        return false;
      }
      setBrushType(b);
      return true;
    },
    [ent],
  );

  const trySelectSize = useCallback(
    (s: StrokeSize): boolean => {
      if (!ent.canUseStrokeSize(s)) {
        setUpgrade(upgradeForStrokeSize(s));
        return false;
      }
      setStrokeSize(s);
      return true;
    },
    [ent],
  );

  const trySelectStyle = useCallback(
    (s: CanvasStyle): boolean => {
      if (!ent.canUseCanvasStyle(s)) {
        setUpgrade(upgradeForCanvasStyle(s));
        return false;
      }
      setCanvasStyle(s);
      return true;
    },
    [ent],
  );

  const charHasStrokes = useCallback(
    (ch: string): boolean => {
      const listed = allCharacterList?.find((c) => c.char === ch);
      if (listed) return listed.hasStrokes;
      const cd = allChars.find((c: unknown) => (c as CharacterData).char === ch);
      return !!((cd as { completed?: boolean } | undefined)?.completed || (cd?.strokes?.length ?? 0) > 0);
    },
    [allCharacterList, allChars],
  );

  const isLockedChar = useCallback(
    (ch: string) => !ent.isCharacterAllowed(ch, charHasStrokes(ch)),
    [charHasStrokes, ent],
  );

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

  const selectChar = useCallback(
    (ch: string) => {
      if (isLockedChar(ch)) {
        // Persist current work first, then explain the limit.
        saveAndGo(() => setUpgrade(upgradeForCharacters));
        return;
      }
      saveAndGo(() => {
        if (onSelectCharacter) {
          onSelectCharacter(ch);
        } else {
          window.dispatchEvent(new CustomEvent("typeme:select-char", { detail: ch }));
        }
      });
    },
    [isLockedChar, onSelectCharacter, saveAndGo],
  );

  const jumpToCategoryFirst = useCallback(
    (key: "upper" | "lower" | "nums" | "symbols", group: string[]) => {
      if (!ent.isPro && key !== "upper") {
        setUpgrade(upgradeForCharacters);
        return;
      }
      if (group[0]) {
        selectChar(group[0]);
      }
    },
    [ent, selectChar],
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
      // Smooth partial erase: drop only the points touched by the eraser
      // and split the stroke into its remaining contiguous runs, so a drag
      // carves through handwriting instead of deleting whole strokes.
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      const vRadius =
        rect && rect.width > 0
          ? Math.max(3, (eraserSize / rect.width) * VIRTUAL_WIDTH)
          : Math.max(3, eraserSize / 2);
      let changed = false;
      const next: Stroke[] = [];
      const nextStyles: StrokeStyle[] = [];
      activeStrokes.forEach((pts, i) => {
        const style = activeStyles[i] ?? { brush: brushType, size: strokeSize };
        let run: Point[] = [];
        const flush = () => {
          if (run.length > 0) {
            next.push(run);
            nextStyles.push(style);
            run = [];
          }
        };
        for (const pt of pts) {
          if (Math.hypot(pt.x - p.x, pt.y - p.y) <= vRadius) {
            changed = true;
            flush();
          } else {
            run.push(pt);
          }
        }
        flush();
      });
      if (changed) {
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
        isDrawingRef.current = true;
        pointerIdRef.current = e.pointerId;
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
      isDrawingRef.current = true;
      pointerIdRef.current = e.pointerId;
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
      const capY = VIRTUAL_HEIGHT * 0.24;
      const upperY = VIRTUAL_HEIGHT * 0.36;
      const baseY = VIRTUAL_HEIGHT * 0.64;
      const descY = VIRTUAL_HEIGHT * 0.8;
      if (canvasStyle === "typography") {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = "#9CA3AF";
        ctx.lineWidth = 0.9;
        ctx.setLineDash([2, 4]);
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
        // Real notebook: solid grey rules across the full writing area,
        // independent from the typography guides.
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = "#6B7280";
        ctx.lineWidth = 0.9;
        ctx.setLineDash([]);
        for (let y = 24; y <= VIRTUAL_HEIGHT - 20; y += 18) {
          ctx.beginPath();
          ctx.moveTo(10, y);
          ctx.lineTo(VIRTUAL_WIDTH - 10, y);
          ctx.stroke();
        }
      }
      if (canvasStyle === "dots") {
        ctx.globalAlpha = 0.2;
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
      // Hover ring follows the pointer in eraser mode even without buttons
      // pressed; distance-gated so hover doesn't re-render every mousemove.
      if (isEraser) {
        const prev = eraserHoverRef.current;
        if (!prev || Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 3) {
          eraserHoverRef.current = { x: e.clientX, y: e.clientY };
          setEraserPos(eraserHoverRef.current);
        }
      }
      if (!isDrawingRef.current || (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current)) return;
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
    [eraseAt, getCanvasPoint, isEraser, lastPoint, lastPointerTime],
  );

  const endDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
      releasePointer(e);
      isDrawingRef.current = false;
      pointerIdRef.current = null;
      setIsDrawing(false);
      setPointerId(null);
      eraserHoverRef.current = null;
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
    [activeStrokes, activeStyles, brushType, currentStroke, isEraser, releasePointer, setActiveStrokes, strokeSize],
  );

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current) return;
    releasePointer(e);
    isDrawingRef.current = false;
    pointerIdRef.current = null;
    eraserHoverRef.current = null;
    setIsDrawing(false);
    setPointerId(null);
    setCurrentStroke(null);
    setLastPoint(null);
    setPointerSamples([]);
    setEraserPos(null);
    e.preventDefault();
  }, [releasePointer]);

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

  // Container determines canvas size: ResizeObserver measures the actual
  // available space (orientation, keyboard, panels) and the bitmap follows
  // via DPR. CSS/display size and bitmap stay separate — never write
  // canvas.style.width/height.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        draw();
        setDpr(window.devicePixelRatio || 1);
      });
    });
    ro.observe(container);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [draw]);

  // Keep the selected character visible in the mobile strip.
  useEffect(() => {
    stripRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [character.char]);

  // Return focus to the canvas when a bottom sheet closes.
  useEffect(() => {
    if (mobileSheet) {
      sheetWasOpen.current = true;
      return;
    }
    if (sheetWasOpen.current) {
      sheetWasOpen.current = false;
      canvasRef.current?.focus({ preventScroll: true });
    }
  }, [mobileSheet]);

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

  // Progress denominator is plan-aware: Free tracks against the starter
  // set from central entitlements, Pro against the full glyph set.
  const progressDenominator = ent.isPro ? totalCount : FREE_CHARACTER_SET.length;
  const progressPct =
    progressDenominator > 0 ? Math.round((completedCount / progressDenominator) * 100) : 0;
  const isCompleted =
    strokes.length > 0 || variants.some((v) => v.length > 0);
  const category = character.category || "uppercase";

  const categoryGroups = useMemo(() => {
    const upper = allChars.filter((c: any) => (c.category || "uppercase") === "uppercase");
    const lower = allChars.filter((c: any) => c.category === "lowercase");
    const nums = allChars.filter((c: any) => c.category === "numbers");
    const symbols = allChars.filter((c: any) => c.category === "symbols");
    return { upper, lower, nums, symbols };
  }, [allChars]);

  // Category counters reflect persisted ink only: the current character is
  // excluded while it holds unsaved edits, matching the blue-dot rule.
  const getCategoryProgress = (group: CharacterData[]) => {
    const done = group.filter((c: any) => {
      if ((c as any)?.char === character.char && (isDirty || isSaving)) return false;
      return (
        (c as any)?.completed ||
        (c.strokes?.length ?? 0) > 0 ||
        ((c as any)?.variants ?? []).some((v: any) => (v?.length ?? 0) > 0)
      );
    }).length;
    return { done, total: group.length };
  };

  const brushPreview = (b: BrushType) => (
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
  );

  const sheetTitle =
    mobileSheet === "brush" ? "Brush"
    : mobileSheet === "size" ? "Stroke Size"
    : mobileSheet === "style" ? "Canvas Style"
    : mobileSheet === "variant" ? "Variant"
    : mobileSheet === "characters" ? "Characters"
    : "More";

  const alpha = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const alphaLower = Array.from("abcdefghijklmnopqrstuvwxyz");
  const digits = Array.from("0123456789");
  const symbolsList = ["!", "@", "#", "$", "%", "&", "*", "(", ")", "-", "_", "+", "=", "{", "}", "[", "]", "|", "\\", "/", "?", "<", ">", ",", ".", ";", ":", "'", '"'];
  const activeCategoryChars =
    category === "uppercase" ? alpha : category === "lowercase" ? alphaLower : category === "numbers" ? digits : symbolsList;

  // ONE character-cell renderer for every surface (mobile strip, sidebar
  // grid, characters drawer). Same persisted-snapshot saved rule, same gold
  // Pro crown, same selected style — presentation differs only by size.
  const renderCharCell = (
    ch: string,
    opts?: { size?: "sm" | "lg"; trackActive?: boolean; onPick?: () => void },
  ) => {
    const cd = allChars.find((c: any) => c.char === ch);
    // Saved = persisted ink in the stored snapshot (main strokes, variants,
    // or completed flag). The live canvas is NOT consulted: while the current
    // character holds unsaved edits, its dot hides until persistence succeeds.
    const snapshot = cd as
      | { completed?: boolean; strokes?: unknown[]; variants?: unknown[][] }
      | undefined;
    const done =
      !!snapshot?.completed ||
      (snapshot?.strokes?.length ?? 0) > 0 ||
      (snapshot?.variants ?? []).some((v) => (v?.length ?? 0) > 0);
    const cur = character.char === ch;
    const locked = !ent.isCharacterAllowed(ch, done);
    const showDot = done && !(cur && (isDirty || isSaving));
    const sizeCls =
      opts?.size === "lg"
        ? "h-10 w-10 text-sm rounded-xl"
        : "h-7 w-7 text-xs rounded-md";
    return (
      <button
        key={ch}
        type="button"
        onClick={() => {
          selectChar(ch);
          opts?.onPick?.();
        }}
        data-active={opts?.trackActive && cur ? true : undefined}
        title={locked ? `${ch} · Pro` : done ? `${ch} · done` : ch}
        className={`relative flex shrink-0 items-center justify-center border font-medium transition-all ${sizeCls} ${
          cur ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : done ? "border-2 border-blue-600 bg-blue-50 text-blue-800" : locked ? "border-[#E8E8E3] bg-neutral-50 text-neutral-400" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
        }`}
      >
        {ch}
        {locked ? (
          <Crown
            className="pointer-events-none absolute right-[2px] top-[2px] h-3 w-3 text-amber-500"
            fill="currentColor"
            aria-label="Pro"
          />
        ) : showDot ? (
                        <span className="tm-dot-pop absolute right-[3px] top-[3px] h-[7px] w-[7px] rounded-full bg-blue-600 ring-2 ring-white" />
        ) : null}
      </button>
    );
  };

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-[#FAFAF7] overflow-hidden"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
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
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:hidden">
            <span className="text-[11px] font-semibold text-neutral-600">
              {ent.isPro ? `${completedCount}/${totalCount}` : `${completedCount}/${FREE_CHARACTER_SET.length}`}
            </span>
            <div className="h-1 w-10 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="hidden items-center gap-2.5 rounded-full border border-[#E8E8E3] bg-neutral-50 px-3 py-1.5 md:flex">
            <span className="text-xs font-medium text-neutral-600">
              {ent.isPro
                ? `${completedCount} / ${totalCount} written`
                : `${completedCount} / ${FREE_CHARACTER_SET.length} Free`}
            </span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        {/* Center — project name (editable) */}
        <div className="absolute left-1/2 top-1/2 flex max-w-[40vw] -translate-x-1/2 -translate-y-1/2 items-center">
          {editingName ? (
            <div className="flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-2 py-1 shadow-sm">
              <input
                value={nameDraft}
                autoFocus
                maxLength={40}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const next = nameDraft.trim();
                    if (next && onRenameProject) onRenameProject(next);
                    setEditingName(false);
                  } else if (e.key === "Escape") {
                    setNameDraft(projectName);
                    setEditingName(false);
                  }
                }}
                className="w-28 bg-transparent text-sm font-medium text-neutral-900 outline-none sm:w-44"
              />
              <button
                type="button"
                aria-label="Save name"
                onClick={() => {
                  const next = nameDraft.trim();
                  if (next && onRenameProject) onRenameProject(next);
                  setEditingName(false);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Cancel rename"
                onClick={() => {
                  setNameDraft(projectName);
                  setEditingName(false);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#E8E8E3] text-neutral-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!onRenameProject}
              onClick={() => {
                if (!onRenameProject) return;
                setNameDraft(projectName);
                setEditingName(true);
              }}
              title={onRenameProject ? "Rename" : undefined}
              className={`flex min-w-0 items-center gap-1.5 rounded-full border border-[#E8E8E3] bg-white px-3 py-1 shadow-sm ${
                onRenameProject ? "cursor-pointer hover:border-neutral-300" : "cursor-default"
              }`}
            >
              <span className="truncate text-sm font-semibold text-neutral-900">{projectName}</span>
              {onRenameProject ? <Edit2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" /> : null}
            </button>
          )}
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {saveError ? (
            <button
              type="button"
              onClick={() => performSave().catch(() => {})}
              title={saveError}
              className="flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save failed — retry</span>
              <span className="sm:hidden">Retry</span>
            </button>
          ) : (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
            {isSaving || isDirty ? (
              <span>Saving…</span>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-label="Saved" />
                <span className="hidden sm:inline">Autosaved</span>
              </>
            )}
            <Check className="h-3.5 w-3.5" />
          </div>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle fullscreen"
            className="hidden h-8 w-8 items-center justify-center rounded-lg border border-[#E8E8E3] bg-white text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900 sm:inline-flex"
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
          {ent.isPro ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-sm">
              <Crown className="h-3.5 w-3.5" fill="currentColor" />
              <span>Pro Plan Active</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onUpgrade) {
                  onUpgrade();
                } else {
                  setUpgrade(upgradeForCharacters);
                }
              }}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-semibold text-neutral-600 shadow-sm transition-colors hover:border-amber-300 hover:text-amber-800"
            >
              <span>Free · Upgrade</span>
            </button>
          )}
        </div>
      </header>

      {/* Main workspace */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto p-2 sm:gap-3 sm:p-3 md:overflow-hidden lg:gap-4 lg:p-4">
        {/* Mobile character navigator: 4 tabs + letters with saved dots (tablet uses sidebar) */}
        <div className="flex shrink-0 flex-col gap-1.5 rounded-2xl border border-[#E8E8E3] bg-white p-2 shadow-sm md:hidden">
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { key: "upper", short: "A", name: "A–Z", count: getCategoryProgress(categoryGroups.upper), active: category === "uppercase" },
                { key: "lower", short: "a", name: "a–z", count: getCategoryProgress(categoryGroups.lower), active: category === "lowercase" },
                { key: "nums", short: "0", name: "0–9", count: getCategoryProgress(categoryGroups.nums), active: category === "numbers" },
                { key: "symbols", short: "#", name: "Sym", count: getCategoryProgress(categoryGroups.symbols), active: category === "symbols" },
              ] as const
            ).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  const group = cat.key === "upper" ? alpha : cat.key === "lower" ? alphaLower : cat.key === "nums" ? digits : symbolsList;
                  jumpToCategoryFirst(cat.key, group);
                }}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-all ${
                  cat.active ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700"
                }`}
              >
                <span className="text-sm font-bold leading-none">{cat.short}</span>
                <span className="text-[10px] font-semibold leading-none">{cat.name}</span>
                <span className={`text-[9px] leading-none ${cat.active ? "text-neutral-300" : "text-neutral-400"}`}>
                  {cat.count.done}/{cat.count.total}
                </span>
              </button>
            ))}
          </div>
          <div
            ref={stripRef}
            className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
                {activeCategoryChars.map((ch) => renderCharCell(ch, { trackActive: true }))}
          </div>
        </div>
        {/* Top row: sidebar + canvas + tools */}
        <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-2 overflow-hidden sm:gap-3 md:grid-cols-[200px_minmax(0,1fr)_176px] lg:grid-cols-[240px_minmax(0,1fr)_220px] xl:grid-cols-[260px_minmax(0,1fr)_240px] lg:px-2">
          {/* Left Sidebar (tablet + desktop) */}
          <aside className="hidden h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E8E8E3] bg-white shadow-sm md:flex">
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
                    const group = cat.key === "upper" ? alpha : cat.key === "lower" ? alphaLower : cat.key === "nums" ? digits : symbolsList;
                    jumpToCategoryFirst(cat.key, group);
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
                <span className="text-[10px] text-neutral-400">
                  {ent.isPro
                    ? `${completedCount}/${totalCount} written`
                    : `${completedCount}/${FREE_CHARACTER_SET.length} Free`}
                </span>
              </div>
              <div className="flex flex-1 flex-wrap content-start justify-start gap-1 overflow-hidden px-3 pb-3">
                {activeCategoryChars.map((ch) => renderCharCell(ch))}
              </div>
            </div>

            {/* Bottom motivational removed as requested */}
          </aside>

          {/* Center Canvas */}
          <main className="flex min-h-[300px] min-w-0 flex-1 flex-col items-center justify-center sm:min-h-[400px] md:min-h-[440px] lg:min-h-0">
            <div className="flex w-full min-w-0 max-w-full flex-1 flex-col items-center rounded-2xl border border-[#E8E8E3] bg-white shadow-sm sm:rounded-3xl lg:max-w-[min(100%,920px)] xl:max-w-[min(100%,980px)] 2xl:max-w-[min(100%,1040px)]">
              {/* Canvas header */}
              <div className="flex shrink-0 flex-col items-center gap-2 border-b border-[#E8E8E3] px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center gap-3">
                  <span data-testid="editor-current-char" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 font-serif text-2xl font-semibold text-neutral-900 shadow-sm sm:h-12 sm:w-12 sm:text-3xl">
                    {character.char}
                  </span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-800">
                      <Check className="h-3 w-3" /> Completed
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Canvas card — hugs the stage on small screens so no dead
                  space pools inside the card; desktop keeps the fill. */}
              <div className="relative flex min-h-0 w-full min-w-0 max-w-full flex-none flex-col overflow-hidden p-2 sm:p-3 lg:flex-1 lg:p-4">
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
                    data-testid="handwriting-stage"
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
                    data-testid="eraser-ring"
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
                    tabIndex={-1}
                    onPointerDown={startDrawing}
                    onPointerMove={moveDrawing}
                    onPointerUp={endDrawing}
                    onPointerCancel={handlePointerCancel}
                    className="block h-full w-full max-w-full touch-none cursor-crosshair focus:outline-none"
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

          {/* Right Tool Panel — compact stacked on tablet, grid on desktop */}
          <aside
            className="hidden h-full w-full min-h-0 flex-col gap-2 sm:gap-3 md:flex md:flex-col"
            style={{ overflow: "hidden" }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-[#E8E8E3] bg-white shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Pen/Eraser */}
              <div className="flex flex-col gap-2 p-2 lg:p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Tool</span>
                <div className="grid grid-cols-1 gap-1.5 rounded-xl border border-[#E8E8E3] bg-neutral-50 p-1 lg:grid-cols-2">
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
                  <div className="flex items-center gap-2 rounded-xl border border-[#E8E8E3] bg-neutral-50 px-2 py-1.5">
                    <span className="shrink-0 text-[10px] text-neutral-500">Size</span>
                    <input
                      type="range"
                      min={6}
                      max={80}
                      step={1}
                      value={eraserSize}
                      onFocus={(e) => e.preventDefault()}
                      onChange={(e) => setEraserSize(Number(e.target.value))}
                      className="h-1 w-full accent-neutral-900"
                    />
                    <span className="shrink-0 text-[10px] font-medium text-neutral-700">{eraserSize}</span>
                  </div>
                ) : null}
              </div>

              {/* Brush */}
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-2 lg:p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Brush</span>
                <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                  {(["gel", "fountain", "marker", "pencil"] as BrushType[]).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => trySelectBrush(b)}
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors ${
                        brushType === b ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {!ent.canUseBrush(b) ? <ProCrown /> : null}
                      <span className="capitalize">{b}</span>
                      {brushPreview(b)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stroke Size */}
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-2 lg:p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Stroke Size</span>
                <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-3">
                  {(["fine", "regular", "bold"] as StrokeSize[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => trySelectSize(s)}
                      className={`relative flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs capitalize transition-colors ${
                        strokeSize === s ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {!ent.canUseStrokeSize(s) ? <ProCrown /> : null}
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
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-2 lg:p-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Canvas Style</span>
                <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
                  {(["typography", "notebook", "dots", "blank"] as CanvasStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => trySelectStyle(style)}
                      className={`relative flex items-center justify-center rounded-lg border px-2 py-1.5 text-xs capitalize transition-colors ${
                        canvasStyle === style ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {!ent.canUseCanvasStyle(style) ? <ProCrown /> : null}
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant */}
              <div className="flex flex-col gap-2 border-t border-[#E8E8E3] p-2 lg:p-3">
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
                      className="relative inline-flex h-7 items-center justify-center rounded-lg border border-dashed border-[#E8E8E3] bg-white px-2 text-xs font-medium text-neutral-600 hover:border-neutral-300"
                    >
                      {!ent.canCreateVariant(variants.length) ? <ProCrown /> : null}
                      + Add
                    </button>
                  ) : null}
                </div>
              </div>

            </div>
          </aside>
        </div>

        {/* Character strip removed as requested */}

        {/* Mobile / tablet compact toolbar (canvas stays the hero; details live in sheets) */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto rounded-2xl border border-[#E8E8E3] bg-white px-2 py-2 shadow-sm lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setToolMode("pen")}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
              toolMode === "pen" ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
            }`}
          >
            <PenTool className="h-4 w-4" /> Pen
          </button>
          <button
            type="button"
            onClick={() => setToolMode("eraser")}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
              toolMode === "eraser" ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
            }`}
          >
            <Eraser className="h-4 w-4" /> Eraser
          </button>
          <button
            type="button"
            onClick={() => setMobileSheet("brush")}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium capitalize transition-colors ${
              mobileSheet === "brush" ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
            }`}
          >
            <Brush className="h-4 w-4" /> Brush
          </button>
          <button
            type="button"
            onClick={() => setMobileSheet("size")}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium capitalize transition-colors ${
              mobileSheet === "size" ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
            }`}
          >
            <Ruler className="h-4 w-4" /> Size
          </button>
          <button
            type="button"
            onClick={() => setMobileSheet("style")}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium capitalize transition-colors ${
              mobileSheet === "style" ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
            }`}
          >
            <AlignJustify className="h-4 w-4" /> Style
          </button>
          <button
            type="button"
            onClick={() => setMobileSheet("more")}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
              mobileSheet === "more" || mobileSheet === "variant" ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
            }`}
          >
            <MoreHorizontal className="h-4 w-4" /> More
          </button>
        </div>

        {/* Bottom Action Bar */}
        <div
          className="flex shrink-0 flex-row items-center justify-between gap-1.5 rounded-2xl border border-[#E8E8E3] bg-white px-2 py-2 shadow-sm sm:gap-2 sm:px-3 sm:py-2.5"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-center gap-1.5 sm:justify-start">
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5"
            >
              <RotateCw className="h-3.5 w-3.5" /> Redo
            </button>
            <button
              type="button"
              onClick={clear}
              disabled={activeStrokes.length === 0}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
            <button
              type="button"
              onClick={runQualityCheck}
              className="hidden min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 sm:inline-flex"
            >
              Quality
            </button>
            <button
              type="button"
              onClick={() => setShowShortcuts((s) => !s)}
              className="hidden min-h-[44px] items-center gap-1.5 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 sm:inline-flex"
            >
              Shortcuts
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-1.5 sm:flex-none">
            {hasPrevious && onPrevious ? (
              <button
                type="button"
                onClick={() => saveAndGo(() => onPrevious())}
                className="hidden min-h-[44px] items-center gap-1 rounded-lg border border-[#E8E8E3] bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 sm:inline-flex"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              className="hidden min-h-[44px] items-center gap-1.5 rounded-lg border border-neutral-900 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-50 sm:inline-flex"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={smartSaveAndNext}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800 sm:flex-none"
            >
              Save & Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / tablet bottom sheets (same state + handlers as desktop panel) */}
      {mobileSheet ? (
        <div
          className="tm-fade fixed inset-0 z-[55] bg-neutral-900/30 lg:hidden"
          onClick={() => setMobileSheet(null)}
          aria-hidden="true"
        />
      ) : null}
      {mobileSheet ? (
        <div className="tm-sheet fixed inset-x-3 bottom-28 z-[60] rounded-2xl border border-[#E8E8E3] bg-white p-3 shadow-xl sm:inset-x-6 lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-900">{sheetTitle}</span>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setMobileSheet(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8E8E3] text-neutral-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className={`overflow-y-auto ${mobileSheet === "characters" ? "max-h-[78dvh]" : "max-h-[46dvh]"}`}>
            {mobileSheet === "brush" ? (
              <div className="grid grid-cols-2 gap-2">
                {(["gel", "fountain", "marker", "pencil"] as BrushType[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      trySelectBrush(b);
                      setMobileSheet(null);
                    }}
                    className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs capitalize transition-colors ${
                      brushType === b ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
                    }`}
                  >
                    {!ent.canUseBrush(b) ? <ProCrown /> : null}
                    {b}
                    {brushPreview(b)}
                  </button>
                ))}
              </div>
            ) : null}
            {mobileSheet === "size" ? (
              <div className="grid grid-cols-3 gap-2">
                {(["fine", "regular", "bold"] as StrokeSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      trySelectSize(s);
                      setMobileSheet(null);
                    }}
                    className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs capitalize transition-colors ${
                      strokeSize === s ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
                    }`}
                  >
                    {!ent.canUseStrokeSize(s) ? <ProCrown /> : null}
                    {s}
                    <div className="flex h-3 w-full items-center justify-center">
                      {s === "fine" && <span className="text-lg leading-none">·</span>}
                      {s === "regular" && <div className="h-0.5 w-8 rounded-full bg-current" />}
                      {s === "bold" && <div className="h-1.5 w-8 rounded-full bg-current" />}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {mobileSheet === "style" ? (
              <div className="grid grid-cols-2 gap-2">
                {(["typography", "notebook", "dots", "blank"] as CanvasStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => {
                      trySelectStyle(style);
                      setMobileSheet(null);
                    }}
                    className={`relative flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-2 py-2 text-xs capitalize transition-colors ${
                      canvasStyle === style ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white text-neutral-700"
                    }`}
                  >
                    {!ent.canUseCanvasStyle(style) ? <ProCrown /> : null}
                    {style === "typography" ? <Type className="h-4 w-4" /> : null}
                    {style === "notebook" ? <AlignJustify className="h-4 w-4" /> : null}
                    {style === "dots" ? <Grip className="h-4 w-4" /> : null}
                    {style === "blank" ? <Square className="h-4 w-4" /> : null}
                    {style}
                  </button>
                ))}
              </div>
            ) : null}
            {mobileSheet === "variant" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    switchVariant(-1);
                    setMobileSheet(null);
                  }}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-3 text-xs font-medium ${
                    activeVariant === -1 ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white"
                  }`}
                >
                  Main
                </button>
                {variants.map((v, i) => (
                  <div key={i} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        switchVariant(i);
                        setMobileSheet(null);
                      }}
                      className={`inline-flex min-h-[44px] w-11 items-center justify-center rounded-xl border text-xs font-medium ${
                        activeVariant === i ? "border-neutral-900 bg-neutral-900 text-white" : "border-[#E8E8E3] bg-white"
                      }`}
                    >
                      {i + 1}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete variant ${i + 1}`}
                      onClick={() => {
                        if ((v ?? []).length === 0) {
                          removeVariant(i);
                        } else {
                          setVariantToDelete(i);
                        }
                        setMobileSheet(null);
                      }}
                      className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-[11px] text-rose-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {variants.length < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      addVariant();
                      setMobileSheet(null);
                    }}
                    className="relative inline-flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-[#E8E8E3] bg-white px-3 text-xs font-medium text-neutral-600"
                  >
                    {!ent.canCreateVariant(variants.length) ? <ProCrown /> : null}
                    + Add
                  </button>
                ) : null}
              </div>
            ) : null}
            {mobileSheet === "characters" ? (
              <div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { key: "upper", short: "A", name: "A–Z", group: alpha, count: getCategoryProgress(categoryGroups.upper), active: category === "uppercase" },
                      { key: "lower", short: "a", name: "a–z", group: alphaLower, count: getCategoryProgress(categoryGroups.lower), active: category === "lowercase" },
                      { key: "nums", short: "0", name: "0–9", group: digits, count: getCategoryProgress(categoryGroups.nums), active: category === "numbers" },
                      { key: "symbols", short: "#", name: "Sym", group: symbolsList, count: getCategoryProgress(categoryGroups.symbols), active: category === "symbols" },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => jumpToCategoryFirst(cat.key, [...cat.group])}
                      className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-all ${
                        cat.active ? "border-neutral-900 bg-neutral-900 text-white shadow-sm" : "border-[#E8E8E3] bg-white text-neutral-700"
                      }`}
                    >
                      <span className="text-sm font-bold leading-none">{cat.short}</span>
                      <span className="text-[10px] font-semibold leading-none">{cat.name}</span>
                      <span className={`text-[9px] leading-none ${cat.active ? "text-neutral-300" : "text-neutral-400"}`}>
                        {cat.count.done}/{cat.count.total}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-5 justify-items-center gap-1.5 sm:grid-cols-7">
                  {activeCategoryChars.map((ch) =>
                    renderCharCell(ch, { size: "lg", onPick: () => setMobileSheet(null) }),
                  )}
                </div>
              </div>
            ) : null}
            {mobileSheet === "more" ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSheet("characters")}
                  className="inline-flex min-h-[44px] items-center justify-between rounded-xl border border-[#E8E8E3] bg-white px-3 text-xs font-medium text-neutral-700"
                >
                  <span className="inline-flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" /> Characters: {activeCategoryChars.length} in view
                  </span>
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSheet("variant")}
                  className="inline-flex min-h-[44px] items-center justify-between rounded-xl border border-[#E8E8E3] bg-white px-3 text-xs font-medium text-neutral-700"
                >
                  <span>Variant: {activeVariant === -1 ? "Main" : `Alternate ${activeVariant + 1}`}</span>
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </button>
                {!ent.isPro ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSheet(null);
                      setUpgrade(upgradeForCharacters);
                    }}
                    className="inline-flex min-h-[44px] items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Crown className="h-4 w-4" fill="currentColor" /> Plan: Free · Upgrade
                    </span>
                    <ChevronRight className="h-4 w-4 text-amber-700" />
                  </button>
                ) : (
                  <div className="inline-flex min-h-[44px] items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-900">
                    <span className="inline-flex items-center gap-2">
                      <Crown className="h-4 w-4" fill="currentColor" /> Plan: Pro Plan Active
                    </span>
                  </div>
                )}
                {hasPrevious && onPrevious ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSheet(null);
                      saveAndGo(() => onPrevious());
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E8E8E3] bg-white px-3 text-xs font-medium text-neutral-700"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous character
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMobileSheet(null);
                    handleSave();
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-900 bg-white px-3 text-xs font-semibold text-neutral-900"
                >
                  <Check className="h-4 w-4" /> Save character
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSheet(null);
                    runQualityCheck();
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E8E8E3] bg-white px-3 text-xs font-medium text-neutral-700"
                >
                  Quality check
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileSheet(null);
                    setShowShortcuts(true);
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E8E8E3] bg-white px-3 text-xs font-medium text-neutral-700"
                >
                  Keyboard shortcuts
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <UpgradeModal
        open={!!upgrade}
        feature={upgrade?.feature ?? ""}
        description={upgrade?.description ?? ""}
        bullets={upgrade?.bullets}
        onClose={() => setUpgrade(null)}
        onUpgrade={onUpgrade}
      />

      {showQuality && quality ? (
        <div className="tm-pop absolute bottom-4 left-1/2 z-20 w-[min(92vw,320px)] -translate-x-1/2 rounded-2xl border border-[#E8E8E3] bg-white p-3 shadow-lg">
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
        <div data-testid="editor-shortcuts" className="tm-pop absolute left-1/2 top-1/2 z-30 w-[min(92vw,320px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E8E8E3] bg-white p-3 shadow-lg">
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
