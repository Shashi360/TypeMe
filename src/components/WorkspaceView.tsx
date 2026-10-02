import React, { useState } from 'react';
import {
  FontProject,
  CharacterCategory,
  CharacterData,
  Stroke,
} from '../types';
import {
  UPPERCASE_CHARS,
  LOWERCASE_CHARS,
  NUMBER_CHARS,
  SYMBOL_CHARS,
  CharDefinition,
} from '../utils/sampleData';
import { HandwritingCanvas } from './HandwritingCanvas';
import {
  PenTool,
  CheckCircle,
  AlertTriangle,
  Eye,
  Sliders,
  ChevronRight,
  ArrowLeft,
  FileCheck,
  Download,
} from 'lucide-react';

interface WorkspaceViewProps {
  project: FontProject;
  onUpdateCharacter: (
    char: string,
    strokes: Stroke[],
    variants?: Stroke[][],
    strokeStyles?: { brush: string; size: string }[],
    variantStyles?: { brush: string; size: string }[][],
  ) => void;
  onBackToDashboard: () => void;
  onOpenReview: () => void;
  onOpenPreview: () => void;
  onGenerateFont: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  project,
  onUpdateCharacter,
  onBackToDashboard,
  onOpenReview,
  onOpenPreview,
  onGenerateFont,
}) => {
  const [activeCategory, setActiveCategory] = useState<CharacterCategory>('uppercase');
  const [editingChar, setEditingChar] = useState<CharacterData | null>(null);

  // Group definitions
  const categoryMap: Record<CharacterCategory, { label: string; chars: CharDefinition[] }> = {
    uppercase: { label: 'A-Z Uppercase', chars: UPPERCASE_CHARS },
    lowercase: { label: 'a-z Lowercase', chars: LOWERCASE_CHARS },
    numbers: { label: '0-9 Numbers', chars: NUMBER_CHARS },
    symbols: { label: 'Punctuation & Symbols', chars: SYMBOL_CHARS },
  };

  const currentChars = categoryMap[activeCategory].chars;

  // Compute counts
  const totalChars = Object.keys(project.characters).length || 82;
  const completedChars = Object.values(project.characters).filter(
    (c) => c.strokes && c.strokes.length > 0
  ).length;
  const progressPercent = Math.round((completedChars / totalChars) * 100);

  const allDefs = [...UPPERCASE_CHARS, ...LOWERCASE_CHARS, ...NUMBER_CHARS, ...SYMBOL_CHARS];

  // Handle previous/next inside canvas
  const handleNextChar = () => {
    if (!editingChar) return;
    const currentIndex = allDefs.findIndex((d) => d.char === editingChar.char);
    if (currentIndex >= 0 && currentIndex < allDefs.length - 1) {
      const nextDef = allDefs[currentIndex + 1];
      const charData = project.characters[nextDef.char] || {
        char: nextDef.char,
        unicode: nextDef.unicode,
        category: nextDef.category,
        strokes: [],
        qualityStatus: 'empty',
      };
      setEditingChar(charData);
    }
  };

  const handlePrevChar = () => {
    if (!editingChar) return;
    const currentIndex = allDefs.findIndex((d) => d.char === editingChar.char);
    if (currentIndex > 0) {
      const prevDef = allDefs[currentIndex - 1];
      const charData = project.characters[prevDef.char] || {
        char: prevDef.char,
        unicode: prevDef.unicode,
        category: prevDef.category,
        strokes: [],
        qualityStatus: 'empty',
      };
      setEditingChar(charData);
    }
  };

  const handleSelectChar = (char: string) => {
    const def = allDefs.find((d) => d.char === char);
    if (!def) return;
    const charData = project.characters[def.char] || {
      char: def.char,
      unicode: def.unicode,
      category: def.category,
      strokes: [],
      qualityStatus: 'empty',
    };
    setEditingChar(charData);
  };

  const characterListSummary = allDefs.map((def) => {
    const data = project.characters[def.char];
    return {
      char: def.char,
      category: def.category,
      hasStrokes: !!(data && data.strokes && data.strokes.length > 0),
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Breadcrumbs & Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <button
              onClick={onBackToDashboard}
              className="hover:text-neutral-900 transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <span>/</span>
            <span className="text-neutral-900 font-medium truncate max-w-[200px]">
              {project.name}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 font-serif">
            Create Your Font
          </h1>
          <p className="text-xs text-neutral-500">
            Click any character card to draw or redraw. All strokes are continuously saved.
          </p>
        </div>

        {/* Global actions: Review, Preview, Generate */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenReview}
            className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5 text-neutral-600" />
            <span>Review All</span>
          </button>

          <button
            onClick={onOpenPreview}
            className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-neutral-600" />
            <span>Test Preview</span>
          </button>

          <button
            onClick={onGenerateFont}
            className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <PenTool className="w-3.5 h-3.5 text-amber-300" />
            <span>Generate Font</span>
          </button>
        </div>
      </div>

      {/* 2. Progress Tracker Strip */}
      <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-800">
              {completedChars} / {totalChars} characters completed
            </span>
            <span className="text-[11px] text-neutral-500 font-mono">({progressPercent}%)</span>
          </div>
          <p className="text-[11px] text-neutral-400">
            Tip: Complete at least A-Z uppercase and a-z lowercase for standard sentence preview.
          </p>
        </div>

        <div className="w-full sm:w-64 space-y-1.5">
          <div className="w-full h-2 rounded-full bg-neutral-100 overflow-hidden border border-neutral-200">
            <div
              className="h-full bg-neutral-900 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Category Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-xl max-w-xl overflow-x-auto no-scrollbar">
        {(Object.keys(categoryMap) as CharacterCategory[]).map((cat) => {
          const isActive = activeCategory === cat;
          const catChars = categoryMap[cat].chars;
          const catCompleted = catChars.filter(
            (c) => project.characters[c.char]?.strokes?.length > 0
          ).length;

          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 min-w-[110px] py-2 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                isActive
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>{categoryMap[cat].label.split(' ')[0]}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                  isActive ? 'bg-neutral-100 text-neutral-800' : 'text-neutral-400'
                }`}
              >
                {catCompleted}/{catChars.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Character Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4">
        {currentChars.map((def) => {
          const charData = project.characters[def.char] || {
            char: def.char,
            unicode: def.unicode,
            category: def.category,
            strokes: [],
            qualityStatus: 'empty',
          };

          const hasStrokes = charData.strokes && charData.strokes.length > 0;
          const variantCount = charData.variants ? charData.variants.length : 0;

          return (
            <button
              type="button"
              key={def.char}
              onClick={() => setEditingChar(charData)}
              aria-label={
                hasStrokes
                  ? `Edit ${def.char}, ${charData.strokes.length} strokes`
                  : `Write ${def.char}`
              }
              className={`relative aspect-square rounded-xl border bg-white p-3 flex flex-col justify-between text-left cursor-pointer transition-all hover:scale-[1.02] shadow-2xs group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${
                hasStrokes
                  ? 'border-neutral-200 hover:border-neutral-900'
                  : 'border-dashed border-neutral-300 hover:border-neutral-500 bg-neutral-50/40'
              }`}
            >
              {/* Card Header: Letter label + status */}
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold font-mono text-neutral-400 group-hover:text-neutral-800 transition-colors">
                  {def.char}
                </span>

                {hasStrokes ? (
                  charData.qualityStatus === 'warning' ? (
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                  ) : (
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                  )
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-200 group-hover:bg-neutral-400 transition-colors" />
                )}
              </div>

              {/* Card Center: SVG Stroke Preview or Empty Prompt */}
              <div className="flex-1 flex items-center justify-center my-1 overflow-hidden">
                {hasStrokes ? (
                  <svg
                    viewBox="0 0 400 400"
                    className="w-full h-full max-h-[70px] stroke-neutral-900"
                    style={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}
                  >
                    {/* Faint baseline guideline in thumbnail */}
                    <line
                      x1="40"
                      y1="300"
                      x2="360"
                      y2="300"
                      stroke="#e2e8f0"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    {charData.strokes.map((stroke, sIdx) => {
                      if (stroke.length === 1) {
                        return (
                          <circle
                            key={sIdx}
                            cx={stroke[0].x}
                            cy={stroke[0].y}
                            r="12"
                            fill="#1e293b"
                          />
                        );
                      }
                      const d = stroke.reduce((acc, pt, pIdx) => {
                        return pIdx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                      }, '');
                      return (
                        <path
                          key={sIdx}
                          d={d}
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="24"
                        />
                      );
                    })}
                  </svg>
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-300 group-hover:text-neutral-600 transition-colors">
                    <PenTool className="w-4 h-4 mb-1" />
                    <span className="text-[10px] font-medium">Write {def.char}</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Metadata / Alternates indicator */}
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>{hasStrokes ? `${charData.strokes.length} st` : 'Empty'}</span>
                {variantCount > 0 && (
                  <span className="font-mono text-[9px] bg-neutral-100 text-neutral-600 px-1 rounded">
                    +{variantCount} alt
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 5. Handwriting Canvas Modal */}
      {editingChar && (
        <HandwritingCanvas
          character={editingChar}
          onSave={async (data: CharacterData) => {
            onUpdateCharacter(data.char, data.strokes, data.variants, data.strokeStyles, data.variantStyles);
          }}
          onClose={() => setEditingChar(null)}
          onNext={handleNextChar}
          onPrevious={handlePrevChar}
          hasPrevious={true}
          hasNext={true}
          allCharacterList={characterListSummary}
          onSelectCharacter={handleSelectChar}
          projectName={project.name}
          completedCount={completedChars}
          totalCount={totalChars}
        />
      )}
    </div>
  );
};
