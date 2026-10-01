import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  Sliders,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Maximize2,
  Minimize2,
  HelpCircle,
  Keyboard,
  X,
  AlertCircle,
} from 'lucide-react';

export type PenStyle = 'gel' | 'fountain' | 'marker' | 'pencil';
export type GuidelineStyle = 'typography' | 'notebook' | 'dots' | 'blank';
export type EraserScale = 'small' | 'medium' | 'large';

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
}

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingInProgressRef = useRef<boolean>(false);

  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    return character.strokes ? JSON.parse(JSON.stringify(character.strokes)) : [];
  });
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  const [activeVariantIndex, setActiveVariantIndex] = useState<number>(-1);
  const [variants, setVariants] = useState<Stroke[][]>(() => {
    return character.variants ? JSON.parse(JSON.stringify(character.variants)) : [];
  });
  const [variantToDelete, setVariantToDelete] = useState<number | null>(null);

  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penStyle, setPenStyle] = useState<PenStyle>('gel');
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [eraserScale, setEraserScale] = useState<EraserScale>('medium');
  const [guidelineStyle, setGuidelineStyle] = useState<GuidelineStyle>('typography');
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);

  const eraserRadiusMap: Record<EraserScale, number> = {
    small: 8,
    medium: 18,
    large: 34,
  };
  const currentEraserRadius = eraserRadiusMap[eraserScale];

  const [quality, setQuality] = useState(() => analyzeCharacterStrokes(strokes, 400, 400));
  const [eraserMousePos, setEraserMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

  const currentStrokeRef = useRef<Point[]>([]);
  const activePointerTypeRef = useRef<string | null>(null);
  const isEraserDraggingRef = useRef<boolean>(false);

  const VIRTUAL_WIDTH = 400;
  const VIRTUAL_HEIGHT = 400;

  const GUIDELINES = {
    ascender: 60,
    capHeight: 110,
    midline: 190,
    baseline: 300,
    descender: 360,
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    setStrokes(character.strokes ? JSON.parse(JSON.stringify(character.strokes)) : []);
    setVariants(character.variants ? JSON.parse(JSON.stringify(character.variants)) : []);
    setActiveVariantIndex(-1);
    setUndoStack([]);
    setRedoStack([]);
  }, [character.char]);

  useEffect(() => {
    setQuality(analyzeCharacterStrokes(strokes, VIRTUAL_WIDTH, VIRTUAL_HEIGHT));
  }, [strokes]);

  useEffect(() => {
    const current = activeVariantIndex === -1 ? strokes : variants[activeVariantIndex] || [];
    setQuality(analyzeCharacterStrokes(current, VIRTUAL_WIDTH, VIRTUAL_HEIGHT));
  }, [activeVariantIndex, variants]);

  useEffect(() => {
    if (activeVariantIndex === -1) {
      setStrokes((prev) => {
        const next = [...prev];
        return next;
      });
    }
  }, [activeVariantIndex]);

  const pushUndo = useCallback((state: Stroke[]) => {
    setUndoStack((prev) => {
      const next = [...prev, JSON.parse(JSON.stringify(state))];
      if (next.length > 50) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    if (activeVariantIndex === -1) {
      setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(strokes))]);
      setStrokes(last);
    } else {
      setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(variants[activeVariantIndex] || []))]);
      setVariants((prev) => {
        const next = [...prev];
        next[activeVariantIndex] = last;
        return next;
      });
    }
  }, [undoStack, strokes, variants, activeVariantIndex]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    if (activeVariantIndex === -1) {
      setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(strokes))]);
      setStrokes(nextState);
    } else {
      setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(variants[activeVariantIndex] || []))]);
      setVariants((prev) => {
        const next = [...prev];
        next[activeVariantIndex] = nextState;
        return next;
      });
    }
  }, [redoStack, strokes, variants, activeVariantIndex]);

  const clearCanvas = useCallback(() => {
    if (activeVariantIndex === -1) {
      if (strokes.length === 0) return;
      pushUndo(strokes);
      setStrokes([]);
    } else {
      const current = variants[activeVariantIndex] || [];
      if (current.length === 0) return;
      pushUndo(current);
      setVariants((prev) => {
        const next = [...prev];
        next[activeVariantIndex] = [];
        return next;
      });
    }
  }, [activeVariantIndex, strokes, variants, pushUndo]);

  const addVariant = useCallback(() => {
    setVariants((prev) => {
      const next = [...prev, []];
      setActiveVariantIndex(next.length - 1);
      return next;
    });
  }, []);

  const switchToVariant = useCallback((idx: number) => {
    setActiveVariantIndex(idx);
  }, []);

  const switchToPrimary = useCallback(() => {
    setActiveVariantIndex(-1);
  }, []);

  const confirmDeleteVariant = useCallback((idx: number) => {
    setVariantToDelete(idx);
  }, []);

  const deleteVariant = useCallback(() => {
    if (variantToDelete === null) return;
    const idx = variantToDelete;
    setVariants((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (activeVariantIndex === idx) {
        setActiveVariantIndex(-1);
      } else if (activeVariantIndex > idx) {
        setActiveVariantIndex(activeVariantIndex - 1);
      }
      return next;
    });
    setVariantToDelete(null);
  }, [variantToDelete, activeVariantIndex]);

  const getCanvasCoordinates = useCallback((e: React.PointerEvent<HTMLCanvasElement> | PointerEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    if (cssW === 0 || cssH === 0) return null;
    const scaleX = VIRTUAL_WIDTH / cssW;
    const scaleY = VIRTUAL_HEIGHT / cssH;
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : undefined,
    };
  }, []);

  const startDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = getCanvasCoordinates(e);
      if (!pt) return;
      drawingInProgressRef.current = true;
      activePointerTypeRef.current = e.pointerType;
      if (tool === 'pen') {
        if (activeVariantIndex === -1) pushUndo(strokes);
        else pushUndo(variants[activeVariantIndex] || []);
        setIsDrawing(true);
        currentStrokeRef.current = [pt];
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (tool === 'eraser') {
        isEraserDraggingRef.current = false;
        eraseAtPoint(pt);
        setEraserMousePos(pt);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [tool, getCanvasCoordinates, activeVariantIndex, strokes, variants, pushUndo],
  );

  const draw = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = getCanvasCoordinates(e);
      if (!pt) return;
      if (tool === 'pen' && isDrawing) {
        currentStrokeRef.current.push(pt);
        const s = [...currentStrokeRef.current];
        if (activeVariantIndex === -1) {
          setStrokes((prev) => [...prev.slice(0, -0), ...([])]);
          setStrokes((prev) => {
            const next = [...prev];
            next[next.length - 1] = s;
            return next;
          });
          if (strokes.length === 0 || strokes[strokes.length - 1] !== s) {
          }
        } else {
          setVariants((prev) => {
            const next = [...prev];
            if (!next[activeVariantIndex]) next[activeVariantIndex] = [];
            next[activeVariantIndex][next[activeVariantIndex].length - 1] = s;
            return next;
          });
        }
      } else if (tool === 'eraser') {
        if (!isEraserDraggingRef.current) {
          if (activeVariantIndex === -1) pushUndo(strokes);
          else pushUndo(variants[activeVariantIndex] || []);
          isEraserDraggingRef.current = true;
        }
        eraseAtPoint(pt);
        setEraserMousePos(pt);
      }
    },
    [tool, isDrawing, getCanvasCoordinates, activeVariantIndex, strokes, variants],
  );

  const endDrawing = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === 'pen' && isDrawing && currentStrokeRef.current.length > 0) {
        const finalStroke = currentStrokeRef.current;
        if (activeVariantIndex === -1) {
          setStrokes((prev) => {
            const next = [...prev];
            next[next.length - 1] = finalStroke;
            return next;
          });
        } else {
          setVariants((prev) => {
            const next = [...prev];
            if (!next[activeVariantIndex]) next[activeVariantIndex] = [];
            next[activeVariantIndex][next[activeVariantIndex].length - 1] = finalStroke;
            return next;
          });
        }
        currentStrokeRef.current = [];
        setIsDrawing(false);
      }
      isEraserDraggingRef.current = false;
      setEraserMousePos(null);
      drawingInProgressRef.current = false;
      activePointerTypeRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
    [tool, isDrawing, activeVariantIndex],
  );

  const eraseAtPoint = useCallback(
    (pt: Point) => {
      const r = currentEraserRadius;
      if (activeVariantIndex === -1) {
        setStrokes((prev) =>
          prev.filter((s) => !s.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < r)),
        );
      } else {
        setVariants((prev) => {
          const next = [...prev];
          if (!next[activeVariantIndex]) next[activeVariantIndex] = [];
          next[activeVariantIndex] = next[activeVariantIndex].filter(
            (s) => !s.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < r),
          );
          return next;
        });
      }
    },
    [currentEraserRadius, activeVariantIndex],
  );

  const handlePointerLeave = useCallback(() => {
    setIsHoveringCanvas(false);
    setEraserMousePos(null);
  }, []);

  const handlePointerEnter = useCallback(() => {
    setIsHoveringCanvas(true);
  }, []);

  const handleSave = useCallback(() => {
    const cleanVariants = variants.filter((v) => v.length > 0);
    onSave(character.char, strokes, cleanVariants.length > 0 ? cleanVariants : undefined);
  }, [onSave, character.char, strokes, variants]);

  const currentStrokes = activeVariantIndex === -1 ? strokes : variants[activeVariantIndex] || [];

  const groupedChars = React.useMemo(() => {
    const groups: Record<string, { char: string; category: string; hasStrokes: boolean }[]> = {
      Uppercase: [],
      Lowercase: [],
      Numbers: [],
      Symbols: [],
    };
    allCharacterList.forEach((c) => {
      if (c.category === 'uppercase') groups.Uppercase.push(c);
      else if (c.category === 'lowercase') groups.Lowercase.push(c);
      else if (c.category === 'numbers') groups.Numbers.push(c);
      else groups.Symbols.push(c);
    });
    return groups;
  }, [allCharacterList]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex h-dvh w-screen flex-col overflow-hidden bg-neutral-50"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        }
        if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
          e.preventDefault();
          redo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          handleSave();
        }
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          clearCanvas();
        }
        if (e.key === 'ArrowRight' && hasNext && onNext) {
          e.preventDefault();
          onNext();
        }
        if (e.key === 'ArrowLeft' && hasPrevious && onPrevious) {
          e.preventDefault();
          onPrevious();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
      tabIndex={0}
    >
      <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
        <aside className="flex h-auto w-full flex-col overflow-hidden border-b border-neutral-200 bg-white lg:h-full lg:w-[320px] lg:min-w-[320px] lg:max-w-[360px] lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4 sm:px-5">
            <div className="min-w-0 space-y-1">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close editor</span>
              </button>
              <h2 className="truncate font-serif text-lg font-semibold text-neutral-900 sm:text-xl">
                Drawing &ldquo;{character.char}&rdquo;
              </h2>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                {character.category.replace('case', '-case')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setShowShortcuts((s) => !s)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                title="Keyboard shortcuts"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded((s) => !s)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                title={isExpanded ? 'Shrink canvas' : 'Expand canvas'}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-700">Progress</span>
                <span className="font-mono text-[11px] text-neutral-500">
                  {strokes.length} strokes • {((quality as any).score ?? (quality as any).quality ?? 0)}/100
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
                <div
                  className={`h-full transition-all duration-300 ${((quality as any).score ?? (quality as any).quality ?? 0) >= 90 ? 'bg-emerald-600' : ((quality as any).score ?? (quality as any).quality ?? 0) >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${((quality as any).score ?? (quality as any).quality ?? 0)}%` }}
                />
              </div>
              {quality.feedback.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p className="leading-relaxed">{quality.feedback[0]}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-700">Character navigation</span>
              <div className="grid max-h-48 grid-cols-8 gap-1 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50/60 p-2 sm:grid-cols-10 lg:grid-cols-8">
                {allCharacterList.map((c) => (
                  <button
                    key={c.char}
                    type="button"
                    onClick={() => onSelectCharacter?.(c.char)}
                    className={`flex aspect-square items-center justify-center rounded-md border text-sm font-medium transition-colors ${
                      c.char === character.char
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : c.hasStrokes
                        ? 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-900'
                        : 'border-dashed border-neutral-300 bg-white/70 text-neutral-500 hover:border-neutral-500'
                    }`}
                  >
                    {c.char}
                  </button>
                ))}
              </div>
              {Object.values(groupedChars).some((g) => g.length > 0) && (
                <div className="flex flex-wrap gap-1 text-[10px] text-neutral-500">
                  {Object.entries(groupedChars).map(([k, g]) => (
                    <span key={k} className="rounded-full bg-neutral-100 px-2 py-0.5">
                      {k}: {g.filter((x) => x.hasStrokes).length}/{g.length}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-700">Tools</span>
              <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50/60 p-1">
                <button
                  type="button"
                  onClick={() => setTool('pen')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    tool === 'pen' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <PenTool className="h-3.5 w-3.5" />
                  Pen
                </button>
                <button
                  type="button"
                  onClick={() => setTool('eraser')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
                    tool === 'eraser' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Eraser
                </button>
              </div>

              {tool === 'pen' && (
                <div className="space-y-3 rounded-lg border border-neutral-200 bg-white/90 p-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-600">Stroke width</span>
                      <span className="font-mono text-[11px] text-neutral-500">{strokeWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={16}
                      step={0.5}
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['gel', 'fountain', 'marker', 'pencil'] as PenStyle[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPenStyle(s)}
                        className={`rounded-md border px-2 py-1.5 text-[11px] capitalize transition-colors ${
                          penStyle === s ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tool === 'eraser' && (
                <div className="space-y-2 rounded-lg border border-neutral-200 bg-white/90 p-3">
                  <span className="text-[11px] text-neutral-600">Eraser size</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as EraserScale[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEraserScale(s)}
                        className={`rounded-md border px-2 py-1.5 text-[11px] capitalize transition-colors ${
                          eraserScale === s ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-lg border border-neutral-200 bg-white/90 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-600">Guidelines</span>
                  <button
                    type="button"
                    onClick={() => setShowGuidelines((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-0.5 text-[11px] transition-colors hover:border-neutral-400"
                  >
                    {showGuidelines ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {showGuidelines ? 'Visible' : 'Hidden'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['typography', 'notebook', 'dots', 'blank'] as GuidelineStyle[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setGuidelineStyle(s)}
                      disabled={!showGuidelines}
                      className={`rounded-md border px-2 py-1.5 text-[11px] capitalize transition-colors ${
                        guidelineStyle === s && showGuidelines
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 hover:border-neutral-400 disabled:opacity-40'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-700">Alternates</span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={switchToPrimary}
                  className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                    activeVariantIndex === -1 ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  Primary
                </button>
                {variants.map((_, i) => (
                  <div key={i} className="flex items-center gap-0.5 rounded-md border border-neutral-200">
                    <button
                      type="button"
                      onClick={() => switchToVariant(i)}
                      className={`px-2 py-1 text-[11px] transition-colors ${
                        activeVariantIndex === i ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50'
                      }`}
                    >
                      Alt {i + 1}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDeleteVariant(i)}
                      className="px-1.5 py-1 text-neutral-500 transition-colors hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariant}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2 py-1 text-[11px] text-neutral-600 transition-colors hover:border-neutral-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add alternate
                </button>
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Undo
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Redo
                </button>
              </div>
              <button
                type="button"
                onClick={clearCanvas}
                disabled={currentStrokes.length === 0}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={onPrevious}
                  disabled={!hasPrevious}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center justify-center gap-1 rounded-md bg-neutral-900 px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-neutral-800"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-neutral-200 px-2 py-1.5 text-[11px] font-medium transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4">
            <div className="flex items-center gap-2 text-[11px] text-neutral-600">
              <span className="font-medium text-neutral-900">{character.char}</span>
              <span>•</span>
              <span>{strokes.length} strokes</span>
              <span>•</span>
              <span className={((quality as any).score ?? (quality as any).quality ?? 0) >= 90 ? 'text-emerald-700' : ((quality as any).score ?? (quality as any).quality ?? 0) >= 70 ? 'text-amber-700' : 'text-rose-700'}>
                Quality {((quality as any).score ?? (quality as any).quality ?? 0)}/100
              </span>
              {activeVariantIndex >= 0 && (
                <>
                  <span>•</span>
                  <span className="text-neutral-900">Alt {activeVariantIndex + 1}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowGuidelines((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] transition-colors hover:border-neutral-400"
              >
                {showGuidelines ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                Guidelines
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                disabled={currentStrokes.length === 0}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 text-[11px] transition-colors hover:border-neutral-400 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
            <div
              className={`relative flex aspect-square max-h-full w-auto max-w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${
                isExpanded ? 'h-[min(92dvh,92vw)] w-[min(92dvh,92vw)]' : 'h-[min(78dvh,78vw)] w-[min(78dvh,78vw)] sm:h-[min(82dvh,82vw)] sm:w-[min(82dvh,82vw)] lg:h-[min(88dvh,88vw)] lg:w-[min(88dvh,88vw)]'
              }`}
            >
              <canvas
                ref={canvasRef}
                width={VIRTUAL_WIDTH}
                height={VIRTUAL_HEIGHT}
                className="h-full w-full touch-none select-none"
                style={{ touchAction: 'none' }}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={endDrawing}
                onPointerCancel={endDrawing}
                onPointerLeave={handlePointerLeave}
                onPointerEnter={handlePointerEnter}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
