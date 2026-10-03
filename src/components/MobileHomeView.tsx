import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Crown,
  PenTool,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import {
  dismissPrompt,
  isInstallAvailable,
  isPromptDismissed,
  isStandalone,
  onInstallAvailabilityChange,
  openTypeMeExperience,
  promptInstall,
} from "../utils/appHandoff";

interface MobileHomeViewProps {
  onCreate: () => void;
  onExplore: () => void;
  onSeePricing: () => void;
}

const STEPS = [
  { icon: PenTool, title: "Write", text: "Write naturally on the canvas." },
  { icon: Sparkles, title: "Create", text: "We build your font." },
  { icon: Type, title: "Type", text: "Use it anywhere." },
];

const FEATURES = [
  { title: "Write naturally", text: "A smooth canvas that feels like paper." },
  { title: "Make it yours", text: "Brushes, sizes and alternate styles." },
  { title: "Type anywhere", text: "Preview instantly, download your font." },
];

const FAQS = [
  {
    q: "Is TypeMe free?",
    a: "Yes — Free includes 20 starter characters (A–T) with autosave. Pro (₹99/month) unlocks the full 82+ glyph set, variants and downloads.",
  },
  {
    q: "How does my handwriting become a font?",
    a: "Write your letters, and TypeMe turns your strokes into real vector glyphs, then compiles them into TTF and OTF files.",
  },
  {
    q: "Will I lose my work if I refresh?",
    a: "No. Every stroke is autosaved as you write, so a refresh restores exactly where you left off.",
  },
  {
    q: "Do I need to install anything?",
    a: "No — TypeMe works right here on the web, on phone, tablet and desktop.",
  },
  {
    q: "What can I do with my font?",
    a: "Install it on your devices and type in your own handwriting across apps and documents.",
  },
];

