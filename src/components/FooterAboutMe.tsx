import React, { useEffect, useRef } from 'react';
import { ArrowRight, Compass } from 'lucide-react';

const FRAGMENTS = ['Aa', 'Bb', 'Cc', 'Aa Bb Cc', '01', '#', '&'];

interface FooterAboutMeProps {
  onStartWriting: () => void;
  onExploreStyles?: () => void;
}

/**
 * About Me, tuned for the footer: same hand-written reveal and signature
 * animations as the old landing section, but composed as a compact band so it
 * reads as the closing note of the page instead of a standalone chapter.
 */
export const FooterAboutMe: React.FC<FooterAboutMeProps> = ({
  onStartWriting,
  onExploreStyles,
}) => {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('tm-about-in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.classList.add('tm-about-in');
          io.disconnect();
        }
      },
      // The footer band is short, so trigger as soon as any of it shows.
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="tm-about-heading"
      className="tm-about scroll-mt-20 border-t border-neutral-100 bg-neutral-50/70 py-12 sm:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="tm-about-copy flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">About me</p>
            <h2
              id="tm-about-heading"
              className="mt-2 font-serif text-[clamp(1.5rem,3.4vw,2.125rem)] font-semibold leading-tight tracking-tight text-neutral-900"
            >
              Built by someone who cares how your words look.
            </h2>
          </div>
          <p className="max-w-xs font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-neutral-400">
            Shashikant Vishwakarma &middot; Founder
          </p>
        </div>

        <div className="mt-7 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          {/* Founder story */}
          <div className="tm-about-story order-2 space-y-3 lg:order-1">
            <p className="text-[15px] leading-relaxed text-neutral-700 text-pretty sm:text-base">
              I believe the things we create should feel a little more like us. TypeMe started with a
              simple question &mdash; what if your handwriting could become something you could
              actually use?
            </p>
            <p className="text-sm leading-relaxed text-neutral-500 text-pretty">
              So I built the tool I wished existed: trace each letter by hand, then export a real
              OpenType and TrueType font you can type with, license, and keep.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onStartWriting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                <span>Create My Font</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              {onExploreStyles ? (
                <button
                  type="button"
                  onClick={onExploreStyles}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-800 transition-colors hover:border-neutral-900 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Explore TypeMe</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Handwritten visual */}
          <div className="tm-about-visual order-1 lg:order-2">
            <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-white px-5 py-8 shadow-xs sm:px-8 sm:py-9">
              <div className="tm-about-write relative">
                <p className="tm-about-phrase whitespace-nowrap text-center font-handwriting text-[clamp(1.9rem,7vw,2.75rem)] leading-none text-neutral-900">
                  Make it yours.
                </p>
                <span aria-hidden="true" className="tm-about-pen" />
              </div>

              <div className="mt-7 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
                <span className="tm-about-step">Handwriting</span>
                <span className="text-neutral-300" aria-hidden="true">
                  &rarr;
                </span>
                <span className="tm-about-step">Type</span>
                <span className="text-neutral-300" aria-hidden="true">
                  &rarr;
                </span>
                <span className="tm-about-step">Your story</span>
              </div>

              <div className="mt-7 flex flex-col items-center gap-3 border-t border-neutral-200/70 pt-6 sm:flex-row sm:justify-between">
                <div className="text-center sm:text-left">
                  <p className="text-sm font-semibold text-neutral-900">Shashikant Vishwakarma</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    Founder &amp; CEO &mdash; TypeMe
                  </p>
                </div>
                <p className="tm-about-sign relative inline-block font-handwriting text-xl text-neutral-800">
                  Shashikant
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 240 10"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1 left-0 h-2 w-full text-amber-500/70"
                  >
                    <path
                      d="M3 6 C 60 1.5, 130 8.5, 237 3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      pathLength={1}
                      className="tm-about-stroke"
                    />
                  </svg>
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {FRAGMENTS.map((fragment, i) => (
                <span
                  key={fragment}
                  aria-hidden="true"
                  className="tm-about-float rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-mono text-[9px] tracking-widest text-neutral-400"
                  style={{ animationDelay: `${0.5 + i * 0.09}s` }}
                >
                  {fragment}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FooterAboutMe;