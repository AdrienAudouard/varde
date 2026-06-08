// Pure planar/great-circle geometry helpers for the planning view. Kept free of
// any React or module state so they stay trivially testable. Distances are in
// km unless a name says otherwise.

import type { RoutePoint } from "@/lib/varde/data";
import type { Bbox } from "@/lib/varde/overpass";

const EARTH_KM = 6371;
const TO_RAD = Math.PI / 180;

export type LngLatPoint = { lng: number; lat: number };

// Great-circle distance in km between two lng/lat points.
export function haversineKm(a: LngLatPoint, b: LngLatPoint): number {
  const dLat = (b.lat - a.lat) * TO_RAD;
  const dLng = (b.lng - a.lng) * TO_RAD;
  const lat1 = a.lat * TO_RAD;
  const lat2 = b.lat * TO_RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export type SegmentProjection = {
  /** Distance from the point to the nearest spot on the segment, in km. */
  offsetKm: number;
  /** Interpolation factor along the segment [0,1] of that nearest spot. */
  t: number;
};

// Projects `p` onto the segment a→b using a local planar approximation (lng is
// scaled by cos(lat) so a degree of longitude and latitude are comparable at
// this latitude). Returns the foot's clamped position factor and its distance.
// Planar is fine here: the segments are short and we only need a near-the-path
// threshold, not survey-grade accuracy.
export function projectPointOnSegment(
  p: LngLatPoint,
  a: LngLatPoint,
  b: LngLatPoint,
): SegmentProjection {
  const cosLat = Math.cos(a.lat * TO_RAD);
  const ax = a.lng * cosLat;
  const ay = a.lat;
  const bx = b.lng * cosLat;
  const by = b.lat;
  const px = p.lng * cosLat;
  const py = p.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));

  const footLng = a.lng + (b.lng - a.lng) * t;
  const footLat = a.lat + (b.lat - a.lat) * t;
  return { offsetKm: haversineKm(p, { lng: footLng, lat: footLat }), t };
}

// Axis-aligned bounds of a route, optionally padded outward by `padDeg` degrees
// so points just beyond the route's own extent (e.g. near endpoints) still fall
// inside the search box. Returns null for an empty route.
export function routeBbox(route: readonly RoutePoint[], padDeg = 0): Bbox | null {
  if (route.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of route) {
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
  }
  return [west - padDeg, south - padDeg, east + padDeg, north + padDeg];
}
