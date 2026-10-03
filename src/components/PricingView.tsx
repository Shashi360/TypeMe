import React, { useState } from 'react';
import { User } from '../types';
import { Check, ArrowRight, CheckCircle2, X, PenTool } from 'lucide-react';

interface PricingViewProps {
  user: User | null;
  onUpgradeTier: (tier: 'creator' | 'pro') => void;
  onStartFree: () => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  user,
  onUpgradeTier,
  onStartFree,
}) => {
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSimulatePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setCheckoutModalOpen(false);
      onUpgradeTier('pro');
    }, 700);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      {/* 1. Header */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-400">
          Transparent Membership
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 font-serif tracking-tight">
          Simple pricing. Zero clutter.
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600">
          Start for free to create your first font, or upgrade to TypeMe Pro for complete creative freedom and multi-font creation.
        </p>
      </div>

      {/* 2. Distinctive Two-Plan Grid (Prompt Sections 15 & 16) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto items-stretch">
        {/* FREE PLAN */}
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 flex flex-col justify-between shadow-2xs hover:border-neutral-300 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
                FREE
              </span>
              <span className="text-[11px] font-mono text-neutral-400">Standard</span>
            </div>

            <div className="my-3">
              <span className="text-4xl font-extrabold text-neutral-900 font-serif">₹0</span>
            </div>

            <p className="text-xs text-neutral-500 mb-6 font-medium">
              For getting started.
            </p>

            <div className="border-t border-neutral-100 pt-5 space-y-3 text-xs text-neutral-700">
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                <span>20 starter characters (A–T) with autosave</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                <span>Gel + Pencil brushes, Regular stroke</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                <span>Typography canvas + preview experience</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                <span>Try processing — downloads need Pro</span>
              </div>
            </div>
          </div>

          <div className="pt-8">
            <button
              onClick={onStartFree}
              className="w-full py-3 px-4 text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all cursor-pointer text-center block"
            >
              Start Free
            </button>
          </div>
        </div>

        {/* TYPEME PRO */}
        <div className="rounded-3xl border-2 border-neutral-900 bg-white p-8 flex flex-col justify-between shadow-lg relative">
          <div className="absolute -top-3 right-6 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 shadow-sm font-mono">
            <Check className="w-3 h-3 text-amber-300" />
            <span>Recommended</span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900">
                TYPEME PRO
              </span>
              <span className="text-[11px] font-mono text-emerald-600 font-medium">All Features</span>
            </div>

            <div className="my-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold text-neutral-900 font-serif">₹99</span>
              <span className="text-xs text-neutral-500 font-mono">/ month</span>
            </div>

            <p className="text-xs text-neutral-500 mb-6 font-medium">
              For making your handwriting yours.
            </p>

            <div className="border-t border-neutral-100 pt-5 space-y-3 text-xs text-neutral-700">
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold text-neutral-900">Multiple font projects</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold text-neutral-900">Full character set (82+ glyphs & symbols)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>OpenType (.OTF) font download</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Character variations (up to 3 natural alternates)</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Advanced preview studio & font editing</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Priority generation & future premium features</span>
              </div>
            </div>
          </div>

          <div className="pt-8 space-y-2 text-center">
            {user?.tier === 'pro' ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium space-y-1">
                <div className="font-bold font-mono">✓ Plan Active</div>
                <p className="text-[11px] text-emerald-700">
                  Expires in <strong>24 / 30 days</strong>. Auto-renews monthly.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setCheckoutModalOpen(true)}
                  className="w-full py-3 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Start Pro — ₹99/month</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-neutral-400 block font-mono">
                  Cancel anytime.
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Checkout Simulation Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-md w-full p-7 relative">
            <button
              onClick={() => setCheckoutModalOpen(false)}
              className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center mb-3">
              <PenTool className="w-5 h-5 text-neutral-900" />
            </div>

            <h3 className="text-xl font-bold text-neutral-900 font-serif">
              Upgrade to TypeMe Pro
            </h3>
            <p className="text-xs text-neutral-500 mt-1 mb-5">
              Unlock unlimited font projects, OpenType (.OTF) font binaries, and natural handwriting alternates.
            </p>

            <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 mb-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-900 block font-serif text-sm">
                  TypeMe Pro Monthly
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">Cancel anytime</span>
              </div>
              <span className="text-xl font-bold font-serif text-neutral-900">
                ₹99 <span className="text-xs font-normal text-neutral-500 font-sans">/mo</span>
              </span>
            </div>

            <div className="space-y-2.5 mb-6 text-xs text-neutral-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Immediate activation on your TypeMe account</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Commercial-use license included</span>
              </div>
            </div>

            <button
              onClick={handleSimulatePayment}
              disabled={isProcessing}
              className="w-full py-3 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? 'Activating Pro...' : 'Confirm & Start Pro (₹99/month)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
