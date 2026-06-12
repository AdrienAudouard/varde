// Deterministic topo-map + elevation-profile geometry for the landing visuals.
// Ported from the Varde app's own generators (data / topomap) — the same shape
// the source `landing.js` produced, but as pure data so server components can
// `.map()` it straight to SVG JSX (no DOM, no `document`, no PRNG at render).
//
// All constants are computed once at module scope (as the original IIFE did),
// so importing this is cheap and the output is byte-stable across renders.

export type PoiType = "eau" | "ravito" | "refuge" | "source";

export interface Poi {
  id: string;
  type: PoiType;
  km: number;
  offset: number;
  fiable: boolean;
}

export interface RoutePoint {
  x: number;
  y: number;
  dist: number;
  ele: number;
}

export interface ContourRing {
  d: string;
  bold: boolean;
}

// ---- deterministic PRNG (mulberry32) ----
function rng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- elevation profile model ----
export const TOTAL_KM = 34.2;
const START_ELE = 640;
const BUMPS: ReadonlyArray<[number, number, number]> = [
  [5.5, 4.2, 520],
  [12.0, 3.0, 280],
  [18.5, 4.8, 640],
  [26.0, 2.6, 240],
  [30.5, 2.2, 300],
];

export function eleAt(km: number): number {
  let e = START_ELE;
  for (const [c, w, g] of BUMPS) e += g * Math.exp(-Math.pow((km - c) / (w * 0.5), 2));
  e += -8 * km + 30 * Math.sin(km * 0.9);
  return e;
}

// ---- 2D route (catmull-rom through control points) ----
const CTRL: ReadonlyArray<[number, number]> = [
  [120, 560], [180, 470], [250, 430], [300, 350], [360, 300],
  [430, 270], [470, 200], [540, 170], [610, 210], [650, 290],
  [700, 330], [760, 300], [820, 360], [840, 450], [800, 520],
  [740, 560], [690, 520], [640, 560], [600, 620], [520, 600],
  [470, 540], [410, 560], [360, 620], [300, 600], [250, 560],
];

function catmull(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  t: number,
): [number, number] {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function buildSmooth(
  pts: ReadonlyArray<readonly [number, number]>,
  perSeg: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < perSeg; j++) out.push(catmull(p0, p1, p2, p3, j / perSeg));
  }
  out.push([...pts[pts.length - 1]]);
  return out;
}

const SMOOTH = buildSmooth(CTRL, 14);

const LEN_2D: number[] = [0];
for (let i = 1; i < SMOOTH.length; i++) {
  const dx = SMOOTH[i][0] - SMOOTH[i - 1][0];
  const dy = SMOOTH[i][1] - SMOOTH[i - 1][1];
  LEN_2D.push(LEN_2D[i - 1] + Math.hypot(dx, dy));
}
const TOTAL_2D = LEN_2D[LEN_2D.length - 1];

export const ROUTE: ReadonlyArray<RoutePoint> = SMOOTH.map((p, i) => {
  const dist = (LEN_2D[i] / TOTAL_2D) * TOTAL_KM;
  return { x: p[0], y: p[1], dist, ele: eleAt(dist) };
});

const PX_PER_KM = TOTAL_2D / TOTAL_KM;

export interface PointAtKm {
  x: number;
  y: number;
  ele: number;
  tx: number;
  ty: number;
}

export function pointAtKm(km: number): PointAtKm {
  const clamped = Math.max(0, Math.min(TOTAL_KM, km));
  let lo = 0;
  let hi = ROUTE.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ROUTE[mid].dist < clamped) lo = mid + 1;
    else hi = mid;
  }
  const a = ROUTE[Math.max(0, lo - 1)];
  const b = ROUTE[lo];
  const span = b.dist - a.dist || 1e-6;
  const f = (clamped - a.dist) / span;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    ele: a.ele + (b.ele - a.ele) * f,
    tx: b.x - a.x,
    ty: b.y - a.y,
  };
}

