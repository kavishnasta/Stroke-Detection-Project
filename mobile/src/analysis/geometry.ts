import { Landmark } from '../types/landmarks';

export function distance(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 };
}

export function perpendicularDistanceToLine(point: Landmark, lineA: Landmark, lineB: Landmark): number {
  const numerator =
    Math.abs((lineB.y - lineA.y) * point.x - (lineB.x - lineA.x) * point.y + lineB.x * lineA.y - lineB.y * lineA.x);
  const denominator = Math.sqrt((lineB.y - lineA.y) ** 2 + (lineB.x - lineA.x) ** 2);
  return denominator === 0 ? 0 : numerator / denominator;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
