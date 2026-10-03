import React from 'react';
import { AppView, LegalDoc } from '../types';
import { ArrowLeft } from 'lucide-react';

interface LegalViewProps {
  doc: LegalDoc;
  onOpenDoc: (doc: LegalDoc) => void;
  onNavigate: (view: AppView) => void;
  onStartWriting: () => void;
}

interface Section {
  heading: string;
  body: string[];
}

interface Doc {
  label: string;
  title: string;
  updated: string;
  intro: string;
  sections: Section[];
}

const DOCS: Record<LegalDoc, Doc> = {
  privacy: {
    label: 'Privacy Policy',
    title: 'Privacy Policy',
    updated: 'Last updated 1 March 2026',
    intro:
      'TypeMe is built so that the thing you make stays yours. This page explains exactly what we store, where it lives, and what we never do with it.',
    sections: [
      {
        heading: 'What we store',
        body: [
          'Your account details (phone number and display name), your font projects, and the stroke data you draw in the workspace.',
          'Fonts and projects are saved in your own browser storage so you can close the tab and pick up where you left off.',
        ],
      },
      {
        heading: 'What we do not do',
        body: [
          'We do not sell, rent, or share your handwriting with advertisers or third parties.',
          'We do not train generative models on your strokes, and we do not publish your fonts to the community gallery unless you explicitly choose to.',
        ],
      },
      {
        heading: 'How fonts are generated',
        body: [
          'Glyphs are compiled in your browser into a TrueType (.ttf) file. The font file is produced on your device and handed straight back to you.',
        ],
      },
      {
        heading: 'Your controls',
        body: [
          'You can delete a project at any time from your dashboard, and clearing your browser storage removes your account and every font on this device.',
          'For account deletion requests or any privacy question, write to hello@typeme.studio.',
        ],
      },
    ],
  },
  terms: {
    label: 'Terms & Conditions',
    title: 'Terms & Conditions',
    updated: 'Last updated 1 March 2026',
    intro:
      'These terms cover your use of TypeMe. Short version: create as much as you like, own what you make, and use the service honestly.',
    sections: [
      {
        heading: 'Your account',
        body: [
          'One account per person. You are responsible for activity that happens under your account, so keep your login details to yourself.',
          'You must be old enough to enter a contract where you live to use TypeMe.',
        ],
      },
      {
        heading: 'What you create',
        body: [
          'You keep every right you already had in your handwriting. TypeMe claims no ownership over the strokes you draw or the fonts generated from them.',
          'You are responsible for making sure you have the right to upload or trace any material you bring into the workspace.',
        ],
      },
      {
        heading: 'Acceptable use',
        body: [
          'Do not use TypeMe to impersonate someone, to create content that harasses or defrauds, or to generate fonts that infringe someone else’s typeface.',
        ],
      },
      {
        heading: 'Plans and billing',
        body: [
          'Paid plans renew on the billing cycle you choose and can be cancelled at any time from your account.',
          'If you cancel, you keep access to the plan until the end of the paid period, and any fonts you already generated remain yours to use.',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'If these terms change materially we will say so in the app and update the date at the top of this page.',
        ],
      },
    ],
  },
  licensing: {
    label: 'Commercial Font Licensing',
    title: 'Commercial Font Licensing',
    updated: 'Last updated 1 March 2026',
    intro:
      'Every font you generate from your own handwriting is yours to use. This page spells out what each plan covers.',
    sections: [
      {
        heading: 'You own your font',
        body: [
          'The characters are derived from your handwriting, so the resulting typeface is yours. We claim no licence over it and we do not resell it.',
        ],
      },
      {
        heading: 'Free plan',
        body: [
          'Personal and non-commercial projects: journals, schoolwork, personal gifts, social posts, and learning.',
        ],
      },
      {
        heading: 'Creator plan',
        body: [
          'Commercial use in client work, self-published books, merchandise you sell yourself, and small-business marketing.',
        ],
      },
      {
        heading: 'Pro plan',
        body: [
          'Everything in Creator, plus distribution: selling or giving away the font as a product, offering it inside templates or apps, and unlimited font projects.',
        ],
      },
      {
        heading: 'What is never covered',
        body: [
          'Licensing does not transfer the right to someone else’s handwriting. If a font traces a person’s signature, you need their permission.',
        ],
      },
    ],
  },
};

const LegalView: React.FC<LegalViewProps> = ({ doc, onOpenDoc, onNavigate, onStartWriting }) => {
  const current = DOCS[doc] ?? DOCS.privacy;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to home</span>
        </button>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {(Object.keys(DOCS) as LegalDoc[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onOpenDoc(key)}
              aria-current={key === doc ? 'page' : undefined}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                key === doc
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
              }`}
            >
              {DOCS[key].label}
            </button>
          ))}
        </div>

        <h1 className="mt-8 font-serif text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
          {current.title}
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400">
          {current.updated}
        </p>
        <p className="mt-6 text-base leading-relaxed text-neutral-700 text-pretty sm:text-lg">
          {current.intro}
        </p>

        <div className="mt-12 space-y-10">
          {current.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-900">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-neutral-600 text-pretty">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-3xl border border-neutral-200 bg-neutral-50 px-6 py-8 text-center">
          <p className="font-handwriting text-3xl text-neutral-900">Make it yours.</p>
          <p className="mt-2 text-sm text-neutral-500">
            Ready to turn your own handwriting into a font?
          </p>
          <button
            type="button"
            onClick={onStartWriting}
            className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Create My Font
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalView;
