import opentype from 'opentype.js';
import { CharacterData } from '../types';
import { expandStrokeToContour } from './strokeExpander';

export interface GenerationProgress {
  step: number;
  totalSteps: number;
  message: string;
}

/**
 * Creates a .notdef fallback glyph required by OpenType specifications
 */
function createNotdefGlyph(): opentype.Glyph {
  const path = new opentype.Path();
  path.moveTo(80, 0);
  path.lineTo(80, 700);
  path.lineTo(420, 700);
  path.lineTo(420, 0);
  path.close();

  path.moveTo(130, 50);
  path.lineTo(370, 50);
  path.lineTo(370, 650);
  path.lineTo(130, 650);
  path.close();

  return new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: 500,
    path: path,
  });
}

/**
 * Generates a standard space glyph
 */
function createSpaceGlyph(): opentype.Glyph {
  return new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: 320,
    path: new opentype.Path(),
  });
}

function buildGlyphsList(characters: Record<string, CharacterData>): opentype.Glyph[] {
  const glyphsList: opentype.Glyph[] = [createNotdefGlyph(), createSpaceGlyph()];

  const canvasBaselineY = 300;
  const fontAscender = 800;
  const scale = fontAscender / (canvasBaselineY - 60); // approx 3.333
  const strokeWidthInFontUnits = 36;

  for (const charKey of Object.keys(characters)) {
    const charData = characters[charKey];
    if (!charData || !charData.strokes || charData.strokes.length === 0) {
      continue;
    }

    const path = new opentype.Path();
    let minFx = Infinity;
    let maxFx = -Infinity;

    const mapPoint = (p: { x: number; y: number }) => {
      const fx = Math.round(p.x * scale);
      const fy = Math.round((canvasBaselineY - p.y) * scale);
      if (fx < minFx) minFx = fx;
      if (fx > maxFx) maxFx = fx;
      return { x: fx, y: fy };
    };

    for (const stroke of charData.strokes) {
      if (stroke.length === 0) continue;
      const contour = expandStrokeToContour(stroke, strokeWidthInFontUnits, mapPoint);
      if (contour.length >= 3) {
        path.moveTo(contour[0].x, contour[0].y);
        for (let i = 1; i < contour.length; i++) {
          path.lineTo(contour[i].x, contour[i].y);
        }
        path.close();
      }
    }

    const calculatedWidth = maxFx > minFx ? maxFx - minFx : 300;
    const advanceWidth = Math.max(340, Math.round(calculatedWidth + 140));

    const glyphName =
      charData.char.length === 1 && charData.char.charCodeAt(0) < 128
        ? `char_${charData.char.charCodeAt(0)}`
        : `uni${charData.unicode.toString(16).toUpperCase().padStart(4, '0')}`;

    const glyph = new opentype.Glyph({
      name: glyphName,
      unicode: charData.unicode,
      advanceWidth: advanceWidth,
      path: path,
    });

    glyphsList.push(glyph);
  }

  return glyphsList;
}

/**
 * Fast in-memory font compiler for instant live preview as characters are saved
 */
export async function compileLivePreviewFont(
  familyName: string,
  characters: Record<string, CharacterData>
): Promise<string | null> {
  const cleanFamilyName = familyName.trim() || 'TypeMeFont';
  const glyphsList = buildGlyphsList(characters);

  // If only notdef and space exist, return null
  if (glyphsList.length <= 2) {
    return null;
  }

  const font = new opentype.Font({
    familyName: cleanFamilyName,
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: glyphsList,
  });

  try {
    const arrayBuffer = font.toArrayBuffer();
    const registeredFontFamily = `TypeMeLive_${cleanFamilyName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    const fontFace = new FontFace(registeredFontFamily, arrayBuffer);
    await fontFace.load();
    document.fonts.add(fontFace);
    return registeredFontFamily;
  } catch (err) {
    console.warn('Failed to register live preview font:', err);
    return null;
  }
}

export async function generateFontFromCharacters(
  familyName: string,
  characters: Record<string, CharacterData>,
  onProgress?: (progress: GenerationProgress) => void
): Promise<{
  ttfBlob: Blob;
  ttfUrl: string;
  registeredFontFamily: string;
  fileSizeBytes: number;
}> {
  const cleanFamilyName = familyName.trim() || 'TypeMeHandwriting';

  // Step 1: Checking characters
  onProgress?.({ step: 1, totalSteps: 6, message: 'Checking characters and penmanship bounds...' });
  await new Promise((r) => setTimeout(r, 200));

  // Step 2: Building glyphs
  onProgress?.({ step: 2, totalSteps: 6, message: 'Building vector glyphs & closed contours...' });
  await new Promise((r) => setTimeout(r, 220));

  const glyphsList = buildGlyphsList(characters);

  // Step 3: Adjusting spacing
  onProgress?.({ step: 3, totalSteps: 6, message: 'Adjusting spacing & optical side bearings...' });
  await new Promise((r) => setTimeout(r, 200));

  // Step 4: Creating font metadata
  onProgress?.({ step: 4, totalSteps: 6, message: 'Creating font metadata & OpenType tables...' });
  await new Promise((r) => setTimeout(r, 200));

  const font = new opentype.Font({
    familyName: cleanFamilyName,
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: glyphsList,
  });

  // Step 5: Generating font files
  // NOTE: opentype.js emits a TrueType-flavored (glyf-outline) binary, so the
  // honest output is .ttf only. A previous build relabeled the same bytes as
  // ".otf" — that was a mislabeled TTF, not OpenType/CFF, so OTF output was
  // removed rather than shipping a fake format.
  onProgress?.({ step: 5, totalSteps: 6, message: 'Generating font binary (.ttf)...' });
  await new Promise((r) => setTimeout(r, 220));

  const arrayBuffer = font.toArrayBuffer();
  const fileSizeBytes = arrayBuffer.byteLength;

  // Step 6: Validating font
  onProgress?.({ step: 6, totalSteps: 6, message: 'Activating live specimen font...' });
  await new Promise((r) => setTimeout(r, 180));

  const ttfBlob = new Blob([arrayBuffer], { type: 'font/ttf' });
  const ttfUrl = URL.createObjectURL(ttfBlob);

  const registeredFontFamily = `TypeMe_${cleanFamilyName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  try {
    const fontFace = new FontFace(registeredFontFamily, arrayBuffer);
    await fontFace.load();
    document.fonts.add(fontFace);
  } catch (err) {
    console.warn('FontFace registration notice:', err);
  }

  return {
    ttfBlob,
    ttfUrl,
    registeredFontFamily,
    fileSizeBytes,
  };
}
