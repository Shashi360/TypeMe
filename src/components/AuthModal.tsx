import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, ArrowRight, CheckCircle2, ChevronDown, X } from 'lucide-react';
import { normalizeIndianPhone, maskPhone } from '../utils/phone';
import { OTP_POLICY } from '../utils/otpConfig';
import { getOtpProvider, isDemoAuthEnabled, isTestBridgeRoute, isLocalSimulated } from '../utils/otpProvider';
import { getSupabase } from '../utils/supabaseClient';
import { stableAccountIdFor } from '../utils/identity';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, isNewUser: boolean) => void;
}



export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'phone' | 'otp' | 'post_login' | 'onboarding_story'>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('7760593180');
  const [otp, setOtp] = useState<string[]>(Array(OTP_POLICY.length).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  // Post login goal selection
  const [creationGoal, setCreationGoal] = useState('My handwriting font');
  const [ccOpen, setCcOpen] = useState(false);

  const COUNTRY_CODES = [
    { code: '+91', flag: '🇮🇳', label: 'India' },
    { code: '+1', flag: '🇺🇸', label: 'USA' },
    { code: '+44', flag: '🇬🇧', label: 'UK' },
    { code: '+61', flag: '🇦🇺', label: 'Australia' },
    { code: '+49', flag: '🇩🇪', label: 'Germany' },
    { code: '+81', flag: '🇯🇵', label: 'Japan' },
  ];
  const activeCountry = COUNTRY_CODES.find((c) => c.code === countryCode) ?? COUNTRY_CODES[0];

  // Onboarding story index (0 to 3)
  const [storyIndex, setStoryIndex] = useState(0);
  // Canonical phone for the in-flight attempt (set on send, cleared on change-number).
  const [e164Phone, setE164Phone] = useState<string>('');
  // Verified Supabase identity for the in-flight attempt. Login NEVER
  // completes without a real session backing it (checked explicitly below).
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  // Pending auto-verify after OTP auto-fill (cleared on manual edit).
  const autoVerifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  useEffect(() => () => {
    if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
  }, []);

  // Resend countdown
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (step === 'otp' && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  // Fresh login flow on every open: never resume a previous session's
  // step/OTP/phone — reopening login must always start at phone entry.
  useEffect(() => {
    if (isOpen) {
      setStep('phone');
      setPhoneNumber('');
      setOtp(Array(OTP_POLICY.length).fill(''));
      setErrorMessage(null);
      setIsSubmitting(false);
      setCountdown(OTP_POLICY.resendCooldownSeconds);
      setE164Phone('');
      setVerifiedUid(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const normalized = normalizeIndianPhone(phoneNumber, countryCode);
    if (!normalized) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    const provider = getOtpProvider();
    if (!provider) {
      // Production build without a configured auth backend: never fake it.
      setErrorMessage('Phone login needs server configuration in this build. Please try again later.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await provider.requestOtp(normalized.e164);
      if (!res.ok) {
        setErrorMessage(res.message);
        return;
      }
      setE164Phone(normalized.e164);
      setStep('otp');
      setCountdown(OTP_POLICY.resendCooldownSeconds);
      setOtp(Array(OTP_POLICY.length).fill(''));
      // Simulated routes auto-populate the generated code after a short
      // delay (Zyloom-style), then verification proceeds automatically.
      // Real routes leave the boxes empty for what the user received.
      // Manual typing/paste/delete during the wait still works and cancels
      // the pending auto-fill/verify.
      const auto = provider.autoFillCode?.(normalized.e164) ?? null;
      if (auto && auto.length === OTP_POLICY.length) {
        autoVerifyTimer.current = setTimeout(() => {
          autoVerifyTimer.current = null;
          setAutoFilled(true);
          setOtp(auto.split(''));
          setIsSubmitting(true);
          autoVerifyTimer.current = setTimeout(() => {
            autoVerifyTimer.current = null;
            verifyOtpCode(auto, normalized.e164).catch(() => {});
          }, 800);
        }, OTP_POLICY.autoFillDelayMs);
      } else {
        setTimeout(() => otpInputsRef.current[0]?.focus(), 60);
      }
    } catch {
      setErrorMessage("Couldn't send the code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    setErrorMessage(null);
    // Any manual edit cancels a pending auto-verify; the user owns the digits.
    if (autoVerifyTimer.current) {
      clearTimeout(autoVerifyTimer.current);
      autoVerifyTimer.current = null;
    }
    setAutoFilled(false);

    // Support paste of complete code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, OTP_POLICY.length);
      if (pasted.length > 0) {
        const newOtp = [...otp];
        for (let i = 0; i < OTP_POLICY.length; i++) {
          newOtp[i] = pasted[i] || '';
        }
        setOtp(newOtp);
        const nextFocus = Math.min(pasted.length, OTP_POLICY.length - 1);
        otpInputsRef.current[nextFocus]?.focus();
        if (pasted.length === OTP_POLICY.length) {
          verifyOtpCode(newOtp.join(''));
        }
      }
      return;
    }

    const cleanChar = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = cleanChar;
    setOtp(newOtp);

    // Auto advance focus
    if (cleanChar && index < OTP_POLICY.length - 1) {
      otpInputsRef.current[index + 1]?.focus();
    }

    // Auto verify when all digits are complete
    if (newOtp.every((digit) => digit !== '')) {
      verifyOtpCode(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const verifyOtpCode = async (enteredOtp: string, phoneOverride?: string) => {
    // phoneOverride exists because timer callbacks capture the render
    // BEFORE setE164Phone lands — reading e164Phone state there yields the
    // previous (empty) value and fails verification. Callers firing later
    // (typing, buttons) can rely on state.
    const phone = phoneOverride ?? e164Phone;
    if (enteredOtp.length !== OTP_POLICY.length) {
      setErrorMessage("That's not the right code. Try again.");
      return;
    }
    const provider = getOtpProvider();
    if (!provider || !phone) {
      setErrorMessage("Couldn't verify the code. Please try again.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await provider.verifyOtp(phone, enteredOtp);
      if (!res.ok) {
        setErrorMessage(res.message);
        return;
      }
      // Production gate: the code is worthless without a real authenticated
      // Supabase session behind it. Never report success on OTP alone.
      // (The legacy local simulator is the only path exempt — it cannot
      // mint sessions by design and is badged non-production on screen.)
      if (provider.establishesSession !== false) {
        const sb = getSupabase();
        const { data: sessionData } = sb
          ? await sb.auth.getUser()
          : { data: { user: null } };
        if (!sessionData?.user?.id) {
          setErrorMessage("Couldn't verify the code. Please try again.");
          return;
        }
        setVerifiedUid(sessionData.user.id);
      }
      // Transition to post-login story experience
      setStep('post_login');
    } catch {
      setErrorMessage("Couldn't verify the code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    const provider = getOtpProvider();
    if (!provider || !e164Phone) return;
    if (autoVerifyTimer.current) {
      clearTimeout(autoVerifyTimer.current);
      autoVerifyTimer.current = null;
    }
    setErrorMessage(null);
    setAutoFilled(false);
    const res = await provider.requestOtp(e164Phone);
    if (!res.ok) {
      setErrorMessage(res.message);
      return;
    }
    setCountdown(OTP_POLICY.resendCooldownSeconds);
    setOtp(Array(OTP_POLICY.length).fill(''));
    const auto = provider.autoFillCode?.(e164Phone) ?? null;
    if (auto && auto.length === OTP_POLICY.length) {
      autoVerifyTimer.current = setTimeout(() => {
        autoVerifyTimer.current = null;
        setAutoFilled(true);
        setOtp(auto.split(''));
        setIsSubmitting(true);
        autoVerifyTimer.current = setTimeout(() => {
          autoVerifyTimer.current = null;
          verifyOtpCode(auto, e164Phone).catch(() => {});
        }, 800);
      }, OTP_POLICY.autoFillDelayMs);
    } else {
      setTimeout(() => otpInputsRef.current[0]?.focus(), 60);
    }
  };

  const finalizeLogin = async () => {
    // No verified session, no login — the story screens can only be
    // reached after verification. (Legacy simulator exempt, as above.)
    const provider = getOtpProvider();
    if (provider?.establishesSession !== false && (!verifiedUid || !e164Phone)) {
      setErrorMessage("Couldn't verify the code. Please try again.");
      setStep('phone');
      return;
    }
    if (!e164Phone) {
      setErrorMessage("Couldn't verify the code. Please try again.");
      setStep('phone');
      return;
    }
    // Display name is best-effort from the user's own profile row; the
    // session stays the sole authority and no privilege is fabricated.
    // Skipped when no verified session exists (legacy simulator path).
    let displayName = 'You';
    if (verifiedUid) {
      try {
        const sb = getSupabase();
        const { data } = sb
          ? await sb.from('profiles').select('display_name').eq('id', verifiedUid).single()
          : { data: null };
        const dn = (data as { display_name?: string | null } | null)?.display_name;
        if (dn && dn.trim()) displayName = dn.trim().slice(0, 40);
      } catch {
        // ignore — profile sync runs after login regardless
      }
    }
    const national = e164Phone.replace(/\D/g, '').slice(-10);
    const authenticatedUser: User = {
      phone: national ? `+91 ${national.slice(0, 5)} ${national.slice(5)}` : e164Phone,
      name: displayName,
      isLoggedIn: true,
      isAdmin: false,
      accountId: stableAccountIdFor(e164Phone),
      tier: 'free',
      fontsCreatedCount: 0,
      totalDownloads: 0,
    };
    onSuccess(authenticatedUser, false);
    onClose();
  };

  // Story screens
  const storyScreens = [
    {
      title: "Let's make something that's yours.",
      desc: "Every stroke you make contains your natural handwriting cadence and rhythm.",
    },
    {
      title: "Your handwriting already has a style.",
      desc: "The tilt of your letters, the loop of your 'g', and your signature baseline flow.",
    },
    {
      title: "We'll help you bring it to the screen.",
      desc: "TypeMe translates your strokes into true vector curves formatted for any application.",
    },
    {
      title: "Ready?",
      desc: "Let's start your alphabet and create your personal typeface.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-md w-full p-8 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 transition-colors p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* STEP 1: Phone input */}
        {step === 'phone' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline mb-3">
                <span className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Type</span>
                <span className="text-2xl font-bold font-handwriting italic text-neutral-900 -ml-0.5">Me</span>
              </div>
                <h3 className="text-2xl font-bold text-neutral-900 font-serif">Welcome back.</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Continue your handwriting journey.
              </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 font-mono">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-neutral-300 shadow-2xs focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900 transition-all bg-white">
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setCcOpen((v) => !v)}
                      aria-label="Select country code"
                      aria-expanded={ccOpen}
                      className="flex h-full items-center gap-1 rounded-l-xl bg-neutral-900 px-3 py-3 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
                    >
                      <span aria-hidden="true">{activeCountry.flag}</span>
                      <span className="font-mono">{activeCountry.code}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ccOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {ccOpen ? (
                      <>
                        <div
                          className="fixed inset-0 z-[60]"
                          onClick={() => setCcOpen(false)}
                          aria-hidden="true"
                        />
                        <div
                          role="listbox"
                          aria-label="Country codes"
                          className="absolute left-0 top-full z-[61] mt-1 max-h-56 w-48 overflow-y-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-xl"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              role="option"
                              aria-selected={c.code === countryCode}
                              onClick={() => {
                                setCountryCode(c.code);
                                setCcOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-neutral-50 ${
                                c.code === countryCode ? 'font-semibold text-neutral-900' : 'text-neutral-700'
                              }`}
                            >
                              <span aria-hidden="true">{c.flag}</span>
                              <span className="flex-1">{c.label}</span>
                              <span className="font-mono text-neutral-500">{c.code}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <input
                    type="tel"
                    placeholder="7760593180"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    aria-label="Mobile number"
                    className="min-w-0 flex-1 rounded-r-xl px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none font-mono"
                    autoFocus
                  />
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {errorMessage}
                </p>
              )}

              {!isDemoAuthEnabled() ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-center">
                  Phone login needs server configuration in this build — configure the OTP backend to enable it.
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || phoneNumber.trim().length < 8}
                className="w-full py-3 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Sending code...</span>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <span className="text-xs text-neutral-400 italic">
                Your handwriting is waiting.
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: OTP screen */}
        {step === 'otp' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline mb-3">
                <span className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Type</span>
                <span className="text-2xl font-bold font-handwriting italic text-neutral-900 -ml-0.5">Me</span>
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 font-serif">
                Enter your verification code
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {autoFilled ? (
                  <>Your 4-digit verification code appears automatically.</>
                ) : (
                  <>We sent a {OTP_POLICY.length}-digit code to{' '}
                  <span className="font-semibold text-neutral-900 font-mono">
                    {e164Phone ? maskPhone(e164Phone) : `${countryCode} ${phoneNumber}`}
                  </span>
                  .</>
                )}
              </p>
              {e164Phone && isTestBridgeRoute(e164Phone) ? (
                <p className="text-[11px] text-neutral-400 mt-1 font-mono">
                  Test build — controlled test account, verified server-side.
                </p>
              ) : null}
              {e164Phone && !isTestBridgeRoute(e164Phone) && isLocalSimulated() ? (
                <p className="text-[11px] text-amber-700 mt-1 font-mono">
                  Local test mode — code checked on this device, session is not phone-bound.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpInputsRef.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={`Digit ${idx + 1} of ${OTP_POLICY.length}`}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-12 h-14 text-center text-xl font-semibold font-mono text-neutral-900 rounded-xl border border-neutral-300 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 focus:outline-none transition-all shadow-2xs"
                />
              ))}
            </div>

            {errorMessage && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-center font-medium">
                {errorMessage}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                {countdown > 0 ? (
                  <>Resend code in <span className="font-mono">{countdown}s</span></>
                ) : (
                  <button
                    onClick={handleResend}
                    className="text-neutral-900 font-semibold underline hover:text-neutral-700 cursor-pointer"
                  >
                    Didn't receive it? Resend code
                  </button>
                )}
              </span>
              <button
                onClick={() => {
                  if (autoVerifyTimer.current) {
                    clearTimeout(autoVerifyTimer.current);
                    autoVerifyTimer.current = null;
                  }
                  setAutoFilled(false);
                  setStep('phone');
                  setErrorMessage(null);
                }}
                className="text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Change number
              </button>
            </div>

            <button
              onClick={() => verifyOtpCode(otp.join(''))}
              disabled={isSubmitting || otp.some((d) => d === '')}
              className="w-full py-3 px-4 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </div>
        )}

        {/* STEP 3: Post-Login Transition (Prompt Section 19) */}
        {step === 'post_login' && (
          <div className="space-y-6">
            <div>
              <span className="text-[11px] font-mono text-emerald-600 uppercase tracking-wider block mb-1">
                ✓ Verified
              </span>
              <h3 className="text-2xl font-bold text-neutral-900 font-serif">
                Welcome to TypeMe.
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Let's plan your handwriting. What are you creating today?
              </p>
            </div>

            <div className="space-y-2">
              {[
                'My handwriting font',
                'A signature',
                'A personal project',
                'A brand style',
                'Just exploring',
              ].map((option) => (
                <button
                  key={option}
                  onClick={() => setCreationGoal(option)}
                  className={`w-full p-3 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                    creationGoal === option
                      ? 'border-neutral-900 bg-neutral-50 text-neutral-900 shadow-2xs font-semibold'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  <span>{option}</span>
                  {creationGoal === option && (
                    <CheckCircle2 className="w-4 h-4 text-neutral-900" />
                  )}
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={finalizeLogin}
                className="text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                Skip intro
              </button>
              <button
                onClick={() => setStep('onboarding_story')}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>Let's Create</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Login Onboarding Story (Prompt Section 20) */}
        {step === 'onboarding_story' && (
          <div className="space-y-6">
            <div className="min-h-[160px] flex flex-col justify-center">
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block mb-2">
                Part {storyIndex + 1} of 4
              </span>
              <h3 className="text-2xl font-bold text-neutral-900 font-serif leading-snug">
                {storyScreens[storyIndex].title}
              </h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                {storyScreens[storyIndex].desc}
              </p>
            </div>

            {/* Progress indicators */}
            <div className="flex items-center gap-1.5">
              {storyScreens.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full flex-1 transition-all ${
                    i <= storyIndex ? 'bg-neutral-900' : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={finalizeLogin}
                className="text-xs text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                Skip
              </button>

              {storyIndex < storyScreens.length - 1 ? (
                <button
                  onClick={() => setStoryIndex(storyIndex + 1)}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={finalizeLogin}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Start Writing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
