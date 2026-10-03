import React from "react";
import { Check, Crown, X } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  feature: string;
  description: string;
  bullets?: string[];
  onClose: () => void;
  onUpgrade?: () => void;
}

const DEFAULT_BULLETS = [
  "Everything in Free, plus more",
  "More natural handwriting",
  "Advanced font creation",
];

/**
 * The single reusable upgrade prompt for the whole product.
 * Every locked feature (brushes, sizes, styles, variants, characters,
 * downloads) renders this — never a one-off popup.
 */
export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  open,
  feature,
  description,
  bullets,
  onClose,
  onUpgrade,
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Upgrade for ${feature}`}
    >
      <div
        className="relative w-full max-w-sm rounded-t-3xl border border-neutral-200 bg-white p-6 shadow-2xl sm:rounded-3xl"
        style={{ marginBottom: "max(0px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <Crown className="h-5 w-5 text-amber-700" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-xl font-bold text-neutral-900">{feature}</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Pro
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">{description}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {(bullets ?? DEFAULT_BULLETS).slice(0, 3).map((b) => (
            <li key={b} className="flex items-center gap-2 text-xs font-medium text-neutral-700">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-2.5 w-2.5 text-emerald-700" strokeWidth={3} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <div>
            <span className="block font-serif text-sm font-bold text-neutral-900">TypeMe Pro</span>
            <span className="font-mono text-[11px] text-neutral-500">Cancel anytime</span>
          </div>
          <span className="font-serif text-xl font-bold text-neutral-900">
            ₹99 <span className="font-sans text-xs font-normal text-neutral-500">/mo</span>
          </span>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onUpgrade?.();
            }}
            className="flex-1 cursor-pointer rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Upgrade to Pro
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Maybe Later
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
