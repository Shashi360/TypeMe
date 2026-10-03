import React, { useState } from 'react';
import { PenTool, ArrowRight } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, description: string) => void;
  /** Shown only when server-side creation failed; input is preserved. */
  serverError?: string | null;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
  serverError,
}) => {
  const [fontName, setFontName] = useState('My Handwriting');
  const [description, setDescription] = useState('My personal everyday handwriting typeface.');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fontName.trim()) return;
    onCreateProject(fontName.trim(), description.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-7 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 transition-colors p-1"
        >
          ✕
        </button>

        <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-900 mb-4">
          <PenTool className="w-5 h-5 text-neutral-800" />
        </div>

        <h3 className="text-xl font-bold text-neutral-900 font-serif">
          Let's create your font.
        </h3>
        <p className="text-xs text-neutral-600 mt-1 mb-6">
          Give your typeface a name. You can customize glyph metrics and add natural alternates at any time.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              What should we call your font?
            </label>
            <input
              type="text"
              placeholder="e.g. Shashi Handwriting or Elena Script"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              required
              maxLength={32}
              className="w-full px-3.5 py-2.5 text-sm text-neutral-900 rounded-lg border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Font description <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Notes on stroke style, pen type, or intended use..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-xs text-neutral-900 rounded-lg border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all"
            />
          </div>

          <div className="pt-2">
            {serverError ? (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 mb-3">
                Couldn&apos;t save to your account — your input is kept. Check
                your connection and try again.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!fontName.trim()}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Start Writing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
