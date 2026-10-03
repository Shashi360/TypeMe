import React, { useState } from 'react';
import { FontProject, CharacterData, Stroke } from '../types';
import { ALL_CHARACTERS, CharDefinition } from '../utils/sampleData';
import { HandwritingCanvas } from './HandwritingCanvas';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  PenTool,
  ArrowRight,
  Filter,
  Lock,
} from 'lucide-react';
import {
  getEntitlements,
  upgradeForCharacters,
  type UpgradeCopy,
} from '../utils/entitlements';
import { UpgradeModal } from './UpgradeModal';

interface ReviewViewProps {
  project: FontProject;
  onUpdateCharacter: (
    char: string,
    strokes: Stroke[],
    variants?: Stroke[][],
    strokeStyles?: { brush: string; size: string }[],
    variantStyles?: { brush: string; size: string }[][],
  ) => void;
  onBackToWorkspace: () => void;
  onContinueToPreview: () => void;
  tier?: string;
  onUpgrade?: () => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({
  project,
  onUpdateCharacter,
  onBackToWorkspace,
  onContinueToPreview,
  tier = 'free',
  onUpgrade,
}) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'warning' | 'unwritten'>('all');
  const [editingChar, setEditingChar] = useState<CharacterData | null>(null);

  const total = ALL_CHARACTERS.length;
  const completed = Object.values(project.characters).filter(
    (c) => c.strokes && c.strokes.length > 0
  ).length;
  const warnings = Object.values(project.characters).filter(
    (c) => c.qualityStatus === 'warning'
  ).length;

  const filteredChars = ALL_CHARACTERS.filter((def) => {
    const data = project.characters[def.char];
    const hasStrokes = data && data.strokes && data.strokes.length > 0;
    if (filter === 'completed') return hasStrokes;
    if (filter === 'warning') return hasStrokes && data.qualityStatus === 'warning';
    if (filter === 'unwritten') return !hasStrokes;
    return true;
  });

  const [upgrade, setUpgrade] = useState<UpgradeCopy | null>(null);
  const ent = getEntitlements(tier);

  const charDataFor = (def: CharDefinition): CharacterData => {
    return (
      project.characters[def.char] || {
        char: def.char,
        unicode: def.unicode,
        category: def.category,
        strokes: [],
        qualityStatus: 'empty',
      }
    );
  };

  const isLockedDef = (def: CharDefinition): boolean => {
    const data = project.characters[def.char];
    const hasStrokes = !!((data as { strokes?: Stroke[] } | undefined)?.strokes?.length);
    return !ent.isCharacterAllowed(def.char, hasStrokes);
  };

  const openCharDef = (def: CharDefinition) => {
    if (isLockedDef(def)) {
      setUpgrade(upgradeForCharacters);
      return;
    }
    setEditingChar(charDataFor(def));
  };

  const handleNextChar = () => {
    if (!editingChar) return;
    const currentIndex = ALL_CHARACTERS.findIndex((d) => d.char === editingChar.char);
    if (currentIndex >= 0 && currentIndex < ALL_CHARACTERS.length - 1) {
      openCharDef(ALL_CHARACTERS[currentIndex + 1]);
    }
  };

  const handlePrevChar = () => {
    if (!editingChar) return;
    const currentIndex = ALL_CHARACTERS.findIndex((d) => d.char === editingChar.char);
    if (currentIndex > 0) {
      openCharDef(ALL_CHARACTERS[currentIndex - 1]);
    }
  };

  const handleSelectChar = (char: string) => {
    const def = ALL_CHARACTERS.find((d) => d.char === char);
    if (!def) return;
    openCharDef(def);
  };

