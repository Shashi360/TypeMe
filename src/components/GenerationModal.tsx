import React, { useEffect, useState } from 'react';
import { FontProject } from '../types';
import { generateFontFromCharacters, GenerationProgress } from '../utils/fontGenerator';
import confetti from 'canvas-confetti';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface GenerationModalProps {
  isOpen: boolean;
  project: FontProject;
  onClose: () => void;
  onGenerationComplete: (result: {
    ttfBlobUrl: string;
    otfBlobUrl: string;
    registeredFontFamily: string;
    fileSizeBytes: number;
  }) => void;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({
  isOpen,
  project,
  onClose,
  onGenerationComplete,
}) => {
  const [progress, setProgress] = useState<GenerationProgress>({
    step: 1,
    totalSteps: 6,
    message: 'Checking characters...',
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsGenerating(true);
    setError(null);

    const runGeneration = async () => {
      try {
        const result = await generateFontFromCharacters(
          project.name,
          project.characters,
          (p) => {
            if (mounted) setProgress(p);
          }
        );

        if (mounted) {
          setIsGenerating(false);
          // Trigger celebratory confetti
          try {
            confetti({
              particleCount: 65,
              spread: 60,
              origin: { y: 0.65 },
              colors: ['#0f172a', '#f59e0b', '#10b981', '#6366f1'],
            });
          } catch (e) {
            // ignore if blocked
          }

          setTimeout(() => {
            onGenerationComplete({
              ttfBlobUrl: result.ttfUrl,
              otfBlobUrl: result.otfUrl,
              registeredFontFamily: result.registeredFontFamily,
              fileSizeBytes: result.fileSizeBytes,
            });
          }, 600);
        }
      } catch (err: any) {
        if (mounted) {
          setIsGenerating(false);
          setError(err?.message || 'Could not compile font glyphs. Please check character strokes.');
        }
      }
    };

    runGeneration();

    return () => {
      mounted = false;
    };
  }, [isOpen, project.name, project.characters, onGenerationComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-7 text-center">
        <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
          {isGenerating ? (
            <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
          ) : error ? (
            <AlertCircle className="w-6 h-6 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          )}
        </div>

        <h3 className="text-xl font-bold text-neutral-900 font-serif">
          {isGenerating ? 'Compiling Your Font...' : error ? 'Generation Failed' : 'Font Ready!'}
        </h3>

        <p className="text-xs text-neutral-500 mt-1 mb-6">
          Building production-grade TrueType & OpenType binaries from your raw vector strokes.
        </p>

        {isGenerating && (
          <div className="space-y-4">
            {/* Step message */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700 font-medium">
              {progress.message}
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5, 6].map((stepNum) => (
                <div
                  key={stepNum}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    stepNum <= progress.step
                      ? 'bg-neutral-900 scale-110'
                      : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>

            <p className="text-[11px] text-neutral-400">
              Step {progress.step} of {progress.totalSteps}
            </p>
          </div>
        )}

        {error && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-700 bg-neutral-50 p-3 rounded-lg border border-neutral-200 leading-relaxed">
              Your handwriting is safe. We couldn't finish the font this time. {error}
            </p>
            <button
              onClick={() => {
                setError(null);
                setIsGenerating(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
