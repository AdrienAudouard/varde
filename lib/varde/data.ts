// Domain layer for the Varde planning view.
//
// This module holds the *types* and the *trail-analysis logic* (altimetry,
// pace/water estimation, segment building) that every downstream view consumes.
// It deliberately ships NO route data: a trace is produced by GPX import at
// runtime and flows in through props. The analysis functions below are pure and
// take an explicit `route` so they stay testable and free of module state.

export type PoiType = "eau" | "source" | "ravito" | "refuge";

export type RoutePoint = {
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

export type PointAtKm = {
  dist: number;
  ele: number;
  lng: number;
  lat: number;
};

// A fully-resolved trace: the geometry plus its curated points of interest.
// Produced by GPX import (not yet wired); the planning view treats `null` as
// "no trace loaded" and renders its empty state.
export type Trace = {
  route: readonly RoutePoint[];
  pois: readonly Poi[];
};

// --- Geometry / altimetry analysis (domain layer, pure) --------------------
// These are dormant until GPX import lands: they operate on whatever route the
// importer produces. They take the route explicitly so there is no module state.

export function pointAtKm(route: readonly RoutePoint[], km: number): PointAtKm {
  if (route.length === 0) return { dist: 0, ele: 0, lng: 0, lat: 0 };
  const maxDist = route[route.length - 1].dist;
  const clamped = Math.max(0, Math.min(maxDist, km));
  let lo = 0;
  let hi = route.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (route[mid].dist < clamped) lo = mid + 1;
    else hi = mid;
  }
  const a = route[Math.max(0, lo - 1)];
  const b = route[lo];
  const span = b.dist - a.dist || 1e-6;
  const f = (clamped - a.dist) / span;
  return {
    dist: clamped,
    ele: a.ele + (b.ele - a.ele) * f,
    lng: a.lng + (b.lng - a.lng) * f,
    lat: a.lat + (b.lat - a.lat) * f,
  };
}

// Cumulative D+/D− between two km marks, sampled along the route.
export function statsBetween(route: readonly RoutePoint[], km0: number, km1: number) {
  let dp = 0;
  let dm = 0;
  let prev = pointAtKm(route, km0);
  const step = 0.05;
  for (let k = km0 + step; k <= km1; k += step) {
    const cur = pointAtKm(route, k);
    const d = cur.ele - prev.ele;
    if (d > 0) dp += d;
    else dm += -d;
    prev = cur;
  }
  return { dist: km1 - km0, dplus: dp, dminus: dm };
}

// Local grade (%) around route index `i`, using its neighbours.
export function gradeAt(route: readonly RoutePoint[], i: number): number {
  if (route.length < 2) return 0;
  const a = route[Math.max(0, i - 1)];
  const b = route[Math.min(route.length - 1, i + 1)];
  const dele = b.ele - a.ele;
  const ddist = (b.dist - a.dist) * 1000;
  return ddist === 0 ? 0 : (dele / ddist) * 100;
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

// POI types that count as a resupply / refill point and therefore close a segment.
const WATER_TYPES = new Set<PoiType>(["eau", "ravito", "refuge", "source"]);

// Walk start time used to seed each segment's running clock (08h00).
const DEPART_CLOCK = 8.0;

// Build the autonomy segments (departure → each water point → arrival) for a
// trace, computing distance / D+ / D− / duration / water / passage time per leg.
// Returns `[]` when there is no trace yet.
export function buildSegments(trace: Trace | null): Segment[] {
  if (!trace || trace.route.length < 2) return [];
  const { route, pois } = trace;
  const totalKm = route[route.length - 1].dist;

  const stops = pois.filter((p) => WATER_TYPES.has(p.type)).sort((a, b) => a.km - b.km);
  const bounds: SegBound[] = [
    { km: 0, name: "Départ", type: "start" },
    ...stops.map((p): SegBound => ({ km: p.km, name: p.name, type: p.type })),
    { km: totalKm, name: "Arrivée", type: "end" },
  ];

  const segments: Segment[] = [];
  let clock = DEPART_CLOCK;
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    const s = statsBetween(route, a.km, b.km);
    const hours = segTime(s.dist, s.dplus, s.dminus);
    const arrive = clock + hours;
    segments.push({
      idx: i,
      from: a,
      to: b,
      dist: s.dist,
      dplus: s.dplus,
      dminus: s.dminus,
      hours,
      water: waterNeed(hours),
      depart: clock,
      arrive,
    });
    clock = arrive;
  }
  return segments;
}

// --- Formatters ------------------------------------------------------------

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