  const characterListSummary = ALL_CHARACTERS.map((def) => {
    const data = project.characters[def.char];
    return {
      char: def.char,
      category: def.category,
      hasStrokes: !!(data && data.strokes && data.strokes.length > 0),
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="space-y-1">
          <button
            onClick={onBackToWorkspace}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workspace</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 font-serif">
            Your letters are taking shape.
          </h1>
          <p className="text-xs text-neutral-500">
            Review every character. Click any letter to redraw or fine-tune strokes.
          </p>
        </div>

        <button
          onClick={onContinueToPreview}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <span>Continue to Preview</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Audit Summary & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-neutral-200 shadow-2xs">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-neutral-500">Characters complete:</span>{' '}
            <span className="font-bold text-neutral-900 font-mono">
              {completed} / {total}
            </span>
          </div>
          <span className="text-neutral-300">|</span>
          <div className="flex items-center gap-1 text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{warnings} warnings</span>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100 rounded-lg text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-white text-neutral-900 shadow-2xs font-medium'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            All ({total})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'completed'
                ? 'bg-white text-neutral-900 shadow-2xs font-medium'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Completed ({completed})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'warning'
                ? 'bg-white text-neutral-900 shadow-2xs font-medium'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Warnings ({warnings})
          </button>
          <button
            onClick={() => setFilter('unwritten')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'unwritten'
                ? 'bg-white text-neutral-900 shadow-2xs font-medium'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            Unwritten ({total - completed})
          </button>
        </div>
      </div>

      {/* 3. Review Character Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {filteredChars.map((def) => {
          const charData = project.characters[def.char] || {
            char: def.char,
            unicode: def.unicode,
            category: def.category,
            strokes: [],
            qualityStatus: 'empty',
          };
          const hasStrokes = charData.strokes && charData.strokes.length > 0;
          const isWarning = hasStrokes && charData.qualityStatus === 'warning';
          const locked = !ent.isCharacterAllowed(def.char, !!hasStrokes);

          return (
            <div
              key={def.char}
              onClick={() => openCharDef(def)}
              className="p-3 rounded-xl border border-neutral-200 bg-white hover:border-neutral-900 transition-all cursor-pointer shadow-2xs group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold font-mono text-neutral-800">{def.char}</span>
                {locked ? (
                  <Lock className="w-3.5 h-3.5 text-neutral-400" />
                ) : hasStrokes ? (
                  isWarning ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span>Review</span>
                    </span>
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )
                ) : (
                  <span className="text-[10px] text-neutral-400">Empty</span>
                )}
              </div>

              {/* Stroke SVG thumbnail */}
              <div className="h-14 flex items-center justify-center overflow-hidden my-1">
                {hasStrokes ? (
                  <svg viewBox="0 0 400 400" className="w-full h-full max-h-12 stroke-neutral-900">
                    <line x1="20" y1="300" x2="380" y2="300" stroke="#f1f5f9" strokeWidth="2" />
                    {charData.strokes.map((stroke, sIdx) => {
                      if (stroke.length === 1) {
                        return <circle key={sIdx} cx={stroke[0].x} cy={stroke[0].y} r="12" fill="#1e293b" />;
                      }
                      const d = stroke.reduce((acc, pt, pIdx) => {
                        return pIdx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
                      }, '');
                      return (
                        <path key={sIdx} d={d} fill="none" stroke="#1e293b" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
                      );
                    })}
                  </svg>
                ) : (
                  <span className="text-neutral-300 text-xs italic">Not written</span>
                )}
              </div>

              <div className="pt-1 border-t border-neutral-100 flex items-center justify-between text-[10px] text-neutral-400">
                <span>{def.category}</span>
                <span className="text-neutral-600 group-hover:underline">Edit</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Canvas modal if opened */}
      {editingChar && (
        <HandwritingCanvas
          character={editingChar}
          project={project}
          onSave={async (data: any) => {
            onUpdateCharacter(data.char, data.strokes, data.variants, data.strokeStyles, data.variantStyles);
          }}
          onClose={() => setEditingChar(null)}
          onNext={handleNextChar}
          onPrevious={handlePrevChar}
          hasPrevious={true}
          hasNext={true}
          allCharacterList={characterListSummary}
          onSelectCharacter={handleSelectChar}
          tier={tier}
          onUpgrade={onUpgrade}
        />
      )}

      <UpgradeModal
        open={!!upgrade}
        feature={upgrade?.feature ?? ""}
        description={upgrade?.description ?? ""}
        onClose={() => setUpgrade(null)}
        onUpgrade={onUpgrade}
      />
    </div>
  );
};
