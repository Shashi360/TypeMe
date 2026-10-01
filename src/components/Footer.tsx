import React from 'react';
import { AppView } from '../types';
import { ArrowRight, PenTool } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: AppView, anchorId?: string) => void;
  onStartWriting: () => void;
  onOpenLearn: () => void;
  onOpenQuiz: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onStartWriting,
  onOpenLearn,
  onOpenQuiz,
}) => {
  return (
    <footer className="border-t border-neutral-200 bg-white py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-neutral-100">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                <span className="font-handwriting text-xl text-amber-200 font-bold">M</span>
              </div>
              <div className="flex items-baseline">
                <span className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Type</span>
                <span className="text-2xl font-bold font-handwriting italic text-neutral-900 -ml-0.5">Me</span>
              </div>
            </div>
            <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
              Your handwriting. Your font. Your story. TypeMe transforms authentic pen strokes into real, downloadable OpenType and TrueType digital fonts.
            </p>
          </div>

          {/* Interactive Footer CTAs */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-medium text-neutral-600">
            <button
              onClick={() => onNavigate('landing', 'how-it-works')}
              className="hover:text-neutral-900 transition-colors cursor-pointer text-left"
            >
              How It Works
            </button>
            <button
              onClick={() => onNavigate('landing', 'where-to-use')}
              className="hover:text-neutral-900 transition-colors cursor-pointer text-left"
            >
              Everyday Mediums
            </button>
            <button
              onClick={() => onNavigate('landing', 'personality')}
              className="hover:text-neutral-900 transition-colors cursor-pointer text-left"
            >
              Personality
            </button>
            <button
              onClick={() => onNavigate('explore')}
              className="hover:text-neutral-900 transition-colors cursor-pointer text-left"
            >
              Explore Styles
            </button>
            <button
              onClick={onOpenQuiz}
              className="hover:text-neutral-900 transition-colors cursor-pointer text-left"
            >
              Style Quiz
            </button>
            <button
              onClick={onOpenLearn}
              className="hover:text-neutral-900 transition-colors cursor-pointer text-left"
            >
              Typography Guide
            </button>
            <button
              onClick={() => onNavigate('pricing')}
              className="hover:text-neutral-900 transition-colors cursor-pointer text-left"
            >
              Pricing
            </button>
            <button
              onClick={onStartWriting}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
            >
              <span>Create My Font</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <p>© {new Date().getFullYear()} TypeMe Typography Studio. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-neutral-700 cursor-pointer">Privacy Policy</span>
            <span>·</span>
            <span className="hover:text-neutral-700 cursor-pointer">Terms of Service</span>
            <span>·</span>
            <span className="hover:text-neutral-700 cursor-pointer">Commercial Font Licensing</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
