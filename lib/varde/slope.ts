// Two distinct slope color scales — the D− side gets its own ramp because
// hard descents are a real risk for trail runners, not just a cosmetic mirror.

type RGB = readonly [number, number, number];

// Uphill: green → yellow → orange → red, saturating at 30 %.
const UP_STOPS: ReadonlyArray<RGB> = [
  [126, 168, 116],
  [214, 198, 92],
  [212, 140, 56],
  [196, 64, 40],
];

// Downhill: cyan → blue → indigo → violet, saturating at 30 %.
const DOWN_STOPS: ReadonlyArray<RGB> = [
  [120, 188, 196],
  [70, 140, 200],
  [86, 92, 196],
  [120, 60, 168],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(c1: RGB, c2: RGB, t: number): string {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}

export function slopeColor(grade: number): string {
  const stops = grade >= 0 ? UP_STOPS : DOWN_STOPS;
  const t = Math.min(1, Math.abs(grade) / 30);
  const seg = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  return mix(stops[i], stops[i + 1], seg - i);
}
