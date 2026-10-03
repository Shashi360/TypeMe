import React from 'react';
import { AppView, LegalDoc } from '../types';
import { ArrowRight, Mail, MapPin } from 'lucide-react';
import { FooterAboutMe } from './FooterAboutMe';
import { SUPPORT_EMAIL, SUPPORT_INSTAGRAM_HANDLE, SUPPORT_INSTAGRAM_URL } from '../utils/support';

interface FooterProps {
  onNavigate: (view: AppView, anchorId?: string) => void;
  onStartWriting: () => void;
  onOpenLegal: (doc: LegalDoc) => void;
  onExploreStyles?: () => void;
  onOpenLearn?: () => void;
  onOpenQuiz?: () => void;
  currentView?: AppView;
}

const LEGAL_LINKS: { doc: LegalDoc; label: string }[] = [
  { doc: 'privacy', label: 'Privacy Policy' },
  { doc: 'terms', label: 'Terms & Conditions' },
  { doc: 'licensing', label: 'Commercial Font Licensing' },
];

export const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onStartWriting,
  onOpenLegal,
  onExploreStyles,
  currentView,
}) => {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      {currentView === 'landing' ? (
        <FooterAboutMe onStartWriting={onStartWriting} onExploreStyles={onExploreStyles} />
      ) : null}

      <div className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-8 pb-10 border-b border-neutral-100 md:flex-row md:items-center">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('landing')}
                  title="TypeMe Home"
                  className="flex cursor-pointer items-center gap-2 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                    <span className="font-handwriting text-xl text-amber-200 font-bold">M</span>
                  </div>
                  <div className="flex items-baseline">
                    <span className="text-xl font-bold font-sans text-neutral-900 tracking-tight">Type</span>
                    <span className="text-2xl font-bold font-handwriting italic text-neutral-900 -ml-0.5">Me</span>
                  </div>
                </button>
              </div>
              <p className="text-xs text-neutral-500 max-w-sm leading-relaxed">
                Your handwriting. Your font. Your story. TypeMe transforms authentic pen strokes into real,
                downloadable OpenType digital font.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-neutral-500">
                <a
                  href="mailto:hello@typeme.studio"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-neutral-900"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>hello@typeme.studio</span>
                </a>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Built by Shashikant Vishwakarma</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartWriting}
              className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 cursor-pointer"
            >
              <span>Create My Font</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 sm:p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-neutral-900 font-serif">Need help with TypeMe?</p>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed max-w-md">
                Have a question, found something that isn't working, or just want to share feedback? We'd love to hear from you.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email support</span>
              </a>
              {SUPPORT_INSTAGRAM_URL && SUPPORT_INSTAGRAM_HANDLE ? (
                <a
                  href={SUPPORT_INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <span>DM us on Instagram ({SUPPORT_INSTAGRAM_HANDLE})</span>
                </a>
              ) : (
                <span className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-dashed border-neutral-200 px-4 text-xs font-medium text-neutral-400">
                  Instagram support coming soon
                </span>
              )}
            </div>
          </div>

          <div className="pt-8 flex flex-col gap-4 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {new Date().getFullYear()} TypeMe. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {LEGAL_LINKS.map(({ doc, label }, i) => (
                <React.Fragment key={doc}>
                  {i > 0 && <span aria-hidden="true">&middot;</span>}
                  <button
                    type="button"
                    onClick={() => onOpenLegal(doc)}
                    className="cursor-pointer transition-colors hover:text-neutral-900"
                  >
                    {label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
