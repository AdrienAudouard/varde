// Pure domain logic that turns OSM water points into curated POIs anchored to a
// route. A water point becomes a POI only when it sits within `thresholdM` of
// the path; its km mark is the route distance of the nearest projected foot.
//
// No React, no I/O — the route geometry and the raw points come in as args and
// a `Poi[]` comes out, so `buildSegments` can consume the merged trace.

import type { Poi, RoutePoint } from "@/lib/varde/data";
import { projectPointOnSegment } from "@/lib/varde/geo";
import { KIND_LABEL, type WaterPoint } from "@/lib/varde/overpass";

// How close (metres) a water point must be to the path to make the plan.
const DEFAULT_THRESHOLD_M = 150;

// OSM clusters water nodes (multiple fountains within tens of metres of each
// other), which would otherwise produce a string of ~0 km / 0 h micro-segments
// in the autonomy plan. We collapse points whose km marks fall within this
// window down to a single best representative.
const MERGE_KM = 0.2;

function buildNote(wp: WaterPoint): string {
  const parts: string[] = [];
  if (wp.operator) parts.push(`Opéré par ${wp.operator}`);
  if (wp.openingHours) parts.push(`Horaires : ${wp.openingHours}`);
  if (parts.length > 0) return parts.join(" · ");
  return wp.kind === "spring"
    ? "Source naturelle — fiabilité à vérifier."
    : "Point d'eau OpenStreetMap.";
}

function toPoi(wp: WaterPoint, km: number, offsetM: number): Poi {
  return {
    id: `osm-${wp.id}`,
    type: wp.kind === "spring" ? "source" : "eau",
    name: wp.name ?? KIND_LABEL[wp.kind],
    km,
    offset: offsetM,
    fiable: wp.kind !== "spring" && wp.drinkable !== false,
    note: buildNote(wp),
  };
}

// Greedily collapse POIs whose km marks are within MERGE_KM, keeping the best
// one per cluster: prefer a reliable point, then the one closest to the path.
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

export function waterPointsToPois(
  route: readonly RoutePoint[],
  waterPoints: readonly WaterPoint[],
  thresholdM = DEFAULT_THRESHOLD_M,
): Poi[] {
  if (route.length < 2) return [];
  const thresholdKm = thresholdM / 1000;
  const candidates: Poi[] = [];

  for (const wp of waterPoints) {
    let bestOffsetKm = Infinity;
    let bestKm = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const { offsetKm, t } = projectPointOnSegment(wp, a, b);
      if (offsetKm < bestOffsetKm) {
        bestOffsetKm = offsetKm;
        bestKm = a.dist + (b.dist - a.dist) * t;
      }
    }
    if (bestOffsetKm <= thresholdKm) {
      candidates.push(toPoi(wp, bestKm, Math.round(bestOffsetKm * 1000)));
    }
  }

  return dedupeNearby(candidates);
}
