import { CharacterCategory, CharacterData, FontProject, Stroke } from '../types';

export interface CharDefinition {
  char: string;
  unicode: number;
  category: CharacterCategory;
  hint: string;
}

export const UPPERCASE_CHARS: CharDefinition[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  .split('')
  .map((char) => ({
    char,
    unicode: char.charCodeAt(0),
    category: 'uppercase',
    hint: `Write uppercase ${char}`,
  }));

export const LOWERCASE_CHARS: CharDefinition[] = 'abcdefghijklmnopqrstuvwxyz'
  .split('')
  .map((char) => ({
    char,
    unicode: char.charCodeAt(0),
    category: 'lowercase',
    hint: `Write lowercase ${char}`,
  }));

export const NUMBER_CHARS: CharDefinition[] = '0123456789'
  .split('')
  .map((char) => ({
    char,
    unicode: char.charCodeAt(0),
    category: 'numbers',
    hint: `Write digit ${char}`,
  }));

export const SYMBOL_CHARS: CharDefinition[] = [
  { char: '!', unicode: 33, category: 'symbols', hint: 'Exclamation mark' },
  { char: '?', unicode: 63, category: 'symbols', hint: 'Question mark' },
  { char: '.', unicode: 46, category: 'symbols', hint: 'Full stop' },
  { char: ',', unicode: 44, category: 'symbols', hint: 'Comma' },
  { char: "'", unicode: 39, category: 'symbols', hint: 'Single quote' },
  { char: '"', unicode: 34, category: 'symbols', hint: 'Double quote' },
  { char: '-', unicode: 45, category: 'symbols', hint: 'Hyphen' },
  { char: ':', unicode: 58, category: 'symbols', hint: 'Colon' },
  { char: ';', unicode: 59, category: 'symbols', hint: 'Semicolon' },
  { char: '/', unicode: 47, category: 'symbols', hint: 'Slash' },
  { char: '(', unicode: 40, category: 'symbols', hint: 'Open parenthesis' },
  { char: ')', unicode: 41, category: 'symbols', hint: 'Close parenthesis' },
  { char: '&', unicode: 38, category: 'symbols', hint: 'Ampersand' },
  { char: '@', unicode: 64, category: 'symbols', hint: 'At sign' },
  { char: '#', unicode: 35, category: 'symbols', hint: 'Hash tag' },
  { char: '$', unicode: 36, category: 'symbols', hint: 'Dollar sign' },
  { char: '%', unicode: 37, category: 'symbols', hint: 'Percent' },
  { char: '*', unicode: 42, category: 'symbols', hint: 'Asterisk' },
  { char: '+', unicode: 43, category: 'symbols', hint: 'Plus sign' },
  { char: '=', unicode: 61, category: 'symbols', hint: 'Equals sign' },
];

export const ALL_CHARACTERS = [
  ...UPPERCASE_CHARS,
  ...LOWERCASE_CHARS,
  ...NUMBER_CHARS,
  ...SYMBOL_CHARS,
];

// Helper to generate natural synthetic strokes for sample characters
export function generateSampleStrokesForChar(char: string): Stroke[] {
  // Baseline is at y=300, Cap at y=100, Midline at y=180, Descender at y=360
  // Canvas coordinate system: 400x400
  switch (char) {
    case 'A':
      return [
        [{ x: 140, y: 295 }, { x: 195, y: 110 }],
        [{ x: 195, y: 110 }, { x: 260, y: 295 }],
        [{ x: 160, y: 220 }, { x: 235, y: 220 }],
      ];
    case 'B':
      return [
        [{ x: 140, y: 110 }, { x: 140, y: 295 }],
        [{ x: 140, y: 110 }, { x: 220, y: 120 }, { x: 230, y: 180 }, { x: 145, y: 195 }],
        [{ x: 145, y: 195 }, { x: 235, y: 210 }, { x: 240, y: 280 }, { x: 140, y: 295 }],
      ];
    case 'C':
      return [
        [{ x: 250, y: 140 }, { x: 190, y: 110 }, { x: 140, y: 170 }, { x: 140, y: 240 }, { x: 190, y: 295 }, { x: 250, y: 270 }],
      ];
    case 'D':
      return [
        [{ x: 140, y: 110 }, { x: 140, y: 295 }],
        [{ x: 140, y: 110 }, { x: 220, y: 120 }, { x: 255, y: 180 }, { x: 255, y: 230 }, { x: 215, y: 290 }, { x: 140, y: 295 }],
      ];
    case 'E':
      return [
        [{ x: 145, y: 110 }, { x: 145, y: 295 }],
        [{ x: 145, y: 110 }, { x: 245, y: 110 }],
        [{ x: 145, y: 200 }, { x: 225, y: 200 }],
        [{ x: 145, y: 295 }, { x: 250, y: 295 }],
      ];
    case 'F':
      return [
        [{ x: 150, y: 110 }, { x: 150, y: 295 }],
        [{ x: 150, y: 110 }, { x: 245, y: 110 }],
        [{ x: 150, y: 200 }, { x: 225, y: 200 }],
      ];
    case 'H':
      return [
        [{ x: 140, y: 110 }, { x: 140, y: 295 }],
        [{ x: 250, y: 110 }, { x: 250, y: 295 }],
        [{ x: 140, y: 200 }, { x: 250, y: 200 }],
      ];
    case 'I':
      return [
        [{ x: 160, y: 110 }, { x: 240, y: 110 }],
        [{ x: 200, y: 110 }, { x: 200, y: 295 }],
        [{ x: 160, y: 295 }, { x: 240, y: 295 }],
      ];
    case 'L':
      return [
        [{ x: 150, y: 110 }, { x: 150, y: 295 }],
        [{ x: 150, y: 295 }, { x: 245, y: 295 }],
      ];
    case 'O':
      return [
        [{ x: 200, y: 110 }, { x: 140, y: 180 }, { x: 140, y: 230 }, { x: 200, y: 295 }, { x: 260, y: 230 }, { x: 260, y: 180 }, { x: 200, y: 110 }],
      ];
    case 'P':
      return [
        [{ x: 145, y: 110 }, { x: 145, y: 295 }],
        [{ x: 145, y: 110 }, { x: 230, y: 120 }, { x: 240, y: 170 }, { x: 210, y: 210 }, { x: 145, y: 210 }],
      ];
    case 'R':
      return [
        [{ x: 145, y: 110 }, { x: 145, y: 295 }],
        [{ x: 145, y: 110 }, { x: 230, y: 120 }, { x: 240, y: 170 }, { x: 210, y: 210 }, { x: 145, y: 210 }],
        [{ x: 200, y: 210 }, { x: 250, y: 295 }],
      ];
    case 'S':
      return [
        [{ x: 240, y: 135 }, { x: 190, y: 110 }, { x: 150, y: 145 }, { x: 235, y: 230 }, { x: 210, y: 295 }, { x: 145, y: 275 }],
      ];
    case 'T':
      return [
        [{ x: 130, y: 110 }, { x: 270, y: 110 }],
        [{ x: 200, y: 110 }, { x: 200, y: 295 }],
      ];
    case 'a':
      return [
        [{ x: 230, y: 180 }, { x: 175, y: 180 }, { x: 150, y: 230 }, { x: 180, y: 290 }, { x: 235, y: 260 }],
        [{ x: 235, y: 180 }, { x: 235, y: 295 }],
      ];
    case 'c':
      return [
        [{ x: 235, y: 200 }, { x: 190, y: 180 }, { x: 150, y: 230 }, { x: 190, y: 290 }, { x: 235, y: 280 }],
      ];
    case 'e':
      return [
        [{ x: 155, y: 235 }, { x: 240, y: 235 }, { x: 225, y: 180 }, { x: 175, y: 185 }, { x: 155, y: 240 }, { x: 185, y: 290 }, { x: 235, y: 280 }],
      ];
    case 'h':
      return [
        [{ x: 150, y: 110 }, { x: 150, y: 295 }],
        [{ x: 150, y: 210 }, { x: 195, y: 180 }, { x: 235, y: 200 }, { x: 235, y: 295 }],
      ];
    case 'i':
      return [
        [{ x: 200, y: 190 }, { x: 200, y: 295 }],
        [{ x: 200, y: 150 }], // dot
      ];
    case 'l':
      return [
        [{ x: 195, y: 110 }, { x: 195, y: 295 }],
      ];
    case 'n':
      return [
        [{ x: 150, y: 185 }, { x: 150, y: 295 }],
        [{ x: 150, y: 210 }, { x: 195, y: 180 }, { x: 235, y: 200 }, { x: 235, y: 295 }],
      ];
    case 'o':
      return [
        [{ x: 195, y: 180 }, { x: 150, y: 230 }, { x: 195, y: 290 }, { x: 240, y: 230 }, { x: 195, y: 180 }],
      ];
    case 'r':
      return [
        [{ x: 155, y: 185 }, { x: 155, y: 295 }],
        [{ x: 155, y: 215 }, { x: 200, y: 180 }, { x: 235, y: 195 }],
      ];
    case 's':
      return [
        [{ x: 225, y: 195 }, { x: 190, y: 180 }, { x: 160, y: 205 }, { x: 225, y: 255 }, { x: 200, y: 290 }, { x: 155, y: 280 }],
      ];
    case 't':
      return [
        [{ x: 195, y: 130 }, { x: 195, y: 285 }, { x: 220, y: 290 }],
        [{ x: 160, y: 185 }, { x: 235, y: 185 }],
      ];
    case 'y':
      return [
        [{ x: 155, y: 185 }, { x: 195, y: 275 }],
        [{ x: 235, y: 185 }, { x: 160, y: 350 }], // descender
      ];
    case '1':
      return [
        [{ x: 170, y: 145 }, { x: 200, y: 110 }],
        [{ x: 200, y: 110 }, { x: 200, y: 295 }],
        [{ x: 160, y: 295 }, { x: 240, y: 295 }],
      ];
    case '2':
      return [
        [{ x: 150, y: 140 }, { x: 195, y: 110 }, { x: 240, y: 140 }, { x: 230, y: 190 }, { x: 145, y: 295 }, { x: 245, y: 295 }],
      ];
    case '!':
      return [
        [{ x: 200, y: 110 }, { x: 200, y: 240 }],
        [{ x: 200, y: 285 }],
      ];
    case '?':
      return [
        [{ x: 160, y: 145 }, { x: 200, y: 110 }, { x: 235, y: 145 }, { x: 220, y: 190 }, { x: 195, y: 220 }, { x: 195, y: 245 }],
        [{ x: 195, y: 285 }],
      ];
    case '.':
      return [
        [{ x: 200, y: 288 }],
      ];
    default:
      // Generic simple handwriting representation
      return [
        [{ x: 160, y: 130 }, { x: 160, y: 290 }],
        [{ x: 160, y: 200 }, { x: 240, y: 200 }],
        [{ x: 240, y: 130 }, { x: 240, y: 290 }],
      ];
  }
}

/**
 * Creates an empty project structure
 */
export function createNewProject(
  name: string = 'My Handwriting',
  description: string = 'Personal handwritten font project created on InkType.',
  author: string = 'You'
): FontProject {
  const characters: Record<string, CharacterData> = {};

  for (const def of ALL_CHARACTERS) {
    characters[def.char] = {
      char: def.char,
      unicode: def.unicode,
      category: def.category,
      strokes: [],
      qualityStatus: 'empty',
    };
  }

  return {
    id: `font_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    description,
    author,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    updatedAt: 'Just now',
    characters,
    status: 'draft',
    characterCount: 0,
    completionPercentage: 0,
  };
}

/**
 * Initial sample project "Shashi Handwriting" populated with characters to test instantly
 */
export function createInitialSampleProject(): FontProject {
  const project = createNewProject(
    'Shashi Handwriting',
    'Casual everyday ink strokes with organic character variations and natural slant.',
    'Shashi K.'
  );

  // Populate key characters
  const sampleChars = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'L', 'O', 'P', 'R', 'S', 'T', 'a', 'c', 'e', 'h', 'i', 'l', 'n', 'o', 'r', 's', 't', 'y', '1', '2', '!', '?', '.'];
  let count = 0;

  for (const char of sampleChars) {
    if (project.characters[char]) {
      const strokes = generateSampleStrokesForChar(char);
      project.characters[char].strokes = strokes;
      project.characters[char].qualityStatus = 'good';
      project.characters[char].qualityFeedback = 'Looks great.';
      // Add natural alternate variation for 'a', 'e', 't'
      if (['a', 'e', 't'].includes(char)) {
        project.characters[char].variants = [
          generateSampleStrokesForChar(char).map((s) => s.map((pt) => ({ x: pt.x + 3, y: pt.y - 2 }))),
        ];
      }
      count++;
    }
  }

  project.characterCount = count;
  project.completionPercentage = Math.round((count / ALL_CHARACTERS.length) * 100);
  project.status = 'draft';

  return project;
}

/**
 * Second pre-populated showcase font project "Architect Monoline"
 */
export function createArchitectSampleProject(): FontProject {
  const project = createNewProject(
    'Architect Monoline',
    'Crisp blueprint-inspired lettering with geometric letterforms and technical precision.',
    'Studio Arch'
  );

  const sampleChars = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'L', 'O', 'P', 'R', 'S', 'T', '1', '2'];
  let count = 0;

  for (const char of sampleChars) {
    if (project.characters[char]) {
      project.characters[char].strokes = generateSampleStrokesForChar(char);
      project.characters[char].qualityStatus = 'good';
      project.characters[char].qualityFeedback = 'Clean geometric alignment.';
      count++;
    }
  }

  project.characterCount = count;
  project.completionPercentage = Math.round((count / ALL_CHARACTERS.length) * 100);
  return project;
}

export const COMMUNITY_FONTS: import('../types').CommunityFont[] = [
  {
    id: 'cf-1',
    name: "Sarah's Wedding Font",
    creator: 'Sarah Jenkins',
    story: "Created from my grandmother's handwritten recipe cards for our wedding stationery.",
    category: 'Calligraphy',
    previewText: 'Together with our families, we invite you to celebrate.',
    downloads: 1420,
    fontFamily: 'Caveat',
  },
  {
    id: 'cf-2',
    name: "Arjun's Journal Font",
    creator: 'Arjun Rao',
    story: 'My everyday quick handwriting. Now I can type notes that still feel uniquely mine.',
    category: 'Casual',
    previewText: 'Ideas only matter when you bring them into the light.',
    downloads: 3840,
    fontFamily: 'Nanum Pen Script',
  },
  {
    id: 'cf-3',
    name: "Maya's Art Font",
    creator: 'Maya Lin',
    story: 'Every letter is slightly different with subtle playful flourishes and organic texture.',
    category: 'Artistic',
    previewText: 'Color is a power which directly influences the soul.',
    downloads: 2190,
    fontFamily: 'Caveat',
  },
  {
    id: 'cf-4',
    name: 'Architect Draft Mono',
    creator: 'Marcus Vance',
    story: 'Crisp blueprint lettering inspired by thirty years of drafting and architectural sketches.',
    category: 'Minimal',
    previewText: 'Form follows function — that has been misunderstood.',
    downloads: 5120,
    fontFamily: 'Nanum Pen Script',
  },
  {
    id: 'cf-5',
    name: 'Vintage Ink Signature',
    creator: 'Elena Rostova',
    story: 'Fountain pen ink strokes digitized with high-resolution edge dynamics.',
    category: 'Vintage',
    previewText: 'Yours faithfully, across miles and memory.',
    downloads: 1870,
    fontFamily: 'Caveat',
  },
  {
    id: 'cf-6',
    name: 'Little Leo Notes',
    creator: 'David & Leo (Age 7)',
    story: "Preserved our seven-year-old son's first complete alphabet as a permanent family keepsake.",
    category: 'Playful',
    previewText: 'Today we found a butterfly with blue wings in the garden!',
    downloads: 980,
    fontFamily: 'Nanum Pen Script',
  },
];

export interface TypographyGuide {
  id: string;
  title: string;
  category: string;
  readTime: string;
  summary: string;
  content: string;
}

export const TYPOGRAPHY_GUIDES: TypographyGuide[] = [
  {
    id: 'what-is-a-font',
    title: 'What exactly is a font vs. a typeface?',
    category: 'Foundations',
    readTime: '3 min read',
    summary: 'Understanding the classic distinction between a typeface (the visual design) and a font (the downloadable delivery mechanism).',
    content: `Think of a typeface like a musical song, and a font like the MP3 file that delivers it. 
    
    A typeface is the artistic design of the letters, numbers, and symbols — their curves, weight, baseline, and overall personality. A font, on the other hand, is the actual digital file (such as a .ttf or .otf file) that your computer loads to render those letterforms on your screen or in print.
    
    When you write on TypeMe, your hand creates the unique typeface, and TypeMe compiles it into an installable digital font.`,
  },
  {
    id: 'serif-vs-sans-serif',
    title: 'Serif vs. Sans Serif: How Finishing Strokes Alter Tone',
    category: 'Style & History',
    readTime: '4 min read',
    summary: 'Why tiny decorative strokes carry centuries of literary tradition and how clean sans strokes revolutionized modern interfaces.',
    content: `Serifs are the small finishing feet and decorative projections at the ends of letter strokes. Originating in Roman stone carvings, serif typefaces naturally convey authority, literary heritage, and warmth.
    
    Sans serif (from the French 'sans', meaning without) removes these finishing feet. Emerging in the 19th century and perfected by mid-century modernists, sans serif fonts project clarity, directness, and contemporary elegance.
    
    Handwriting bridges both worlds: natural handwriting often has natural entry and exit pen flicks that function like organic serifs.`,
  },
  {
    id: 'what-is-a-glyph',
    title: 'What is a glyph? Anatomy of digital characters',
    category: 'Technical',
    readTime: '3 min read',
    summary: 'A glyph is an individual visual representation of a character within a font file.',
    content: `While a character is an abstract concept (like the letter 'A' or the number '7'), a glyph is the specific visual drawing of that character.
    
    In advanced typography, a single character can have multiple glyphs: standard 'a', small caps 'A', or handwriting alternate 'a₁'. When TypeMe builds your font, each stroke you draw is mapped to a glyph index with bounding boxes and side bearings.`,
  },
  {
    id: 'kerning-and-spacing',
    title: 'Kerning & Optical Letter Spacing Explained',
    category: 'Craftsmanship',
    readTime: '4 min read',
    summary: 'Why the empty space between letters is just as crucial as the ink strokes themselves.',
    content: `Typography is the architecture of white space. Kerning refers to the adjustment of space between two specific adjacent characters (such as 'AV' or 'To') so they look optically balanced rather than mechanically spaced.
    
    In handwriting fonts, organic spacing is essential. Characters like 'y' have descenders that sweep under following letters, and tall ascenders like 'l' and 'h' need optical breathing room.`,
  },
  {
    id: 'natural-handwriting-alternates',
    title: 'Why natural handwriting alternates make fonts authentic',
    category: 'Advanced TypeMe',
    readTime: '4 min read',
    summary: 'Eliminating the "mechanical clone" effect through OpenType contextual alternates.',
    content: `When a human writes the word 'banana', neither of the three 'a's looks identical. The pen pressure fluctuates, the slant shifts by half a degree, and the loop varies.
    
    Standard digital fonts repeat the identical glyph every time. By providing variants (like a₁, a₂, a₃), TypeMe allows OpenType-compatible applications to alternate glyphs dynamically, recreating the authentic visual rhythm of a handwritten letter.`,
  },
  {
    id: 'how-brands-use-handwriting',
    title: 'How modern brands use custom handwriting typography',
    category: 'Design Strategy',
    readTime: '5 min read',
    summary: 'From artisanal packaging to personal creator brands, handwriting cuts through corporate monotony.',
    content: `In an era of hyper-clean, AI-generated imagery and uniform sans-serif logos, human imperfection has become a luxury. 
    
    Specialty roasteries, boutique fashion houses, independent authors, and lifestyle creators use custom handwriting fonts to signal authenticity, craft, and human care. Your personal handwriting font gives your brand an instant, uncopyable identity.`,
  },
];

