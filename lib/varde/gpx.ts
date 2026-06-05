// GPX parser for the import flow. Hand-rolled on the browser DOMParser
// (`application/xml` — no XXE, no external entities) so we add no dependency.
// Produces a `Trace` with cumulative distances computed from the geometry; POIs
// are not derived from GPX yet, so `pois` is always empty.

import type { RoutePoint, Trace } from "@/lib/varde/data";

// Above this many points the per-mousemove nearest-point scan and the 0.05km
// stats sampler get expensive, so we stride-decimate. Decimation happens AFTER
// cumulative distance is computed on full-resolution points (and always keeps
// the last point), so total distance stays exact; it only slightly reduces D+
// fidelity on very dense tracks — acceptable for v1.
const MAX_POINTS = 5000;

export function parseGpx(xml: string): Trace {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  if (doc.querySelector("parsererror") || doc.documentElement.nodeName !== "gpx") {
    throw new Error("Fichier GPX invalide");
  }

  // Track points across all <trk>/<trkseg> in document order; fall back to
  // route points (<rtept>) when the file has no track. Real GPX files carry a
  // default xmlns ("http://www.topografix.com/GPX/1/1"), so we match by local
  // name in ANY namespace — this also handles the rarer prefixed form
  // (<gpx:trkpt>) that a bare querySelector would miss.
  let nodes = Array.from(doc.getElementsByTagNameNS("*", "trkpt"));
  if (nodes.length === 0) nodes = Array.from(doc.getElementsByTagNameNS("*", "rtept"));
  console.log("[varde/gpx] matched nodes", {
    root: doc.documentElement.nodeName,
    trkptOrRtept: nodes.length,
  });

  const points: Array<{ lng: number; lat: number; ele: number }> = [];
  for (const node of nodes) {
    const latAttr = node.getAttribute("lat");
    const lngAttr = node.getAttribute("lon"); // GPX names it "lon"
    // Missing attrs become NaN (not Number(null) === 0, which would survive the
    // finite check and place a bogus point at the equator).
    const lat = latAttr == null ? NaN : Number(latAttr);
    const lng = lngAttr == null ? NaN : Number(lngAttr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const eleText = node.getElementsByTagNameNS("*", "ele")[0]?.textContent;
    const ele = Number(eleText);
    points.push({ lng, lat, ele: Number.isFinite(ele) ? ele : 0 });
  }

  if (points.length < 2) {
    throw new Error("Trace trop courte (moins de 2 points)");
  }

  // Cumulative distance on full-resolution points.
  const full: RoutePoint[] = [{ ...points[0], dist: 0 }];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const dist = full[i - 1].dist + haversineKm(prev, cur);
    full.push({ ...cur, dist });
  }

  return { route: decimate(full), pois: [] };
}

function decimate(route: RoutePoint[]): RoutePoint[] {
  if (route.length <= MAX_POINTS) return route;
  const stride = Math.ceil(route.length / MAX_POINTS);
  const out: RoutePoint[] = [];
  for (let i = 0; i < route.length; i += stride) out.push(route[i]);
  const last = route[route.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

// Great-circle distance in km between two lng/lat points.
const EARTH_KM = 6371;
function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}
