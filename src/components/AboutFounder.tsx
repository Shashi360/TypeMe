import React, { useEffect, useRef } from 'react';
import { ArrowRight, Compass } from 'lucide-react';

const FRAGMENTS = ['Aa', 'Bb', 'Cc', 'Aa Bb Cc', '01', '#', '&'];

interface AboutFounderProps {
  onStartWriting: () => void;
  onExploreStyles: () => void;
}

const AboutFounder: React.FC<AboutFounderProps> = ({
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
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="tm-about-heading"
      className="tm-about scroll-mt-20 border-b border-neutral-200 bg-white py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="tm-about-copy">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
            The person behind the idea
          </p>
          <h2
            id="tm-about-heading"
            className="mt-3 font-serif text-[clamp(1.75rem,4.6vw,2.75rem)] font-semibold leading-tight tracking-tight text-neutral-900"
          >
            About the person behind TypeMe.
          </h2>
        </div>

        <div className="mt-10 grid items-center gap-12 lg:mt-14 lg:grid-cols-2 lg:gap-16">
          {/* Handwritten visual */}
          <div className="tm-about-visual">
            <div className="relative overflow-hidden rounded-[28px] border border-neutral-200 bg-gradient-to-br from-neutral-50 via-white to-neutral-50 px-6 py-12 shadow-xs sm:px-10 sm:py-14">
              <div className="tm-about-write relative">
                <p className="tm-about-phrase whitespace-nowrap text-center font-handwriting text-[clamp(2.4rem,9vw,3.75rem)] leading-none text-neutral-900">
                  Make it yours.
                </p>
                <span aria-hidden="true" className="tm-about-pen" />
              </div>

              <div className="mt-10 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-500">
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

              <div className="mt-10 border-t border-neutral-200/70 pt-8 text-center">
                <p className="text-lg font-semibold text-neutral-900">
                  Shashikant Vishwakarma
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Founder &amp; CEO &mdash; TypeMe
                </p>
                <p className="tm-about-sign relative mx-auto mt-6 inline-block font-handwriting text-2xl text-neutral-800">
                  Shashikant Vishwakarma
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

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {FRAGMENTS.map((fragment, i) => (
                <span
                  key={fragment}
                  aria-hidden="true"
                  className="tm-about-float rounded-full border border-neutral-200 bg-white px-2.5 py-1 font-mono text-[10px] tracking-widest text-neutral-400"
                  style={{ animationDelay: `${0.5 + i * 0.09}s` }}
                >
                  {fragment}
                </span>
              ))}
            </div>
          </div>

          {/* Founder story */}
          <div className="tm-about-story space-y-5">
            <p className="text-base leading-relaxed text-neutral-700 text-pretty sm:text-lg">
              I believe the things we create should feel a little more like us. TypeMe started with
              a simple idea &mdash; what if your handwriting could become something you could
              actually use?
            </p>
            <p className="text-sm leading-relaxed text-neutral-500 text-pretty">
              Turning something personal into something you can create with.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={onStartWriting}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                <span>Create My Font</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onExploreStyles}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-900 hover:bg-neutral-50"
              >
                <Compass className="h-4 w-4" />
                <span>Explore TypeMe</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutFounder;
