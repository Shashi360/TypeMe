import React from 'react';
import { AppView, LegalDoc } from '../types';
import { ArrowRight, Mail, MapPin } from 'lucide-react';
import { FooterAboutMe } from './FooterAboutMe';

interface FooterProps {
  onNavigate: (view: AppView, anchorId?: string) => void;
  onStartWriting: () => void;
  onOpenLegal: (doc: LegalDoc) => void;
  onExploreStyles?: () => void;
  onOpenLearn?: () => void;
  onOpenQuiz?: () => void;
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
}) => {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <FooterAboutMe onStartWriting={onStartWriting} onExploreStyles={onExploreStyles} />

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
                downloadable OpenType and TrueType digital fonts.
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
