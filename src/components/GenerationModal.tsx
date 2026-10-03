import React, { useEffect, useMemo, useState } from 'react';
import { FontProject } from '../types';
import { generateFontFromCharacters, GenerationProgress } from '../utils/fontGenerator';
import { getEntitlements } from '../utils/entitlements';
import confetti from 'canvas-confetti';
import { CheckCircle2, AlertCircle, Loader2, Crown, ArrowRight } from 'lucide-react';

interface GenerationModalProps {
  isOpen: boolean;
  project: FontProject;
  onClose: () => void;
  onGenerationComplete: (result: {
    otfBlobUrl: string;
    registeredFontFamily: string;
    fileSizeBytes: number;
  }) => void;
  onReview?: () => void;
  tier?: string;
  onUpgrade?: () => void;
}

const STAGE_LABELS = [
  'Character validation',
  'Glyph construction',
  'Spacing & alignment',
  'OpenType tables',
  'Font binaries',
  'Final quality check',
];

export const GenerationModal: React.FC<GenerationModalProps> = ({
  isOpen,
  project,
  onClose,
  onGenerationComplete,
  onReview,
  tier = 'free',
  onUpgrade,
}) => {
  const [progress, setProgress] = useState<GenerationProgress>({
    step: 1,
    totalSteps: 6,
    message: 'Checking characters...',
  });
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  const ent = useMemo(() => getEntitlements(tier), [tier]);

  const stats = useMemo(() => {
    const chars = Object.values(project.characters);
    const completed = chars.filter((c) => c.strokes && c.strokes.length > 0);
    const variants = chars.reduce((n, c) => n + (c.variants?.length ?? 0), 0);
    const strokes = chars.reduce((n, c) => n + (c.strokes?.length ?? 0), 0);
    const missing = chars.filter((c) => !c.strokes || c.strokes.length === 0);
    return { completed: completed.length, variants, strokes, missing };
  }, [project.characters]);

  // Pre-generation validation: nothing to compile without handwriting.
  const validationFailed = stats.completed === 0;

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setError(null);

    if (validationFailed) {
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setProgress({ step: 1, totalSteps: 6, message: 'Checking characters...' });

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
  }, [isOpen, project.name, project.characters, onGenerationComplete, validationFailed, runId]);

  if (!isOpen) return null;

  const pct = Math.round((Math.min(progress.step, progress.totalSteps) / progress.totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-7 text-center max-h-[90dvh] overflow-y-auto">
        <div className="w-12 h-12 rounded-xl bg-neutral-900 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
          {isGenerating ? (
            <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
          ) : error || validationFailed ? (
            <AlertCircle className="w-6 h-6 text-rose-400" />
          ) : (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          )}
        </div>

        <p className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
          {project.name}
        </p>
        <h3 className="text-xl font-bold text-neutral-900 font-serif mt-1">
          {validationFailed
            ? 'Nothing to generate yet'
            : isGenerating
              ? 'Creating your font...'
              : error
                ? 'Generation Failed'
                : 'Font Ready!'}
        </h3>

        <p className="text-xs text-neutral-500 mt-1 mb-5">
          {validationFailed
            ? 'Write at least one character first — your project is saved and waiting.'
            : 'Turning your handwriting into a real font.'}
        </p>

        {/* Project snapshot */}
        <div className="grid grid-cols-3 gap-2 mb-5 text-center">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2.5">
            <div className="text-base font-bold text-neutral-900 font-serif">{stats.completed}</div>
            <div className="text-[10px] text-neutral-500">Characters</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2.5">
            <div className="text-base font-bold text-neutral-900 font-serif">{stats.variants}</div>
            <div className="text-[10px] text-neutral-500">Variants</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2.5">
            <div className="text-base font-bold text-neutral-900 font-serif">{stats.strokes}</div>
            <div className="text-[10px] text-neutral-500">Strokes</div>
          </div>
        </div>

        {validationFailed ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-700 bg-amber-50 p-3 rounded-lg border border-amber-200 leading-relaxed">
              No handwriting found for this project yet. {stats.missing.length > 0
                ? `Start with ${stats.missing.slice(0, 5).map((c) => c.char).join(', ')}${stats.missing.length > 5 ? '…' : ''}.`
                : ''}
            </p>
            <div className="flex gap-2">
              {onReview ? (
                <button
                  onClick={onReview}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Review Characters <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        {!validationFailed && isGenerating && (
          <div className="space-y-4">
            {/* Real stage-based progress */}
            <div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-neutral-900 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1.5 font-medium">{progress.message}</p>
            </div>

            {/* Processing pipeline */}
            <div className="text-left rounded-xl border border-neutral-200 divide-y divide-neutral-100">
              {STAGE_LABELS.map((label, i) => {
                const n = i + 1;
                const done = n < progress.step;
                const current = n === progress.step;
                return (
                  <div key={label} className="flex items-center gap-2.5 px-3 py-2">
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : current ? (
                      <Loader2 className="w-4 h-4 text-neutral-900 animate-spin shrink-0" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-neutral-300 shrink-0" />
                    )}
                    <span
                      className={`text-xs ${done ? 'text-neutral-900 font-medium' : current ? 'text-neutral-900 font-semibold' : 'text-neutral-400'}`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-neutral-400">
              Step {progress.step} of {progress.totalSteps}
            </p>
          </div>
        )}

        {!validationFailed && error && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-700 bg-neutral-50 p-3 rounded-lg border border-neutral-200 leading-relaxed">
              Font generation couldn't be completed, but your handwriting is safe and has not been lost. {error}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setError(null);
                  setRunId((n) => n + 1);
                }}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
              >
                Try Again
              </button>
              {onReview ? (
                <button
                  onClick={onReview}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  Review Project
                </button>
              ) : null}
            </div>
          </div>
        )}

        {!validationFailed && !isGenerating && !error && !ent.isPro ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
              <Crown className="w-4 h-4 text-amber-700" />
              <span>Your font is ready to download</span>
            </div>
            <p className="text-[11px] text-neutral-600 mt-1 leading-relaxed">
              Upgrade to TypeMe Pro (₹99/month) to download your OTF font file.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onUpgrade?.()}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              >
                Upgrade to Pro
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Continue Exploring
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