export interface PoiMapPos {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

export function poiMapPos(km: number, offsetM: number): PoiMapPos {
  const p = pointAtKm(km);
  const len = Math.hypot(p.tx, p.ty) || 1;
  const off = (offsetM / 1000) * PX_PER_KM;
  const nx = -p.ty / len;
  const ny = p.tx / len;
  return { x: p.x + nx * off, y: p.y + ny * off, anchorX: p.x, anchorY: p.y };
}

export function gradeAt(i: number): number {
  const a = ROUTE[Math.max(0, i - 1)];
  const b = ROUTE[Math.min(ROUTE.length - 1, i + 1)];
  const dele = b.ele - a.ele;
  const ddist = (b.dist - a.dist) * 1000;
  return ddist === 0 ? 0 : (dele / ddist) * 100;
}

// ---- POIs ----
export const POIS: ReadonlyArray<Poi> = [
  { id: "p1", type: "eau", km: 2.4, offset: 30, fiable: true },
  { id: "p2", type: "ravito", km: 6.1, offset: 80, fiable: true },
  { id: "p3", type: "source", km: 9.8, offset: 45, fiable: false },
  { id: "p4", type: "refuge", km: 14.7, offset: 60, fiable: true },
  { id: "p5", type: "eau", km: 20.3, offset: 25, fiable: true },
  { id: "p6", type: "ravito", km: 27.4, offset: 95, fiable: true },
  { id: "p7", type: "eau", km: 31.6, offset: 35, fiable: true },
];

export const POI_COLOR: Record<PoiType, string> = {
  eau: "var(--poi-eau)",
  ravito: "var(--poi-ravito)",
  refuge: "var(--poi-refuge)",
  source: "var(--poi-eau)",
};

// ---- slope color ----
type Rgb = readonly [number, number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(c1: Rgb, c2: Rgb, t: number): string {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(
    lerp(c1[1], c2[1], t),
  )},${Math.round(lerp(c1[2], c2[2], t))})`;
}

const SLOPE_UP: ReadonlyArray<Rgb> = [
  [126, 168, 116],
  [214, 198, 92],
  [212, 140, 56],
  [196, 64, 40],
];
const SLOPE_DOWN: ReadonlyArray<Rgb> = [
  [120, 188, 196],
  [70, 140, 200],
  [86, 92, 196],
  [120, 60, 168],
];

export function slopeColor(grade: number): string {
  const g = Math.abs(grade);
  const stops = grade >= 0 ? SLOPE_UP : SLOPE_DOWN;
  const t = Math.min(1, g / 30);
  const seg = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(seg));
  return mix(stops[i], stops[i + 1], seg - i);
}

// ---- contours (deterministic ring paths) ----
function ringPath(
  cx: number,
  cy: number,
  baseR: number,
  rough: number,
  seedFn: () => number,
): string {
  const N = 46;
  const pts: Array<[number, number]> = [];
  const amp = baseR * rough;
  const phase = seedFn() * Math.PI * 2;
  const k1 = 2 + Math.floor(seedFn() * 2);
  const k2 = 4 + Math.floor(seedFn() * 3);
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r =
      baseR + amp * (0.6 * Math.sin(k1 * a + phase) + 0.4 * Math.sin(k2 * a + phase * 1.7));
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86]);
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  return d + "Z";
}

const PEAKS: ReadonlyArray<[number, number, number, number, number]> = [
  [470, 210, 9, 17, 11],
  [330, 330, 6, 16, 23],
  [650, 290, 7, 16, 31],
  [800, 470, 6, 18, 44],
  [180, 520, 5, 19, 57],
  [560, 600, 5, 18, 66],
];

function buildContours(): ContourRing[][] {
  const groups: ContourRing[][] = [];
  for (const [cx, cy, n, step, seed] of PEAKS) {
    const r = rng(seed);
    const rings: ContourRing[] = [];
    for (let i = 0; i < n; i++) {
      rings.push({ d: ringPath(cx, cy, 22 + i * step, 0.1 + r() * 0.06, r), bold: i % 5 === 0 });
    }
    groups.push(rings.reverse());
  }
  return groups;
}

export const CONTOURS: ReadonlyArray<ReadonlyArray<ContourRing>> = buildContours();

// ---- path-string builders for the route + profile ----
export function routeD(): string {
  return "M" + ROUTE.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
}

export interface ProfileScale {
  xOf: (km: number) => number;
  yOf: (e: number) => number;
  minE: number;
  maxE: number;
  plotH: number;
  padT: number;
}

// Builds the x/y mappers + elevation bounds for a profile of the given box and
// padding. Pure: returns closures over the computed scale, no shared state.
export function profileScale(
  width: number,
  height: number,
  padL: number,
  padR: number,
  padT: number,
  padB: number,
): ProfileScale {
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const eles = ROUTE.map((p) => p.ele);
  const minE = Math.floor(Math.min(...eles) / 100) * 100 - 20;
  const maxE = Math.ceil(Math.max(...eles) / 100) * 100 + 20;
  return {
    xOf: (km) => padL + (km / TOTAL_KM) * plotW,
    yOf: (e) => padT + plotH - ((e - minE) / (maxE - minE)) * plotH,
    minE,
    maxE,
    plotH,
    padT,
  };
}

export function areaD(scale: ProfileScale): string {
  const { xOf, yOf, plotH, padT } = scale;
  const baseline = (padT + plotH).toFixed(1);
  let d = `M${xOf(0).toFixed(1)},${yOf(ROUTE[0].ele).toFixed(1)}`;
  for (const p of ROUTE) d += ` L${xOf(p.dist).toFixed(1)},${yOf(p.ele).toFixed(1)}`;
  d += ` L${xOf(TOTAL_KM).toFixed(1)},${baseline} L${xOf(0).toFixed(1)},${baseline} Z`;
  return d;
}

export function lineD(scale: ProfileScale): string {
  const { xOf, yOf } = scale;
  return "M" + ROUTE.map((p) => `${xOf(p.dist).toFixed(1)},${yOf(p.ele).toFixed(1)}`).join(" L");
}
