// Pure GeoJSON feature builders for the topo map's route overlay. These depend
// only on the domain model (RoutePoint) and slope helpers — strictly lib-level,
// no presentation tokens or MapLibre imports — so they stay reusable and
// SSR-safe.

import type { Feature, LineString } from "geojson";
import { gradeAt, type RoutePoint } from "@/lib/varde/data";
import { slopeColor } from "@/lib/varde/slope";

export function routeCoords(route: readonly RoutePoint[]): number[][] {
  return route.map((p) => [p.lng, p.lat]);
}

// Slope-coloured segment features for the route overlay. Derived from the
// loaded route (empty until a trace is imported).
export function buildSlopeFeatures(
  route: readonly RoutePoint[],
): Array<Feature<LineString, { color: string }>> {
  const out: Array<Feature<LineString, { color: string }>> = [];
  const stepN = 3;
  for (let i = 0; i < route.length - stepN; i += stepN) {
    const a = route[i];
    const b = route[Math.min(route.length - 1, i + stepN)];
    out.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      properties: { color: slopeColor(gradeAt(route, i + 1)) },
    });
  }
  return out;
}
