import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, PenTool, Sliders } from 'lucide-react';

interface StyleExplorerViewProps {
  onBackToHome: () => void;
  onStartWriting: () => void;
}

export const StyleExplorerView: React.FC<StyleExplorerViewProps> = ({
  onBackToHome,
  onStartWriting,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    'handwritten' | 'serif' | 'sans' | 'script' | 'display' | 'monospace'
  >('handwritten');

  const categories = [
    {
      id: 'handwritten' as const,
      name: 'Handwritten',
      tags: ['Casual', 'Personal', 'Friendly', 'Human'],
      description:
        'Handwritten fonts are designed to look naturally drawn by a human pen rather than mechanically cast. They preserve organic variance, gentle baseline sway, and imperfect beauty.',
      specimens: [
        { name: 'Everyday Ballpoint', sample: 'Just picked up some fresh sourdough from the bakery.', font: 'font-handwriting' },
        { name: 'Fountain Pen Letter', sample: 'Dearest friend, let us meet before the autumn leaves fall.', font: 'font-pen' },
        { name: 'Quick Journal Entry', sample: 'October 1st — 7:00 AM coffee, clean desk, fresh start.', font: 'font-handwriting' },
      ],
    },
    {
      id: 'serif' as const,
      name: 'Serif',
      tags: ['Classic', 'Editorial', 'Traditional', 'Refined'],
      description:
        'Serif fonts carry small finishing strokes projecting from the ends of letter lines. They evoke literary prestige, scholarly depth, and historical permanence.',
      specimens: [
        { name: 'Editorial Antiqua', sample: 'In the quiet library of centuries, knowledge breathes.', font: 'font-serif' },
        { name: 'Classic Broadside', sample: 'A declaration of artistic independence and timeless craft.', font: 'font-serif italic' },
        { name: 'Bookish Roman', sample: 'Chapter IV: The Art of the Handwritten Letter.', font: 'font-serif' },
      ],
    },
    {
      id: 'sans' as const,
      name: 'Sans Serif',
      tags: ['Modern', 'Minimal', 'Clean', 'Digital'],
      description:
        'Sans serif removes decorative terminating strokes for high clarity and modern geometric directness. Perfect for clean interfaces and signage.',
      specimens: [
        { name: 'Geometric Neo-Grotesque', sample: 'Clarity is the ultimate virtue in digital product design.', font: 'font-sans font-medium' },
        { name: 'Architect Draft', sample: 'PRECISION STRUCTURE & OPEN ARCHITECTURE 2026', font: 'font-sans tracking-widest uppercase text-sm' },
        { name: 'Contemporary Minimal', sample: 'Simple forms create space for authentic human thought.', font: 'font-sans' },
      ],
    },
    {
      id: 'script' as const,
      name: 'Script',
      tags: ['Calligraphy', 'Wedding Style', 'Signature', 'Fluid'],
      description:
        'Script typefaces imitate formal calligraphy, connected penmanship, or dynamic brush strokes. They add luxurious romantic ceremony and celebration.',
      specimens: [
        { name: 'Copperplate Ribbon', sample: 'Cordially requesting the pleasure of your company.', font: 'font-handwriting font-bold' },
        { name: 'Signature Monogram', sample: 'Shashi Kumar — Creative Director & Letterer', font: 'font-handwriting' },
        { name: 'Flourished Italic', sample: 'With deepest affection, now and always.', font: 'font-handwriting italic' },
      ],
    },
    {
      id: 'display' as const,
      name: 'Display',
      tags: ['Bold', 'Decorative', 'Poster Style', 'Expressive'],
      description:
        'Display typefaces are engineered for dramatic visual impact at large point sizes — in headlines, posters, book covers, and packaging.',
      specimens: [
        { name: 'Hand-Carved Woodblock', sample: 'THE MAKER MANIFESTO', font: 'font-serif uppercase font-bold tracking-wider' },
        { name: 'Bold Ink Splash', sample: 'AUTHENTICITY OVER ALGORITHMS', font: 'font-sans font-extrabold tracking-tight' },
        { name: 'Poster Header', sample: 'TypeMe Typography Festival', font: 'font-serif italic text-3xl' },
      ],
    },
    {
      id: 'monospace' as const,
      name: 'Monospace',
      tags: ['Coding', 'Technical', 'Retro', 'Structured'],
      description:
        'Every glyph occupies the exact same horizontal width. Historically developed for mechanical typewriters, now beloved in developer editors and data sheets.',
      specimens: [
        { name: 'Terminal Console', sample: 'npm run generate-font --family="TypeMe" --units=1000', font: 'font-mono' },
        { name: 'Draftsman Ledger', sample: 'INDEX_04: GLYPH_CONTOURS [OK] 82/82 COMPILED', font: 'font-mono' },
        { name: 'Mechanical Ribbon', sample: '1974 Olivetti typewriter impression test on vellum.', font: 'font-mono' },
      ],
    },
  ];

  const current = categories.find((c) => c.id === activeCategory) || categories[0];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="space-y-1">
          <button
            onClick={onBackToHome}
            className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 font-serif tracking-tight">
            Explore the World of Fonts
          </h1>
          <p className="text-sm text-neutral-600">
            Learn what makes each typeface category unique and where your handwriting fits into the typographic spectrum.
          </p>
        </div>

        <button
          onClick={onStartWriting}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <span>Create My Font</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-xl max-w-3xl overflow-x-auto no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`py-2 px-4 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Category Showcase Box */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 sm:p-10 shadow-sm space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 font-serif">
              {current.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              {current.tags.map((t, idx) => (
                <span key={idx} className="bg-neutral-50 px-2 py-0.5 rounded text-neutral-600 font-mono text-[11px]">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-3xl leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Specimens List */}
        <div className="space-y-4 pt-4 border-t border-neutral-100">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Interactive Specimens
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {current.specimens.map((specimen, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex flex-col justify-between"
              >
                <span className="text-[11px] font-mono text-neutral-400 block mb-3">
                  {specimen.name}
                </span>
                <p className={`${specimen.font} text-2xl text-neutral-900 my-2 leading-relaxed`}>
                  "{specimen.sample}"
                </p>
                <div className="pt-3 border-t border-neutral-200/60 flex items-center justify-between text-[11px] text-neutral-500">
                  <span>Aa Bb Cc 123</span>
                  <span className="text-neutral-700 font-medium">Specimen {idx + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA Box */}
        <div className="p-6 rounded-2xl bg-neutral-50/50 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Ready to give your own handwriting digital life?
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Turn your personal pen strokes into an authentic typeface in under 5 minutes.
            </p>
          </div>
          <button
            onClick={onStartWriting}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <span>Start Writing on TypeMe</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
