import { Point, Stroke } from '../types';

export interface ContourPoint {
  x: number;
  y: number;
}

/**
 * Expands a polyline stroke into a closed contour polygon with round end-caps.
 * All coordinates are converted to target font coordinate space.
 */
export function expandStrokeToContour(
  stroke: Stroke,
  strokeWidth: number = 24,
  mapPoint: (p: Point) => { x: number; y: number }
): ContourPoint[] {
  if (!stroke || stroke.length === 0) return [];

  const mapped = stroke.map(mapPoint);

  // If it's a single dot or tiny tap
  if (mapped.length === 1) {
    const p = mapped[0];
    const r = strokeWidth / 2;
    const circle: ContourPoint[] = [];
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      circle.push({
        x: Math.round(p.x + Math.cos(angle) * r),
        y: Math.round(p.y + Math.sin(angle) * r),
      });
    }
    return circle;
  }

  // Remove duplicate adjacent points
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < mapped.length; i++) {
    const pt = mapped[i];
    if (i === 0) {
      points.push(pt);
    } else {
      const prev = points[points.length - 1];
      const dist = Math.hypot(pt.x - prev.x, pt.y - prev.y);
      if (dist > 1.5) {
        points.push(pt);
      }
    }
  }

  if (points.length < 2) {
    const p = points[0] || mapped[0];
    const r = strokeWidth / 2;
    const circle: ContourPoint[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      circle.push({
        x: Math.round(p.x + Math.cos(angle) * r),
        y: Math.round(p.y + Math.sin(angle) * r),
      });
    }
    return circle;
  }

  const radius = strokeWidth / 2;
  const leftSide: ContourPoint[] = [];
  const rightSide: ContourPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    let dx = 0;
    let dy = 0;

    if (i === 0) {
      dx = points[1].x - curr.x;
      dy = points[1].y - curr.y;
    } else if (i === points.length - 1) {
      dx = curr.x - points[i - 1].x;
      dy = curr.y - points[i - 1].y;
    } else {
      const d1x = curr.x - points[i - 1].x;
      const d1y = curr.y - points[i - 1].y;
      const d2x = points[i + 1].x - curr.x;
      const d2y = points[i + 1].y - curr.y;
      dx = d1x + d2x;
      dy = d1y + d2y;
    }

    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    leftSide.push({
      x: Math.round(curr.x + nx * radius),
      y: Math.round(curr.y + ny * radius),
    });
    rightSide.push({
      x: Math.round(curr.x - nx * radius),
      y: Math.round(curr.y - ny * radius),
    });
  }

  // End cap (semicircle at the finish)
  const lastPt = points[points.length - 1];
  const prevLastPt = points[points.length - 2];
  const endAngle = Math.atan2(lastPt.y - prevLastPt.y, lastPt.x - prevLastPt.x);
  const endCap: ContourPoint[] = [];
  const capSteps = 6;
  for (let step = 1; step <= capSteps; step++) {
    const theta = endAngle - Math.PI / 2 + (step / (capSteps + 1)) * Math.PI;
    endCap.push({
      x: Math.round(lastPt.x + Math.cos(theta) * radius),
      y: Math.round(lastPt.y + Math.sin(theta) * radius),
    });
  }

  // Start cap (semicircle at the start)
  const firstPt = points[0];
  const nextFirstPt = points[1];
  const startAngle = Math.atan2(firstPt.y - nextFirstPt.y, firstPt.x - nextFirstPt.x);
  const startCap: ContourPoint[] = [];
  for (let step = 1; step <= capSteps; step++) {
    const theta = startAngle - Math.PI / 2 + (step / (capSteps + 1)) * Math.PI;
    startCap.push({
      x: Math.round(firstPt.x + Math.cos(theta) * radius),
      y: Math.round(firstPt.y + Math.sin(theta) * radius),
    });
  }

  // Assemble full closed clockwise contour: left -> endCap -> right (reversed) -> startCap
  const fullContour: ContourPoint[] = [
    ...leftSide,
    ...endCap,
    ...rightSide.reverse(),
    ...startCap,
  ];

  return fullContour;
}
