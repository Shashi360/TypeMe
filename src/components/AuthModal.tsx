import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, ArrowRight, CheckCircle2, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, isNewUser: boolean) => void;
}

// Development credentials isolated for local testing and demo validation
const DEV_AUTH_CONFIG = {
  DEV_PHONE: '7760593180',
  DEV_OTP: '007347',
};

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'phone' | 'otp' | 'post_login' | 'onboarding_story'>('phone');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('7760593180');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  // Post login goal selection
  const [creationGoal, setCreationGoal] = useState('My handwriting font');

  // Onboarding story index (0 to 3)
  const [storyIndex, setStoryIndex] = useState(0);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  if (!isOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setStep('otp');
      setCountdown(30);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 60);
    }, 350);
  };

  const handleOtpChange = (index: number, value: string) => {
    setErrorMessage(null);

    // Support paste of complete code
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      if (pasted.length > 0) {
        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) {
          newOtp[i] = pasted[i] || '';
        }
        setOtp(newOtp);
        const nextFocus = Math.min(pasted.length, 5);
        otpInputsRef.current[nextFocus]?.focus();
        if (pasted.length === 6) {
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
    if (cleanChar && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }

    // Auto verify when 6 digits are complete
    if (newOtp.every((digit) => digit !== '')) {
      verifyOtpCode(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const verifyOtpCode = (enteredOtp: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsSubmitting(false);
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      // Check development credential verification
      if (cleanPhone === DEV_AUTH_CONFIG.DEV_PHONE) {
        if (enteredOtp !== DEV_AUTH_CONFIG.DEV_OTP) {
          setErrorMessage("That's not the right code. Try again.");
          return;
        }
      } else {
        // For general numbers in development, accept valid 6 digits
        if (enteredOtp.length !== 6) {
          setErrorMessage("That's not the right code. Try again.");
          return;
        }
      }

      // Transition to post-login story experience
      setStep('post_login');
    }, 450);
  };

  const finalizeLogin = () => {
    const fullPhone = `${countryCode} ${phoneNumber.trim()}`;
    const authenticatedUser: User = {
      phone: fullPhone,
      name: 'Shashi',
      isLoggedIn: true,
      isAdmin: true,
      tier: 'free',
      fontsCreatedCount: 3,
      totalDownloads: 6,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-md w-full p-8 relative my-auto">
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
                <div className="flex rounded-xl border border-neutral-300 shadow-2xs focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900 transition-all overflow-hidden bg-white">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="bg-neutral-50 px-3 py-3 text-xs font-medium text-neutral-800 border-r border-neutral-300 focus:outline-none"
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+81">🇯🇵 +81</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="7760593180"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    className="flex-1 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none font-mono"
                    autoFocus
                  />
                </div>
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {errorMessage}
                </p>
              )}

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
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-neutral-900 font-mono">
                  {countryCode} {phoneNumber}
                </span>
                .
              </p>
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
                    onClick={() => {
                      setCountdown(30);
                      setErrorMessage(null);
                    }}
                    className="text-neutral-900 font-semibold underline hover:text-neutral-700 cursor-pointer"
                  >
                    Didn't receive it? Resend code
                  </button>
                )}
              </span>
              <button
                onClick={() => {
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
