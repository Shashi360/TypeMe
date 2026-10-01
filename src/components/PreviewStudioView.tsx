import React, { useState, useEffect } from 'react';
import { FontProject } from '../types';
import { compileLivePreviewFont } from '../utils/fontGenerator';
import {
  ArrowLeft,
  PenTool,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  Type,
  FileText,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface PreviewStudioViewProps {
  project: FontProject;
  onBackToWorkspace: () => void;
  onGenerateFont: () => void;
}

export const PreviewStudioView: React.FC<PreviewStudioViewProps> = ({
  project,
  onBackToWorkspace,
  onGenerateFont,
}) => {
  const [text, setText] = useState<string>(
    'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.'
  );
  const [fontSize, setFontSize] = useState<number>(36);
  const [letterSpacing, setLetterSpacing] = useState<number>(2);
  const [lineHeight, setLineHeight] = useState<number>(1.6);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('left');
  const [paperStyle, setPaperStyle] = useState<'ruled' | 'grid' | 'blank'>('ruled');

  // Live compiled font name for instant rendering of drawn letters
  const [liveFontFamily, setLiveFontFamily] = useState<string | null>(null);
  const [isCompilingLiveFont, setIsCompilingLiveFont] = useState(false);

  // Compile active font on mount and whenever characters change
  useEffect(() => {
    let isCancelled = false;
    async function loadFont() {
      setIsCompilingLiveFont(true);
      const registeredName = await compileLivePreviewFont(project.name, project.characters);
      if (!isCancelled && registeredName) {
        setLiveFontFamily(registeredName);
      }
      if (!isCancelled) {
        setIsCompilingLiveFont(false);
      }
    }
    loadFont();
    return () => {
      isCancelled = true;
    };
  }, [project.name, project.characters]);

  // Identify drawn characters
  const drawnChars = Object.values(project.characters).filter(
    (c) => c.strokes && c.strokes.length > 0
  );

  const presetPangrams = [
    { label: 'Classic Pangram', text: 'The quick brown fox jumps over the lazy dog.' },
    {
      label: 'Alphabet & Digits',
      text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 !?@#',
    },
    {
      label: 'Journal Note',
      text: 'October 1st, 2026.\nMorning coffee and creative lettering. Hand-drawn letters look wonderfully alive on paper.',
    },
    { label: 'Short & Punchy', text: 'How vexingly quick daft zebras jump!' },
  ];

  // Font family cascading: live compiled font -> generated font -> Caveat cursive
  const effectiveFont = liveFontFamily
    ? `"${liveFontFamily}", "${project.fontFamilyName || ''}", "Caveat", cursive`
    : project.fontFamilyName
    ? `"${project.fontFamilyName}", "Caveat", cursive`
    : '"Caveat", cursive';

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
            Meet your handwriting.
          </h1>
          <p className="text-xs text-neutral-500">
            Interactive typography studio. Test sentences, adjust scale, and type with your saved letters.
          </p>
        </div>

        <button
          onClick={onGenerateFont}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <span>Generate Final Font</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Saved Characters Status & Roster */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono uppercase text-neutral-900">
              Your Drawn Glyphs:
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
              {drawnChars.length} characters ready
            </span>
            {isCompilingLiveFont && (
              <span className="text-[11px] font-mono text-neutral-400 animate-pulse">
                Updating font...
              </span>
            )}
          </div>
          <span className="text-[11px] text-neutral-400">
            Click any letter to append to the testing area below
          </span>
        </div>

        {drawnChars.length > 0 ? (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {drawnChars.map((item) => (
              <button
                key={item.char}
                onClick={() => setText((prev) => prev + item.char)}
                className="min-w-[32px] h-8 px-2 rounded-lg bg-neutral-100 hover:bg-neutral-900 hover:text-white text-xs font-mono font-bold text-neutral-800 transition-colors flex items-center justify-center cursor-pointer"
                title={`Add '${item.char}' to test`}
              >
                {item.char}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400 italic">
            No characters drawn yet in workspace. Draw characters to test them in your authentic handwriting!
          </p>
        )}
      </div>

      {/* 3. Controls Ribbon */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 mr-1 font-mono">Presets:</span>
            {presetPangrams.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setText(p.text)}
                className="px-2.5 py-1 text-xs rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Paper Background Style */}
          <div className="flex items-center gap-1 text-xs text-neutral-600">
            <span className="text-neutral-500 mr-1 font-mono">Paper:</span>
            <button
              onClick={() => setPaperStyle('ruled')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                paperStyle === 'ruled'
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'bg-neutral-100 hover:bg-neutral-200'
              }`}
            >
              Ruled
            </button>
            <button
              onClick={() => setPaperStyle('grid')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                paperStyle === 'grid'
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'bg-neutral-100 hover:bg-neutral-200'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setPaperStyle('blank')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                paperStyle === 'blank'
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'bg-neutral-100 hover:bg-neutral-200'
              }`}
            >
              Plain
            </button>
          </div>
        </div>

        {/* Sliders and Alignment */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-neutral-100 text-xs">
          {/* Size */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-mono">Size:</span>
            <span className="font-mono text-neutral-900 w-8">{fontSize}px</span>
            <input
              type="range"
              min={18}
              max={80}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-28 accent-neutral-900 cursor-pointer"
            />
          </div>

          {/* Spacing */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-mono">Spacing:</span>
            <span className="font-mono text-neutral-900 w-8">{letterSpacing}px</span>
            <input
              type="range"
              min={-2}
              max={12}
              value={letterSpacing}
              onChange={(e) => setLetterSpacing(Number(e.target.value))}
              className="w-24 accent-neutral-900 cursor-pointer"
            />
          </div>

          {/* Line Height */}
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 font-mono">Line Height:</span>
            <span className="font-mono text-neutral-900 w-8">{lineHeight.toFixed(1)}</span>
            <input
              type="range"
              min={1.1}
              max={2.4}
              step={0.1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-24 accent-neutral-900 cursor-pointer"
            />
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg">
            <button
              onClick={() => setAlignment('left')}
              className={`p-1.5 rounded-md cursor-pointer ${
                alignment === 'left' ? 'bg-white shadow-2xs text-neutral-900 font-semibold' : 'text-neutral-500'
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setAlignment('center')}
              className={`p-1.5 rounded-md cursor-pointer ${
                alignment === 'center' ? 'bg-white shadow-2xs text-neutral-900 font-semibold' : 'text-neutral-500'
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setAlignment('right')}
              className={`p-1.5 rounded-md cursor-pointer ${
                alignment === 'right' ? 'bg-white shadow-2xs text-neutral-900 font-semibold' : 'text-neutral-500'
              }`}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Paper Canvas Preview Stage */}
      <div
        className={`rounded-3xl border border-neutral-200 min-h-[380px] p-6 sm:p-8 shadow-sm transition-all overflow-hidden ${
          paperStyle === 'ruled'
            ? 'bg-white notebook-ruled-pattern'
            : paperStyle === 'grid'
            ? 'bg-white graph-paper-pattern'
            : 'bg-white'
        }`}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start typing your handwriting here..."
          className="w-full h-full min-h-[320px] bg-transparent text-neutral-900 border-none outline-none resize-none"
          style={{
            fontFamily: effectiveFont,
            fontSize: `${fontSize}px`,
            letterSpacing: `${letterSpacing}px`,
            lineHeight: lineHeight,
            textAlign: alignment,
          }}
        />
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-400 font-mono">
        <span>Font source: {project.name}</span>
        <span>Click the canvas above to edit or type custom sentences directly</span>
      </div>
    </div>
  );
};
