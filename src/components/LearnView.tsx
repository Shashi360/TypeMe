import React, { useState } from 'react';
import { TYPOGRAPHY_GUIDES, TypographyGuide } from '../utils/sampleData';
import { BookOpen, PenTool, ArrowRight, ArrowLeft, Type, Layers, Check } from 'lucide-react';

interface LearnViewProps {
  onBackToHome: () => void;
  onStartWriting: () => void;
}

export const LearnView: React.FC<LearnViewProps> = ({ onBackToHome, onStartWriting }) => {
  const [selectedGuide, setSelectedGuide] = useState<TypographyGuide | null>(null);

  // Glossary terms
  const glossaryTerms = [
    { term: 'Typeface', def: 'The visual design of a collection of letterforms (e.g., Helvetica or your personal handwriting).' },
    { term: 'Font', def: 'The actual software delivery binary (e.g. .ttf or .otf file) containing vector coordinates and metric tables.' },
    { term: 'Glyph', def: 'An individual visual drawing of a character (such as lowercase ‘a’ or alternate ‘a₁’).' },
    { term: 'Baseline', def: 'The invisible horizontal line upon which most characters sit and rest.' },
    { term: 'Ascender', def: 'The upward vertical stroke in letters like b, d, h, and k that extends above the x-height.' },
    { term: 'Descender', def: 'The portion of letters like g, p, q, and y that extends below the baseline.' },
    { term: 'Kerning', def: 'The proportional adjustment of white space between two adjacent characters.' },
    { term: 'Alternates', def: 'Secondary glyph variants for the same character that add natural organic handwriting variety.' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="space-y-1">
          <button
            onClick={onBackToHome}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 font-serif tracking-tight">
            TypeMe Learn
          </h1>
          <p className="text-sm text-neutral-600">
            Demystifying typography, letterform craft, and the art of handwriting fonts.
          </p>
        </div>

        <button
          onClick={onStartWriting}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <span>Create Your Font</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. What exactly is a font? Interactive showcase */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 sm:p-10 shadow-sm space-y-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Interactive Anatomy
          </span>
          <h2 className="text-2xl font-bold text-neutral-900 font-serif mt-1">
            What exactly is a font?
          </h2>
          <p className="text-xs text-neutral-600 max-w-2xl mt-1 leading-relaxed">
            A font is a collection of letters, numbers, and symbols engineered to display consistently. Watch how the same word transforms depending on its typographic style:
          </p>
        </div>

        {/* Word Transformation Comparison */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 py-2">
          {[
            { word: 'HELLO', style: 'Serif Classic', font: 'font-serif' },
            { word: 'HELLO', style: 'Sans Geometric', font: 'font-sans font-bold' },
            { word: 'Hello', style: 'Cursive Script', font: 'font-handwriting text-3xl' },
            { word: 'Hello', style: 'Fountain Pen', font: 'font-pen text-3xl' },
            { word: 'hello', style: 'Monospace Code', font: 'font-mono' },
            { word: 'Hello', style: 'Your Handwriting', font: 'font-handwriting text-3xl italic' },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 text-center">
              <span className="text-[10px] text-neutral-400 block mb-1">{item.style}</span>
              <div className={`${item.font} text-2xl text-neutral-900 my-1`}>
                {item.word}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Typography Glossary Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-neutral-900 font-serif">
          Essential Typography Vocabulary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {glossaryTerms.map((g, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-white border border-neutral-200 shadow-2xs">
              <span className="text-xs font-bold text-neutral-900 font-serif block mb-1">
                {g.term}
              </span>
              <p className="text-xs text-neutral-600 leading-relaxed">{g.def}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Educational Guides Library */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-neutral-900 font-serif">
          Guides & Masterclasses
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TYPOGRAPHY_GUIDES.map((guide) => (
            <div
              key={guide.id}
              onClick={() => setSelectedGuide(guide)}
              className="p-6 rounded-2xl bg-white border border-neutral-200 hover:border-neutral-900 transition-all shadow-2xs cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-2">
                  <span>{guide.category}</span>
                  <span className="font-mono">{guide.readTime}</span>
                </div>
                <h3 className="text-base font-bold text-neutral-900 font-serif group-hover:text-neutral-700 transition-colors">
                  {guide.title}
                </h3>
                <p className="text-xs text-neutral-600 mt-2 leading-relaxed line-clamp-3">
                  {guide.summary}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 font-medium">
                <span>Read article</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guide Detail Modal */}
      {selectedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 my-auto relative">
            <button
              onClick={() => setSelectedGuide(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1"
            >
              ✕
            </button>

            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              {selectedGuide.category} · {selectedGuide.readTime}
            </span>

            <h3 className="text-2xl font-bold text-neutral-900 font-serif mt-1 mb-4">
              {selectedGuide.title}
            </h3>

            <div className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {selectedGuide.content}
            </div>

            <div className="pt-6 mt-6 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedGuide(null)}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSelectedGuide(null);
                  onStartWriting();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                Apply in TypeMe Workspace →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
