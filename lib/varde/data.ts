// Deterministic dataset for the Varde planning view.
// The route is a smoothed control polyline projected onto the SVG viewBox;
// every downstream view (map, profile, autonomy segments) derives from ROUTE,
// so geometry and altimetry stay coherent.

export type PoiType = "eau" | "source" | "ravito" | "refuge";

export type RoutePoint = {
  x: number;
  y: number;
  lng: number;
  lat: number;
  dist: number;
  ele: number;
};

export type LngLat = readonly [number, number];

export type Poi = {
  id: string;
  type: PoiType;
  name: string;
  km: number;
  offset: number;
  fiable: boolean;
  note: string;
};

export type SegBound = {
  km: number;
  name: string;
  type: "start" | "end" | PoiType;
};

export type Segment = {
  idx: number;
  from: SegBound;
  to: SegBound;
  dist: number;
  dplus: number;
  dminus: number;
  hours: number;
  water: number;
  depart: number;
  arrive: number;
};

export type LibraryItem = {
  id: string;
  name: string;
  dist: number;
  dplus: number;
  dminus: number;
  hours: number;
  water: number;
  stops: number;
  tag: string;
  active?: boolean;
};

export type PointAtKm = {
  x: number;
  y: number;
  ele: number;
  dist: number;
  tx: number;
  ty: number;
};

// Deterministic PRNG (mulberry32) — reused for contours and library mini-profiles.
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TOTAL_KM = 34.2;
const START_ELE = 640;

// [center_km, width_km, gain_m] — gaussian bumps stacked on a gentle descending slope.
const BUMPS: ReadonlyArray<readonly [number, number, number]> = [
  [5.5, 4.2, 520],
  [12.0, 3.0, 280],
  [18.5, 4.8, 640],
  [26.0, 2.6, 240],
  [30.5, 2.2, 300],
];

function eleAt(km: number): number {
  let e = START_ELE;
  for (const [c, w, g] of BUMPS) {
    e += g * Math.exp(-Math.pow((km - c) / (w * 0.5), 2));
  }
  e += -8 * km + 30 * Math.sin(km * 0.9);
  return e;
}

const CTRL: ReadonlyArray<readonly [number, number]> = [
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
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
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
  const last = pts[pts.length - 1];
  out.push([last[0], last[1]]);
  return out;
}

const smooth = buildSmooth(CTRL, 14);

const len2d: number[] = [0];
for (let i = 1; i < smooth.length; i++) {
  const dx = smooth[i][0] - smooth[i - 1][0];
  const dy = smooth[i][1] - smooth[i - 1][1];
  len2d.push(len2d[i - 1] + Math.hypot(dx, dy));
}
const total2d = len2d[len2d.length - 1];

// SVG viewBox dimensions used by both the placeholder map and the geo projection.
export const VIEWBOX_W = 1000;
export const VIEWBOX_H = 680;

// Geographic anchor for the (fictional) Tour des Crêtes — French Alps, near the
// Tarentaise valley. The SVG coordinate plane is mapped onto real geography so
// the MapLibre map renders the trace over plausible terrain.
const CENTER_LNG = 6.5;
const CENTER_LAT = 45.6;
// One SVG unit ≈ 10 meters on the ground. With the 1000×680 viewBox this gives
// a ~10 km × 6.8 km footprint, comfortable for a 34 km looping trail.
const METERS_PER_UNIT = 10;
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = 111_320 * Math.cos((CENTER_LAT * Math.PI) / 180);

export function svgToLngLat(x: number, y: number): LngLat {
  const dxMeters = (x - VIEWBOX_W / 2) * METERS_PER_UNIT;
  // SVG y grows downward; latitude grows upward — flip the sign.
  const dyMeters = (VIEWBOX_H / 2 - y) * METERS_PER_UNIT;
  return [
    CENTER_LNG + dxMeters / M_PER_DEG_LNG,
    CENTER_LAT + dyMeters / M_PER_DEG_LAT,
  ];
}

export const ROUTE: ReadonlyArray<RoutePoint> = smooth.map((p, i) => {
  const dist = (len2d[i] / total2d) * TOTAL_KM;
  const [lng, lat] = svgToLngLat(p[0], p[1]);
  return { x: p[0], y: p[1], lng, lat, dist, ele: eleAt(dist) };
});

// Bounding box of the route in [west, south, east, north] order — used by
// MapLibre's fitBounds to frame the initial view.
export const ROUTE_BOUNDS: readonly [number, number, number, number] = (() => {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of ROUTE) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  return [west, south, east, north];
})();

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
    dist: clamped,
    tx: b.x - a.x,
    ty: b.y - a.y,
  };
}

const pxPerKm = total2d / TOTAL_KM;

export function poiMapPos(km: number, offsetM: number) {
  const p = pointAtKm(km);
  const len = Math.hypot(p.tx, p.ty) || 1;
  const off = (offsetM / 1000) * pxPerKm;
  const nx = -p.ty / len;
  const ny = p.tx / len;
  return {
    x: p.x + nx * off,
    y: p.y + ny * off,
    anchorX: p.x,
    anchorY: p.y,
    ele: p.ele,
  };
}

// Geographic POI position: same perpendicular-offset logic, but projected onto
// lng/lat so the marker sits in the right place on the MapLibre map.
export function poiGeoPos(km: number, offsetM: number): {
  marker: LngLat;
  anchor: LngLat;
  ele: number;
} {
  const m = poiMapPos(km, offsetM);
  return {
    marker: svgToLngLat(m.x, m.y),
    anchor: svgToLngLat(m.anchorX, m.anchorY),
    ele: m.ele,
  };
}

