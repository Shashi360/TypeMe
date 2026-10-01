import { Stroke, QualityStatus } from '../types';

export interface QualityAnalysis {
  status: QualityStatus;
  feedback: string;
  pointCount: number;
  strokeCount: number;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export function analyzeCharacterStrokes(
  strokes: Stroke[],
  canvasWidth: number = 400,
  canvasHeight: number = 400
): QualityAnalysis {
  if (!strokes || strokes.length === 0) {
    return {
      status: 'empty',
      feedback: 'No strokes drawn yet.',
      pointCount: 0,
      strokeCount: 0,
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    };
  }

  let totalPoints = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    totalPoints += stroke.length;
    for (const point of stroke) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }

  // If very few points or strokes
  if (totalPoints < 4 || strokes.length === 0) {
    return {
      status: 'error',
      feedback: "We couldn't detect enough handwriting. Please try again.",
      pointCount: totalPoints,
      strokeCount: strokes.length,
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    };
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const marginX = Math.min(minX, canvasWidth - maxX);
  const marginY = Math.min(minY, canvasHeight - maxY);

  // Check if stroke is too close to canvas edge (less than 4% margin)
  const edgeThreshold = Math.min(canvasWidth, canvasHeight) * 0.035;
  if (marginX < edgeThreshold || marginY < edgeThreshold) {
    return {
      status: 'warning',
      feedback: 'Your character is very close to the edge. Try centering it slightly for balanced glyph spacing.',
      pointCount: totalPoints,
      strokeCount: strokes.length,
      bounds: { minX, minY, maxX, maxY, width, height },
    };
  }

  // Check if stroke is too small (< 18% of canvas height/width, except for punctuation like period/comma)
  const minDimension = Math.min(canvasWidth, canvasHeight);
  if (width < minDimension * 0.12 && height < minDimension * 0.12) {
    return {
      status: 'warning',
      feedback: 'Try writing a little larger so your letters scale crisply.',
      pointCount: totalPoints,
      strokeCount: strokes.length,
      bounds: { minX, minY, maxX, maxY, width, height },
    };
  }

  return {
    status: 'good',
    feedback: 'Looks great. Crisp proportions and well positioned on the baseline.',
    pointCount: totalPoints,
    strokeCount: strokes.length,
    bounds: { minX, minY, maxX, maxY, width, height },
  };
}
