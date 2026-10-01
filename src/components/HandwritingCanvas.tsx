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

  // Active strokes and undo/redo stacks
  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    return character.strokes ? JSON.parse(JSON.stringify(character.strokes)) : [];
  });
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);

  // Variants state (a1, a2, etc.)
  const [activeVariantIndex, setActiveVariantIndex] = useState<number>(-1); // -1 = primary, 0, 1 = alternates
  const [variants, setVariants] = useState<Stroke[][]>(() => {
    return character.variants ? JSON.parse(JSON.stringify(character.variants)) : [];
  });
  // Variant delete confirmation modal state
  const [variantToDelete, setVariantToDelete] = useState<number | null>(null);

  // Tool & drawing settings
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penStyle, setPenStyle] = useState<PenStyle>('gel');
  const [strokeWidth, setStrokeWidth] = useState<number>(5);
  const [eraserScale, setEraserScale] = useState<EraserScale>('medium');
  const [guidelineStyle, setGuidelineStyle] = useState<GuidelineStyle>('typography');
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);

  // Eraser scale radius map
  const eraserRadiusMap: Record<EraserScale, number> = {
    small: 8,
    medium: 18,
    large: 34,
  };
  const currentEraserRadius = eraserRadiusMap[eraserScale];

  // Quality check state
  const [quality, setQuality] = useState(() => analyzeCharacterStrokes(strokes, 400, 400));
  const [eraserMousePos, setEraserMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isHoveringCanvas, setIsHoveringCanvas] = useState(false);

  // Current stroke being drawn
  const currentStrokeRef = useRef<Point[]>([]);
  // Track active pointer type for palm rejection
  const activePointerTypeRef = useRef<string | null>(null);
  // Track whether eraser drag operation already pushed undo state
  const isEraserDraggingRef = useRef<boolean>(false);

  // Canvas virtual dimensions
  const VIRTUAL_WIDTH = 400;
  const VIRTUAL_HEIGHT = 400;

  // Guidelines positions (virtual coords)
  const GUIDELINES = {
    ascender: 60,
    capHeight: 110,
    midline: 190,
    baseline: 300,
    descender: 360,
  };

  // Sync state whenever the target character changes
  useEffect(() => {
    setStrokes(character.strokes ? JSON.parse(JSON.stringify(character.strokes)) : []);
    setVariants(character.variants ? JSON.parse(JSON.stringify(character.variants)) : []);
    setActiveVariantIndex(-1);
    setUndoStack([]);
    setRedoStack([]);
  }, [character.char, character.strokes, character.variants]);

  // Run quality check whenever strokes change
  useEffect(() => {
    setQuality(analyzeCharacterStrokes(strokes, VIRTUAL_WIDTH, VIRTUAL_HEIGHT));
  }, [strokes]);

  // Redraw canvas with high precision
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // 1. Draw background guidelines
    if (showGuidelines && guidelineStyle !== 'blank') {
      if (guidelineStyle === 'typography') {
        // Ascender
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(16, GUIDELINES.ascender);
        ctx.lineTo(VIRTUAL_WIDTH - 16, GUIDELINES.ascender);
        ctx.stroke();

        // Cap Height
        ctx.beginPath();
        ctx.moveTo(16, GUIDELINES.capHeight);
        ctx.lineTo(VIRTUAL_WIDTH - 16, GUIDELINES.capHeight);
        ctx.stroke();

        // Midline (x-height)
        ctx.strokeStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(16, GUIDELINES.midline);
        ctx.lineTo(VIRTUAL_WIDTH - 16, GUIDELINES.midline);
        ctx.stroke();

        // Baseline (solid, prominent)
        ctx.setLineDash([]);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(16, GUIDELINES.baseline);
        ctx.lineTo(VIRTUAL_WIDTH - 16, GUIDELINES.baseline);
        ctx.stroke();

        // Descender
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, GUIDELINES.descender);
        ctx.lineTo(VIRTUAL_WIDTH - 16, GUIDELINES.descender);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (guidelineStyle === 'notebook') {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        for (let y = 50; y <= 350; y += 30) {
          ctx.beginPath();
          ctx.moveTo(16, y);
          ctx.lineTo(VIRTUAL_WIDTH - 16, y);
          ctx.stroke();
        }
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(16, GUIDELINES.baseline);
        ctx.lineTo(VIRTUAL_WIDTH - 16, GUIDELINES.baseline);
        ctx.stroke();
      } else if (guidelineStyle === 'dots') {
        ctx.fillStyle = '#cbd5e1';
        for (let x = 30; x <= 370; x += 30) {
          for (let y = 30; y <= 370; y += 30) {
            ctx.beginPath();
            ctx.arc(x, y, 1.25, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(20, GUIDELINES.baseline);
        ctx.lineTo(VIRTUAL_WIDTH - 20, GUIDELINES.baseline);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 2. Reference ghost character in faint gray if empty
    if (strokes.length === 0 && currentStrokeRef.current.length === 0) {
      ctx.save();
      ctx.font = '240px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.fillText(character.char, VIRTUAL_WIDTH / 2, GUIDELINES.baseline);
      ctx.restore();
    }

    // 3. Helper to draw smooth strokes
    const drawStroke = (pts: Point[], width: number, isCurrent = false) => {
      if (pts.length === 0) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (penStyle === 'fountain') {
        ctx.strokeStyle = '#1e293b';
        if (pts.length === 1) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const angle = Math.atan2(dy, dx);
          const angleDiff = Math.abs(Math.cos(angle - Math.PI / 4));
          const effectiveWidth = Math.max(2, width * (0.6 + angleDiff * 0.8));

          ctx.lineWidth = effectiveWidth;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      } else if (penStyle === 'marker') {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = width * 1.35;
        if (pts.length === 1) {
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, (width * 1.35) / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      } else if (penStyle === 'pencil') {
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = Math.max(2.5, width * 0.85);
        if (pts.length === 1) {
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, (width * 0.85) / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      } else {
        // Gel Pen
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = width;
        if (pts.length === 1) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, width / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          return;
        }
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
      }

      ctx.restore();
    };

    // Draw all completed strokes
    for (const stroke of strokes) {
      drawStroke(stroke, strokeWidth);
    }

    // Draw current active stroke
    if (currentStrokeRef.current.length > 0) {
      drawStroke(currentStrokeRef.current, strokeWidth, true);
    }

    ctx.restore();
  }, [strokes, showGuidelines, guidelineStyle, strokeWidth, penStyle, character.char]);

  // Canvas resize and high-DPI scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = VIRTUAL_WIDTH * dpr;
    canvas.height = VIRTUAL_HEIGHT * dpr;
    redrawCanvas();
  }, [redrawCanvas, isExpanded]);

  // Coordinates mapping from screen to 400x400 virtual space
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = VIRTUAL_WIDTH / rect.width;
    const scaleY = VIRTUAL_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  // TRUE DRAG ERASER (Removes local points and splits strokes; does NOT wipe entire stroke on tap)
  const eraseAlongDragPoint = (point: Point) => {
    const radius = currentEraserRadius;
    let hasModified = false;
    const newStrokes: Stroke[] = [];

    for (const stroke of strokes) {
      const touchesEraser = stroke.some(
        (pt) => Math.hypot(pt.x - point.x, pt.y - point.y) <= radius
      );

      if (!touchesEraser) {
        newStrokes.push(stroke);
        continue;
      }

      hasModified = true;
      // Split stroke into subsegments by omitting points inside eraser radius
      let subsegment: Point[] = [];
      for (const pt of stroke) {
        if (Math.hypot(pt.x - point.x, pt.y - point.y) > radius) {
          subsegment.push(pt);
        } else {
          if (subsegment.length > 0) {
            newStrokes.push(subsegment);
            subsegment = [];
          }
        }
      }
      if (subsegment.length > 0) {
        newStrokes.push(subsegment);
      }
    }

    if (hasModified) {
      if (!isEraserDraggingRef.current) {
        setUndoStack((prev) => [...prev, strokes]);
        setRedoStack([]);
        isEraserDraggingRef.current = true;
      }
      setStrokes(newStrokes);
    }
  };

  // Pointer event handlers with palm rejection support
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    if (activePointerTypeRef.current === 'pen' && e.pointerType === 'touch') {
      return;
    }
    activePointerTypeRef.current = e.pointerType;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const point = getCoordinates(e);

    if (tool === 'eraser') {
      isEraserDraggingRef.current = false;
      eraseAlongDragPoint(point);
      return;
    }

    currentStrokeRef.current = [point];
    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    if (activePointerTypeRef.current === 'pen' && e.pointerType === 'touch') {
      return;
    }

    const point = getCoordinates(e);

    if (tool === 'eraser') {
      eraseAlongDragPoint(point);
      return;
    }

    // Micro-jitter threshold filter
    const pts = currentStrokeRef.current;
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const dist = Math.hypot(point.x - last.x, point.y - last.y);
      if (dist < 2.0) return;
    }

    currentStrokeRef.current.push(point);
    redrawCanvas();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    isEraserDraggingRef.current = false;

    if (tool === 'eraser') {
      return;
    }

    if (currentStrokeRef.current.length > 0) {
      const newStrokes = [...strokes, [...currentStrokeRef.current]];
      setUndoStack((prev) => [...prev, strokes]);
      setRedoStack([]);
      setStrokes(newStrokes);
      currentStrokeRef.current = [];
    }
  };

  // Undo / Redo / Clear
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, strokes]);
    setStrokes(previous);
  }, [undoStack, strokes]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, strokes]);
    setStrokes(next);
  }, [redoStack, strokes]);

  const handleClear = () => {
    if (strokes.length === 0) return;
    setUndoStack((prev) => [...prev, strokes]);
    setRedoStack([]);
    setStrokes([]);
    currentStrokeRef.current = [];
  };

  // Switch between primary character and alternate variations (a1, a2...)
  const handleSelectVariant = (index: number) => {
    let updatedVariants = [...variants];
    if (activeVariantIndex === -1) {
      // primary
    } else {
      updatedVariants[activeVariantIndex] = strokes;
      setVariants(updatedVariants);
    }

    setActiveVariantIndex(index);
    if (index === -1) {
      setStrokes(character.strokes ? JSON.parse(JSON.stringify(character.strokes)) : []);
    } else {
      const vStrokes = updatedVariants[index] || [];
      setStrokes(JSON.parse(JSON.stringify(vStrokes)));
    }
    setUndoStack([]);
    setRedoStack([]);
  };

  const handleAddVariant = () => {
    if (variants.length >= 3) return;
    const newVariants = [...variants, []];
    setVariants(newVariants);
    handleSelectVariant(newVariants.length - 1);
  };

  // Delete variant request handler
  const handleDeleteVariantTrigger = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const targetVariantStrokes =
      index === activeVariantIndex ? strokes : variants[index] || [];

    // If blank (no strokes written), delete immediately without asking!
    if (!targetVariantStrokes || targetVariantStrokes.length === 0) {
      performDeleteVariant(index);
    } else {
      // If something was written, open confirm dialog!
      setVariantToDelete(index);
    }
  };

  // Perform variant deletion
  const performDeleteVariant = (index: number) => {
    const updatedVariants = variants.filter((_, i) => i !== index);
    setVariants(updatedVariants);
    setVariantToDelete(null);

    let nextPrimary = character.strokes || [];
    if (activeVariantIndex === index) {
      // Switch back to primary
      setActiveVariantIndex(-1);
      setStrokes(JSON.parse(JSON.stringify(nextPrimary)));
      onSave(character.char, nextPrimary, updatedVariants);
    } else {
      const newActive = activeVariantIndex > index ? activeVariantIndex - 1 : activeVariantIndex;
      setActiveVariantIndex(newActive);
      onSave(character.char, strokes, updatedVariants);
    }
  };

  // Commit and save helper
  const commitCurrentStrokes = useCallback(() => {
    let finalPrimary = strokes;
    let finalVariants = variants;

    if (activeVariantIndex !== -1) {
      finalVariants = [...variants];
      finalVariants[activeVariantIndex] = strokes;
      finalPrimary = character.strokes || [];
    }

    onSave(character.char, finalPrimary, finalVariants);
  }, [strokes, variants, activeVariantIndex, character.char, character.strokes, onSave]);

  const handleSaveAndNext = useCallback(() => {
    commitCurrentStrokes();
    if (onNext && hasNext) {
      onNext();
    }
  }, [commitCurrentStrokes, onNext, hasNext]);

  const handleSaveAndPrev = useCallback(() => {
    commitCurrentStrokes();
    if (onPrevious && hasPrevious) {
      onPrevious();
    }
  }, [commitCurrentStrokes, onPrevious, hasPrevious]);

  const handleSaveAndClose = useCallback(() => {
    commitCurrentStrokes();
    onClose();
  }, [commitCurrentStrokes, onClose]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSaveAndPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSaveAndClose();
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
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('eraser');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSaveAndNext, handleSaveAndPrev, handleSaveAndClose]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm ${
        isExpanded ? 'p-0' : 'p-2 sm:p-4'
      } overflow-y-auto`}
    >
      <div
        className={`bg-white border border-neutral-200 shadow-2xl w-full flex flex-col transition-all ${
          isExpanded
            ? 'h-full max-w-none rounded-none'
            : 'max-w-2xl sm:max-w-3xl rounded-3xl my-auto p-4 sm:p-5 max-h-[95vh] overflow-y-auto'
        }`}
      >
        {/* ========================================================================= */}
        {/* 1. TOP HEADER & CHARACTER SELECTOR CAROUSEL                                */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-xl font-bold font-serif text-neutral-900 shadow-2xs">
              {character.char}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-neutral-900 font-serif">
                  Write '{character.char}'
                </h3>
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono bg-neutral-100 px-1.5 py-0.5 rounded">
                  U+{character.unicode.toString(16).toUpperCase().padStart(4, '0')}
                </span>
                <span className="hidden sm:inline text-xs text-neutral-400 capitalize">
                  · {character.category}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 hidden sm:block">
                Stylus & touch enabled. Write between cap line and baseline.
              </p>
            </div>
          </div>

          {/* Quick controls: Expand, Shortcuts info, Close */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              title="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              title={isExpanded ? 'Restore window size' : 'Expand full screen'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSaveAndClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              title="Save & Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Shortcuts popup banner */}
        {showShortcuts && (
          <div className="p-2.5 my-2 bg-neutral-50 border border-neutral-200 rounded-2xl text-[11px] text-neutral-600 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono">
            <span><strong className="text-neutral-900">Enter / →</strong> : Save & Next</span>
            <span><strong className="text-neutral-900">←</strong> : Previous</span>
            <span><strong className="text-neutral-900">Ctrl+Z</strong> : Undo</span>
            <span><strong className="text-neutral-900">Ctrl+Y</strong> : Redo</span>
            <span><strong className="text-neutral-900">1/2/3/4</strong> : Pens</span>
            <span><strong className="text-neutral-900">E</strong> : Eraser</span>
            <span><strong className="text-neutral-900">Esc</strong> : Close</span>
          </div>
        )}

        {/* Character Carousel Tray */}
        {allCharacterList.length > 0 && onSelectCharacter && (
          <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-neutral-100">
            {allCharacterList.map((item) => {
              const isCurrent = item.char === character.char;
              return (
                <button
                  key={item.char}
                  onClick={() => {
                    commitCurrentStrokes();
                    onSelectCharacter(item.char);
                  }}
                  className={`min-w-[30px] h-7 px-1.5 rounded-lg flex items-center justify-center text-xs font-mono transition-all relative cursor-pointer ${
                    isCurrent
                      ? 'bg-neutral-900 text-white font-bold shadow-2xs scale-105'
                      : item.hasStrokes
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                  title={`Character ${item.char}`}
                >
                  <span>{item.char}</span>
                  {item.hasStrokes && !isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. SUB-BAR: STYLE VARIANTS (WITH DELETE OPTION) & GUIDELINE TOGGLES        */}
        {/* ========================================================================= */}
        <div className="py-2 flex flex-wrap items-center justify-between gap-2.5 border-b border-neutral-100 text-xs text-neutral-600">
          {/* Alternates selector with delete option */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-neutral-700 mr-1 text-[11px] font-mono">Variant:</span>
            <button
              onClick={() => handleSelectVariant(-1)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
                activeVariantIndex === -1
                  ? 'bg-neutral-900 text-white shadow-2xs'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Primary {character.char}
            </button>

            {variants.map((v, idx) => (
              <div
                key={idx}
                className={`inline-flex items-center rounded-lg border overflow-hidden ${
                  activeVariantIndex === idx
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200/80'
                }`}
              >
                <button
                  onClick={() => handleSelectVariant(idx)}
                  className="px-2 py-1 font-medium transition-colors cursor-pointer text-xs flex items-center gap-1"
                >
                  <span>Alt {character.char}{idx + 1}</span>
                  {v && v.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>
                {/* Delete button on variant */}
                <button
                  onClick={(e) => handleDeleteVariantTrigger(e, idx)}
                  className={`px-1.5 py-1 transition-colors cursor-pointer text-xs ${
                    activeVariantIndex === idx
                      ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white'
                      : 'hover:bg-neutral-300 text-neutral-400 hover:text-red-600'
                  }`}
                  title="Delete this variant"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {variants.length < 3 && (
              <button
                onClick={handleAddVariant}
                className="px-2 py-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-dashed border-neutral-300 flex items-center gap-1 transition-colors cursor-pointer text-xs"
                title="Add handwriting alternate variant"
              >
                <Plus className="w-3 h-3" />
                <span>+ Alt</span>
              </button>
            )}
          </div>

          {/* Guideline style selection */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-[11px]">
              {(['typography', 'notebook', 'dots', 'blank'] as GuidelineStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => {
                    setGuidelineStyle(style);
                    setShowGuidelines(style !== 'blank');
                  }}
                  className={`px-2 py-0.5 rounded-md capitalize transition-colors cursor-pointer ${
                    guidelineStyle === style
                      ? 'bg-white font-semibold text-neutral-900 shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowGuidelines(!showGuidelines)}
              className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              title="Toggle guidelines"
            >
              {showGuidelines ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Variant Delete Confirmation Modal */}
        {variantToDelete !== null && (
          <div className="p-3 my-2 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Delete Alternate Variant <strong>Alt {character.char}{variantToDelete + 1}</strong>? Your handwritten strokes in this variant will be removed.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setVariantToDelete(null)}
                className="px-2.5 py-1 bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100 rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => performDeleteVariant(variantToDelete)}
                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-medium cursor-pointer"
              >
                Delete Variant
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. MAIN CANVAS DRAWING AREA (High precision, touch-action: none)           */}
        {/* ========================================================================= */}
        <div className="relative my-2.5 flex flex-col items-center flex-1 justify-center">
          <div className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-square rounded-2xl border border-neutral-200 bg-white shadow-inner overflow-hidden select-none touch-none">
            {/* Guide line labels */}
            {showGuidelines && guidelineStyle === 'typography' && (
              <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-between pointer-events-none py-1 text-[9px] text-neutral-400 font-mono">
                <span
                  style={{
                    position: 'absolute',
                    top: `${(GUIDELINES.ascender / 400) * 100}%`,
                    transform: 'translateY(-100%)',
                  }}
                >
                  ascender
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${(GUIDELINES.capHeight / 400) * 100}%`,
                    transform: 'translateY(-100%)',
                  }}
                >
                  cap
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${(GUIDELINES.midline / 400) * 100}%`,
                    transform: 'translateY(-100%)',
                  }}
                >
                  x-height
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${(GUIDELINES.baseline / 400) * 100}%`,
                    transform: 'translateY(-100%)',
                  }}
                >
                  baseline
                </span>
                <span
                  style={{
                    position: 'absolute',
                    top: `${(GUIDELINES.descender / 400) * 100}%`,
                    transform: 'translateY(-100%)',
                  }}
                >
                  descender
                </span>
              </div>
            )}

            <canvas
              ref={canvasRef}
              className={`w-full h-full touch-none ${
                tool === 'eraser'
                  ? isHoveringCanvas
                    ? 'cursor-none'
                    : 'cursor-default'
                  : 'cursor-crosshair'
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setEraserMousePos({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
                handlePointerMove(e);
              }}
              onPointerEnter={() => setIsHoveringCanvas(true)}
              onPointerLeave={() => {
                setIsHoveringCanvas(false);
                setEraserMousePos(null);
              }}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />

            {/* Eraser cursor circle overlay */}
            {tool === 'eraser' && isHoveringCanvas && eraserMousePos && (
              <div
                className="absolute pointer-events-none rounded-full border-2 border-neutral-900 bg-neutral-900/15 shadow-sm transition-all duration-75"
                style={{
                  left: eraserMousePos.x,
                  top: eraserMousePos.y,
                  width: `${Math.max(16, (currentEraserRadius / 200) * 100)}%`,
                  height: `${Math.max(16, (currentEraserRadius / 200) * 100)}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
          </div>

          {/* Stroke count & baseline guide helper */}
          <div className="flex items-center justify-between w-full max-w-[420px] mt-1 text-[11px] text-neutral-400 font-mono">
            <span>Strokes: {strokes.length}</span>
            <span>Character: {character.char}</span>
            <span>
              {quality.status === 'good' ? (
                <span className="text-emerald-600 font-sans font-medium">✓ Optimal balance</span>
              ) : quality.status === 'warning' ? (
                <span className="text-amber-600 font-sans font-medium">Notice</span>
              ) : (
                <span className="text-neutral-400 font-sans">Ready</span>
              )}
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. TOOLBAR CONTROLS: PENS, ERASER WITH SCALING & DRAG ERASING             */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 py-2 border-t border-b border-neutral-100 bg-neutral-50/70 px-3 rounded-2xl mb-2.5">
          {/* Tool Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-neutral-200">
              <button
                onClick={() => {
                  setTool('pen');
                  setPenStyle('gel');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tool === 'pen' && penStyle === 'gel'
                    ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Gel Pen: Clean uniform stroke"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Gel Pen</span>
              </button>

              <button
                onClick={() => {
                  setTool('pen');
                  setPenStyle('fountain');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tool === 'pen' && penStyle === 'fountain'
                    ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Fountain Pen: Dynamic angle stroke"
              >
                <span>✒️ Fountain</span>
              </button>

              <button
                onClick={() => {
                  setTool('pen');
                  setPenStyle('marker');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tool === 'pen' && penStyle === 'marker'
                    ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Marker: Bold rounded line"
              >
                <span>🖌️ Marker</span>
              </button>

              <button
                onClick={() => {
                  setTool('pen');
                  setPenStyle('pencil');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  tool === 'pen' && penStyle === 'pencil'
                    ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Pencil: Soft graphite texture"
              >
                <span>✏️ Pencil</span>
              </button>
            </div>

            {/* Eraser button with drag capability */}
            <button
              onClick={() => setTool('eraser')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                tool === 'eraser'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                  : 'bg-white text-neutral-600 hover:text-neutral-900 border-neutral-200'
              }`}
              title="Drag Eraser: Drag to erase localized stroke points"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Drag Eraser</span>
            </button>

            {/* Stroke Width Selector when Pen is active */}
            {tool === 'pen' && (
              <div className="flex items-center gap-1 pl-1 text-xs text-neutral-500">
                <span className="text-[11px] font-mono">Weight:</span>
                {[
                  { label: 'Fine', value: 3.5 },
                  { label: 'Regular', value: 5.5 },
                  { label: 'Bold', value: 8 },
                ].map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setStrokeWidth(w.value)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      strokeWidth === w.value
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            )}

            {/* Eraser Scale Selector (Small / Medium / Large) when Eraser is active */}
            {tool === 'eraser' && (
              <div className="flex items-center gap-1 pl-1 text-xs text-neutral-500">
                <span className="text-[11px] font-mono font-semibold text-neutral-900">Eraser Size:</span>
                {(['small', 'medium', 'large'] as EraserScale[]).map((scale) => (
                  <button
                    key={scale}
                    onClick={() => setEraserScale(scale)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                      eraserScale === scale
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200'
                    }`}
                  >
                    {scale}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Undo / Redo / Trash */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="p-1.5 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="p-1.5 text-neutral-600 hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-rose-50 transition-colors ml-1 cursor-pointer"
              title="Clear canvas strokes"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quality Notice Banner */}
        {strokes.length > 0 && quality.status !== 'good' && (
          <div
            className={`p-2 rounded-xl mb-2.5 text-xs flex items-center gap-2 transition-colors ${
              quality.status === 'warning'
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div className="flex-1 flex items-center justify-between">
              <span>{quality.feedback}</span>
              <span className="text-[10px] uppercase font-mono opacity-80 font-bold ml-2">
                Tip
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. ACTION CONTROLS: PREVIOUS, SAVE & NEXT, AND FINISH                     */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between pt-1 gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            {hasPrevious && onPrevious && (
              <button
                onClick={handleSaveAndPrev}
                className="px-3 py-2 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Save and jump to previous letter (Left Arrow)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev Letter</span>
              </button>
            )}
            <button
              onClick={handleSaveAndClose}
              className="px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveAndClose}
              disabled={strokes.length === 0}
              className="px-4 py-2 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
            >
              Save & Close
            </button>

            {hasNext && onNext && (
              <button
                onClick={handleSaveAndNext}
                disabled={strokes.length === 0}
                className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer group"
                title="Save and advance immediately to next character (Enter or Right Arrow)"
              >
                <span>Save & Next Letter</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