export const POIS: ReadonlyArray<Poi> = [
  { id: "p1", type: "eau", name: "Fontaine du hameau", km: 2.4, offset: 30, fiable: true, note: "Robinet, débit constant" },
  { id: "p2", type: "ravito", name: "Épicerie de Vallon", km: 6.1, offset: 80, fiable: true, note: "Ouv. 8h–19h · eau, sucré, salé" },
  { id: "p3", type: "source", name: "Source du Col", km: 9.8, offset: 45, fiable: false, note: "À sec en été — à vérifier" },
  { id: "p4", type: "refuge", name: "Refuge des Crêtes", km: 14.7, offset: 60, fiable: true, note: "Gardé · eau, boissons, en-cas" },
  { id: "p5", type: "eau", name: "Ruisseau de la combe", km: 20.3, offset: 25, fiable: true, note: "Eau vive, à filtrer" },
  { id: "p6", type: "ravito", name: "Bar du village", km: 27.4, offset: 95, fiable: true, note: "Ouv. 7h–21h" },
  { id: "p7", type: "eau", name: "Lavoir", km: 31.6, offset: 35, fiable: true, note: "Eau non potable affichée" },
];

let dplusAccum = 0;
let dminusAccum = 0;
for (let i = 1; i < ROUTE.length; i++) {
  const d = ROUTE[i].ele - ROUTE[i - 1].ele;
  if (d > 0) dplusAccum += d;
  else dminusAccum += -d;
}

const WATER_TYPES = new Set<PoiType>(["eau", "ravito", "refuge", "source"]);
const stops = POIS.filter((p) => WATER_TYPES.has(p.type)).sort((a, b) => a.km - b.km);
const bounds: SegBound[] = [
  { km: 0, name: "Départ", type: "start" },
  ...stops.map((p): SegBound => ({ km: p.km, name: p.name, type: p.type })),
  { km: TOTAL_KM, name: "Arrivée", type: "end" },
];

function statsBetween(km0: number, km1: number) {
  let dp = 0;
  let dm = 0;
  let prev = pointAtKm(km0);
  const step = 0.05;
  for (let k = km0 + step; k <= km1; k += step) {
    const cur = pointAtKm(k);
    const d = cur.ele - prev.ele;
    if (d > 0) dp += d;
    else dm += -d;
    prev = cur;
  }
  return { dist: km1 - km0, dplus: dp, dminus: dm };
}

// Naismith-style pace model: flat speed + climbing penalty + light descent penalty.
const BASE_KMH = 7.2;
function segTime(dist: number, dp: number, dm: number): number {
  const flatH = dist / BASE_KMH;
  const climbH = (dp / 100) * (10 / 60);
  const descH = (dm / 100) * (3.5 / 60);
  return flatH + climbH + descH;
}

function waterNeed(hours: number): number {
  return hours * 0.6;
}

const segmentsAccum: Segment[] = [];
let clock = 8.0;
for (let i = 0; i < bounds.length - 1; i++) {
  const a = bounds[i];
  const b = bounds[i + 1];
  const s = statsBetween(a.km, b.km);
  const h = segTime(s.dist, s.dplus, s.dminus);
  const water = waterNeed(h);
  const arrive = clock + h;
  segmentsAccum.push({
    idx: i,
    from: a,
    to: b,
    dist: s.dist,
    dplus: s.dplus,
    dminus: s.dminus,
    hours: h,
    water,
    depart: clock,
    arrive,
  });
  clock = arrive;
}

export const SEGMENTS: ReadonlyArray<Segment> = segmentsAccum;
export const TOTAL_HOURS = clock - 8.0;

export function fmtTime(dec: number): string {
  const h = Math.floor(dec) % 24;
  const m = Math.round((dec - Math.floor(dec)) * 60);
  return String(h).padStart(2, "0") + "h" + String(m).padStart(2, "0");
}

export function fmtDur(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh + "h" + String(mm).padStart(2, "0");
}

export function gradeAt(i: number): number {
  const a = ROUTE[Math.max(0, i - 1)];
  const b = ROUTE[Math.min(ROUTE.length - 1, i + 1)];
  const dele = b.ele - a.ele;
  const ddist = (b.dist - a.dist) * 1000;
  return ddist === 0 ? 0 : (dele / ddist) * 100;
}

export const dplus = Math.round(dplusAccum);
export const dminus = Math.round(dminusAccum);
export const minEle = Math.min(...ROUTE.map((p) => p.ele));
export const maxEle = Math.max(...ROUTE.map((p) => p.ele));
export { pxPerKm };

export const LIBRARY: ReadonlyArray<LibraryItem> = [
  {
    id: "t1",
    name: "Tour des Crêtes",
    dist: 34.2,
    dplus,
    dminus,
    hours: TOTAL_HOURS,
    water: SEGMENTS.reduce((a, s) => Math.max(a, s.water), 0),
    stops: stops.length,
    tag: "En préparation",
    active: true,
  },
  { id: "t2", name: "Boucle du Lac noir", dist: 18.6, dplus: 760, dminus: 760, hours: 2.6, water: 1.1, stops: 2, tag: "Prête" },
  { id: "t3", name: "Traversée des estives", dist: 52.0, dplus: 2840, dminus: 2610, hours: 8.1, water: 2.0, stops: 5, tag: "Brouillon" },
  { id: "t4", name: "Sortie longue dimanche", dist: 26.4, dplus: 1180, dminus: 1180, hours: 3.4, water: 1.3, stops: 3, tag: "Prête" },
  { id: "t5", name: "Reco verticale", dist: 9.8, dplus: 1240, dminus: 240, hours: 2.2, water: 0.9, stops: 1, tag: "Brouillon" },
];
