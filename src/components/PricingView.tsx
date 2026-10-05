import React, { useState } from 'react';
import { User } from '../types';
import { Check, ArrowRight, CheckCircle2, X, PenTool } from 'lucide-react';
import {
  PayState,
  VerifiedEntitlement,
  PaymentError,
  createProOrder,
  verifyProPayment,
  loadRazorpayScript,
  openRazorpayCheckout,
  isDevMockPayEnabled,
} from '../utils/payments';
import { formatPlanDate } from '../utils/subscription';

interface PricingViewProps {
  user: User | null;
  onUpgradeTier: (tier: 'creator' | 'pro') => void;
  onStartFree: () => void;
  onOpenAuth: () => void;
  /** Called after backend-verified activation so the app refreshes entitlement. */
  onProActivated: () => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  user,
  onUpgradeTier,
  onStartFree,
  onOpenAuth,
  onProActivated,
}) => {
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [payState, setPayState] = useState<PayState>('IDLE');
  const [payError, setPayError] = useState<string | null>(null);
  const [activated, setActivated] = useState<VerifiedEntitlement | null>(null);

  const busy = payState === 'CREATING_ORDER' || payState === 'CHECKOUT_OPEN' || payState === 'VERIFYING';

  const openCheckout = () => {
    setPayError(null);
    setActivated(null);
    setPayState('IDLE');
    setCheckoutModalOpen(true);
  };

  const payButtonLabel = (): string => {
    switch (payState) {
      case 'CREATING_ORDER':
        return 'Creating secure order...';
      case 'CHECKOUT_OPEN':
        return 'Waiting for payment...';
      case 'VERIFYING':
        return 'Verifying payment...';
      case 'SUCCESS':
        return 'Pro Activated';
      default:
        return 'Confirm & Start Pro (₹99/month)';
    }
  };

  const handlePay = async () => {
    // Login gate first: no account, no payment.
    if (!user) {
      setCheckoutModalOpen(false);
      onOpenAuth();
      return;
    }
    // Explicit dev-only mock (UI testing pre-deploy). Never in production.
    if (isDevMockPayEnabled()) {
      onUpgradeTier('pro');
      setCheckoutModalOpen(false);
      return;
    }
    const accountId = user.accountId;
    if (!accountId) {
      setPayState('FAILED');
      setPayError('Account not ready. Please log in again.');
      return;
    }
    setPayError(null);
    setPayState('CREATING_ORDER');
    try {
      const order = await createProOrder(accountId);
      await loadRazorpayScript();
      if (!user) throw new PaymentError('NO_SESSION', 'Please log in to continue.', false);
      setPayState('CHECKOUT_OPEN');
      openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        phone: user.phone,
        accountId,
        onSuccess: (r) => {
          void (async () => {
            setPayState('VERIFYING');
            try {
              const ent = await verifyProPayment({
                accountId,
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
                phone_e164: user.phone,
              });
              // Only a backend-confirmed active Pro counts — anything else
              // stays an error, never a silent unlock.
              if (ent.plan !== 'pro' || ent.status !== 'active') {
                throw new PaymentError('NOT_ACTIVATED', 'Payment was not completed. Your TypeMe account is still on Free.');
              }
              setActivated(ent);
              setPayState('SUCCESS');
              onProActivated();
            } catch (e) {
              setPayState('FAILED');
              setPayError(e instanceof PaymentError ? e.message : 'Verification failed. Your TypeMe account is still on Free.');
            }
          })();
        },
        onDismiss: () => {
          setPayState('CANCELLED');
          setPayError('Payment was not completed. Your TypeMe account is still on Free.');
        },
        onFailure: (message) => {
          setPayState('FAILED');
          setPayError(message);
        },
      });
    } catch (e) {
      setPayState('FAILED');
      setPayError(e instanceof PaymentError ? e.message : 'Payment service could not be loaded. Please try again.');
    }
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
                  onClick={openCheckout}
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

            {payState === 'SUCCESS' && activated ? (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 mb-5 text-center space-y-1">
                <div className="text-sm font-bold text-emerald-900 font-serif">
                  Payment successful — TypeMe Pro is now active.
                </div>
                <p className="text-xs text-emerald-800">
                  30 days of Pro access unlocked.
                  {activated.expiresAt ? (
                    <> Expires: <strong>{formatPlanDate(Date.parse(activated.expiresAt))}</strong>.</>
                  ) : null}
                </p>
              </div>
            ) : null}

            {payError && payState !== 'SUCCESS' ? (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 mb-4 text-center">
                {payError}
              </p>
            ) : null}

            {payState === 'SUCCESS' ? (
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Done
              </button>
            ) : (
              <button
                onClick={handlePay}
                disabled={busy}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {payState !== 'IDLE' && payState !== 'FAILED' && payState !== 'CANCELLED' ? payButtonLabel() : user
                  ? 'Confirm & Start Pro (₹99/month)'
                  : 'Log in to continue'}
              </button>
            )}
            {payState === 'FAILED' || payState === 'CANCELLED' ? (
              <button
                onClick={() => {
                  setPayError(null);
                  setPayState('IDLE');
                }}
                className="w-full mt-2 py-2.5 px-4 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
              >
                Try again
              </button>
            ) : null}
            {!user ? (
              <p className="text-[11px] text-neutral-500 font-mono mt-2">
                Pro checkout needs a TypeMe account — no payment is taken
                before you log in.
              </p>
            ) : null}
            {isDevMockPayEnabled() && user && payState === 'IDLE' ? (
              <p className="text-[11px] text-amber-700 font-mono mt-2">
                Test mode — mock checkout, no real charge.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
