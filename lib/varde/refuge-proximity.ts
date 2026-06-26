// Pure domain logic that turns refuges into curated POIs anchored to a route, so
// the autonomy plan can treat a refuge as a resupply stop. Mirrors
// water-proximity.ts. Only water-bearing refuges are projected: a shelter with
// no water must not close a segment / reset the water-need gauge.
//
// No React, no I/O — the route geometry and the refuges come in as args and a
// `Poi[]` comes out, so `buildSegments` can consume the merged trace.

import type { Poi, RoutePoint } from "@/lib/varde/data";
import { projectPointOnSegment } from "@/lib/varde/geo";
import { KIND_LABEL, RefugeKind, type Refuge } from "@/lib/varde/refuges";

// How close (metres) a refuge must be to the path to make the plan.
const DEFAULT_THRESHOLD_M = 150;

// Collapse refuges whose km marks fall within this window down to a single best
// representative, so a cluster doesn't produce a string of micro-segments.
const MERGE_KM = 0.2;

function buildNote(r: Refuge): string {
  const parts: string[] = [];
  if (typeof r.beds === "number") parts.push(`${r.beds} places`);
  if (typeof r.alt === "number") parts.push(`${r.alt} m`);
  if (r.status) parts.push(r.status);
  return parts.length > 0 ? parts.join(" · ") : KIND_LABEL[r.kind];
}

function toPoi(r: Refuge, km: number, offsetM: number): Poi {
  return {
    id: `refuge-${r.id}`,
    type: "refuge",
    name: r.name ?? KIND_LABEL[r.kind],
    km,
    offset: offsetM,
    // A staffed refuge is a dependable water/shelter stop; an unstaffed shelter
    // that merely happens to have water is less certain.
    fiable: r.kind === RefugeKind.Guarded,
    note: buildNote(r),
  };
}

// Greedily collapse POIs whose km marks are within MERGE_KM, keeping the best one
// per cluster: prefer a reliable point, then the one closest to the path.
function dedupeNearby(pois: readonly Poi[]): Poi[] {
  if (pois.length === 0) return [];
  const sorted = [...pois].sort((a, b) => a.km - b.km);
  const out: Poi[] = [];
  let cluster = sorted[0];
  let clusterStartKm = sorted[0].km;
  const isBetter = (candidate: Poi, current: Poi) => {
    if (candidate.fiable !== current.fiable) return candidate.fiable;
    return candidate.offset < current.offset;
  };
  for (let i = 1; i < sorted.length; i++) {
    const poi = sorted[i];
    if (poi.km - clusterStartKm <= MERGE_KM) {
      if (isBetter(poi, cluster)) cluster = poi;
    } else {
      out.push(cluster);
      cluster = poi;
      clusterStartKm = poi.km;
    }
  }
  out.push(cluster);
  return out;
}

export function refugesToPois(
  route: readonly RoutePoint[],
  refuges: readonly Refuge[],
  thresholdM = DEFAULT_THRESHOLD_M,
): Poi[] {
  if (route.length < 2) return [];
  const thresholdKm = thresholdM / 1000;
  const candidates: Poi[] = [];

  for (const r of refuges) {
    // Only water-bearing refuges become resupply stops in the plan.
    if (!r.hasWater) continue;
    let bestOffsetKm = Infinity;
    let bestKm = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const { offsetKm, t } = projectPointOnSegment(r, a, b);
      if (offsetKm < bestOffsetKm) {
        bestOffsetKm = offsetKm;
        bestKm = a.dist + (b.dist - a.dist) * t;
      }
    }
    if (bestOffsetKm <= thresholdKm) {
      candidates.push(toPoi(r, bestKm, Math.round(bestOffsetKm * 1000)));
    }
  }

  return dedupeNearby(candidates);
}