/** Handwriting → font transformation visual (lightweight CSS loop). */
const TransformVisual: React.FC = () => {
  const [typed, setTyped] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setTyped((v) => !v), 4200);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#E8E8E3] bg-[#FFFDF7] p-6 text-center shadow-sm">
      <div className="relative mx-auto flex h-28 items-center justify-center">
        <span
          aria-hidden={!typed}
          className={`font-handwriting text-6xl text-neutral-900 transition-all duration-700 ${
            typed ? "scale-90 opacity-0" : "scale-100 opacity-100"
          }`}
        >
          Hello
        </span>
        <span
          aria-hidden={typed}
          className={`absolute font-serif text-5xl italic text-neutral-900 transition-all duration-700 ${
            typed ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          Hello
        </span>
      </div>
      <svg viewBox="0 0 200 14" className="mx-auto -mt-1 h-3 w-40" aria-hidden="true">
        <path
          d="M4 10 C 60 2, 140 2, 196 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="tm-mhome-draw text-amber-500"
        />
      </svg>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-400">
        {typed ? "Your font" : "Your handwriting"}
      </p>
    </div>
  );
};

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  onCreate,
  onExplore,
  onSeePricing,
}) => {
  const [installable, setInstallable] = useState(isInstallAvailable());
  const [promptOpen, setPromptOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => onInstallAvailabilityChange(() => setInstallable(isInstallAvailable())), []);

  const handleCreate = async () => {
    if (!isStandalone() && installable && !isPromptDismissed()) {
      setPromptOpen(true);
      return;
    }
    await openTypeMeExperience({ onContinueWeb: onCreate });
  };

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setPromptOpen(false);
    }
  };

  const handleContinueWeb = async () => {
    dismissPrompt();
    setPromptOpen(false);
    await openTypeMeExperience({ onContinueWeb: onCreate });
  };

  return (
    <div className="bg-[#FAFAF7] text-neutral-900">
      {/* Hero */}
      <section className="px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E8E3] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500 shadow-sm">
            <Sparkles className="h-3 w-3 text-amber-500" />
            Turn handwriting into a font
          </span>
          <h1 className="mt-3 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Your handwriting.
            <br />
            Now in every word.
          </h1>
          <p className="mt-2 text-sm text-neutral-600">Write it once. Type it anywhere.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-800"
            >
              Create My Font <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#E8E8E3] bg-white px-6 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-300"
            >
              See it in action
            </button>
          </div>
        </div>
        <div className="mx-auto mt-5 max-w-xl md:grid md:grid-cols-5 md:gap-4">
          <div className="md:col-span-5">
            <TransformVisual />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="px-4 py-2 sm:px-6">
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="relative flex flex-col items-center gap-1 rounded-2xl border border-[#E8E8E3] bg-white px-2 py-3 text-center shadow-sm"
            >
              <s.icon className="h-5 w-5 text-neutral-900" />
              <span className="text-xs font-bold">{s.title}</span>
              <span className="text-[10px] leading-snug text-neutral-500">{s.text}</span>
              {i < STEPS.length - 1 ? (
                <ArrowRight className="absolute -right-2 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-neutral-300" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-4 sm:px-6">
        <div className="mx-auto grid max-w-xl gap-2 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[#E8E8E3] bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Check className="h-3.5 w-3.5 text-emerald-600" /> {f.title}
              </div>
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-2 sm:px-6">
        <div className="mx-auto grid max-w-xl gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#E8E8E3] bg-white p-4 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Free</span>
            <div className="font-serif text-3xl font-bold">₹0</div>
            <p className="mt-1 text-[11px] text-neutral-500">Try TypeMe with 20 starter characters.</p>
            <button
              type="button"
              onClick={handleCreate}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-neutral-100 px-4 text-xs font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
            >
              Start Free
            </button>
          </div>
          <div className="rounded-2xl border-2 border-neutral-900 bg-white p-4 shadow-sm">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
              <Crown className="h-3 w-3" /> Pro
            </span>
            <div className="font-serif text-3xl font-bold">
              ₹99 <span className="font-sans text-xs font-normal text-neutral-500">/mo</span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">Your complete font, variants & downloads.</p>
            <button
              type="button"
              onClick={onSeePricing}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-neutral-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Go Pro
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-[#E8E8E3] bg-white shadow-sm">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={f.q} className={i > 0 ? "border-t border-[#F0F0EC]" : undefined}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="flex min-h-[48px] w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold"
                >
                  {f.q}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open ? <p className="px-4 pb-3 text-[11px] leading-relaxed text-neutral-600">{f.a}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA + footer */}
      <section className="px-4 pb-8 pt-2 sm:px-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-neutral-900 p-6 text-center text-white shadow-sm">
          <p className="font-serif text-2xl font-bold">“I made a font out of me.”</p>
          <button
            type="button"
            onClick={handleCreate}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-100"
          >
            Create My Font <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-[11px] text-neutral-400">
          © {new Date().getFullYear()} TypeMe · Your handwriting. Your font.
        </p>
      </section>

      {/* Install prompt (only when a real install is available; web always works) */}
      {promptOpen && installable ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-900/40 p-4 sm:items-center" onClick={() => setPromptOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Get the TypeMe app"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900">
                  <span className="font-handwriting text-lg font-bold italic text-amber-200">M</span>
                </span>
                <div>
                  <p className="text-sm font-bold text-neutral-900">Get the TypeMe App</p>
                  <p className="text-[11px] text-neutral-500">A smoother handwriting experience on your device.</p>
                </div>
              </div>
              <button type="button" aria-label="Dismiss" onClick={() => setPromptOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#E8E8E3] bg-[#FAFAF7] p-3">
              <div className="flex h-20 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white shadow-sm">
                <span className="font-handwriting text-2xl font-bold text-neutral-900">A</span>
                <span className="text-[8px] text-neutral-400">Type your way</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {["Full screen writing canvas", "Faster experience", "Works offline", "All Pro features"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-700">
                    <Check className="h-3 w-3 shrink-0 text-emerald-600" strokeWidth={3} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white"
            >
              Install App
            </button>
            <button
              type="button"
              onClick={handleContinueWeb}
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
            >
              Continue on Web
            </button>
            <button
              type="button"
              onClick={() => setPromptOpen(false)}
              className="mt-1 inline-flex min-h-[40px] w-full items-center justify-center text-xs font-medium text-blue-600"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
