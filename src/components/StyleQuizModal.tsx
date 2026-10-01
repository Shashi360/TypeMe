import React, { useState } from 'react';
import { PenTool, ArrowRight, RotateCcw, CheckCircle2 } from 'lucide-react';

interface StyleQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartFontWithStyle: (styleName: string) => void;
}

export const StyleQuizModal: React.FC<StyleQuizModalProps> = ({
  isOpen,
  onClose,
  onStartFontWithStyle,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectGoal, setProjectGoal] = useState<string>('');
  const [mood, setMood] = useState<string>('');

  if (!isOpen) return null;

  const projectOptions = [
    { id: 'wedding', label: 'Wedding Invitation', hint: 'Special, formal & timeless' },
    { id: 'journal', label: 'Personal Journal', hint: 'Intimate, daily & reflective' },
    { id: 'social', label: 'Social Media Post', hint: 'Expressive, eye-catching & punchy' },
    { id: 'brand', label: 'Brand & Packaging', hint: 'Artisanal, crafted & recognizable' },
    { id: 'planner', label: 'Digital Planner', hint: 'Clean, organized & personal' },
    { id: 'art', label: 'Art & Illustration', hint: 'Organic, experimental & free' },
    { id: 'signature', label: 'Personal Signature', hint: 'Distinguished, quick & fluid' },
    { id: 'notes', label: 'School / Work Notes', hint: 'Readable, rapid & functional' },
  ];

  const moodOptions = [
    { id: 'elegant', label: 'Elegant & Graceful', desc: 'Slanted cursive, delicate looped descenders' },
    { id: 'friendly', label: 'Friendly & Warm', desc: 'Rounded open counters, approachable rhythm' },
    { id: 'playful', label: 'Playful & Bouncy', desc: 'Dynamic baseline bounces, cheerful energy' },
    { id: 'minimal', label: 'Minimal & Structured', desc: 'Even geometric monoline strokes' },
    { id: 'casual', label: 'Casual & Everyday', desc: 'Quick natural handwriting with authentic slant' },
    { id: 'artistic', label: 'Artistic & Expressive', desc: 'Dipped-pen ink flare, varied line weight' },
  ];

  const getRecommendation = () => {
    if (mood === 'elegant' || projectGoal === 'wedding') {
      return {
        name: 'Calligraphic Flourish',
        tagline: 'Delicate cursive with sweeping ascenders',
        sample: 'Together forever, across seasons and sunsets.',
        fontClass: 'font-handwriting',
        tips: 'Keep strokes light and write at a gentle 15-degree forward slant.',
      };
    }
    if (mood === 'minimal' || projectGoal === 'planner') {
      return {
        name: 'Architectural Monoline',
        tagline: 'Precise geometric drafting script',
        sample: 'Daily goals: Focus on essentials. Build steadily.',
        fontClass: 'font-pen',
        tips: 'Maintain consistent capital height and square off finishing terminals.',
      };
    }
    if (mood === 'playful' || projectGoal === 'art') {
      return {
        name: 'Playful Marker Bounce',
        tagline: 'Warm rounded curves with spontaneous baseline bounce',
        sample: 'Make today wonderfully memorable & fun!',
        fontClass: 'font-handwriting',
        tips: 'Let your letters bounce slightly above and below the baseline.',
      };
    }
    return {
      name: 'Everyday Casual Ink',
      tagline: 'Authentic pen-on-paper rhythm with personal warmth',
      sample: 'Written by hand. Preserved digitally for life.',
      fontClass: 'font-pen',
      tips: 'Write quickly without overthinking symmetry. Imperfection is charm.',
    };
  };

  const recommendation = getRecommendation();

  const handleReset = () => {
    setStep(1);
    setProjectGoal('');
    setMood('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 my-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1"
        >
          ✕
        </button>

        {/* Step 1: What are you creating? */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Step 1 of 2 · Creative Style Matcher
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 font-serif">
                What are you creating?
              </h3>
              <p className="text-xs text-neutral-500">
                Choose the primary home for your upcoming handwriting font.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {projectOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setProjectGoal(opt.id);
                    setStep(2);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    projectGoal === opt.id
                      ? 'border-neutral-900 bg-neutral-50 shadow-2xs'
                      : 'border-neutral-200 hover:border-neutral-400 bg-white'
                  }`}
                >
                  <span className="text-xs font-bold text-neutral-900 block">{opt.label}</span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: What feeling do you want? */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Step 2 of 2 · Emotional Tone
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 font-serif">
                What feeling should your font evoke?
              </h3>
              <p className="text-xs text-neutral-500">
                Typography communicates emotion before words are even read.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {moodOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setMood(opt.id);
                    setStep(3);
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    mood === opt.id
                      ? 'border-neutral-900 bg-neutral-50 shadow-2xs'
                      : 'border-neutral-200 hover:border-neutral-400 bg-white'
                  }`}
                >
                  <span className="text-xs font-bold text-neutral-900 block">{opt.label}</span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-neutral-500 hover:text-neutral-900"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result & Inspiration Card */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                <PenTool className="w-3.5 h-3.5 text-emerald-600" />
                <span>Your Style Inspiration Match</span>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-neutral-400 hover:text-neutral-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restart</span>
              </button>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-neutral-900 font-serif">
                {recommendation.name}
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">{recommendation.tagline}</p>
            </div>

            {/* Specimen Box */}
            <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-200 text-center notebook-ruled-pattern">
              <p className={`${recommendation.fontClass} text-3xl sm:text-4xl text-neutral-900 my-2 leading-relaxed`}>
                "{recommendation.sample}"
              </p>
              <span className="text-[11px] font-mono text-neutral-400 block mt-2">
                Ideal for: {projectGoal || 'Personal typography'}
              </span>
            </div>

            {/* Writing Guidance */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs text-amber-900">
              <span className="font-semibold block mb-0.5">Penmanship Tip:</span>
              <span>{recommendation.tips}</span>
            </div>

            <p className="text-[11px] text-neutral-400 italic">
              Note: This is creative style discovery to spark ideas. TypeMe digitizes your genuine personal handwriting.
            </p>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-xs text-neutral-500 hover:text-neutral-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  onStartFontWithStyle(recommendation.name);
                }}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>Create a Font Like This</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
