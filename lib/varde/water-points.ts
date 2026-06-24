// Client access to curated water points, backed by MongoDB through the
// /api/water-points route handler. This replaces the former direct Overpass API
// call: the route returns this exact WaterPoint[] shape, so the client just
// fetches and forwards. Tag classification / parsing now lives server-side.

// String enum (wire values unchanged) so call sites reference members instead
// of magic strings. The values are what the API serialises and the map reads.
export enum WaterPointKind {
  DrinkingWater = "drinking_water",
  WaterPoint = "water_point",
  Tap = "tap",
  Fountain = "fountain",
  Spring = "spring",
  Other = "other",
}

// The water sub-kinds offered in the map filter, in display order. WaterPoint /
// Other are reachable by the classifier but don't occur in the current dataset,
// so they're omitted from the filter UI.
export const WATER_FILTER_KINDS: readonly WaterPointKind[] = [
  WaterPointKind.DrinkingWater,
  WaterPointKind.Spring,
  WaterPointKind.Tap,
  WaterPointKind.Fountain,
];

export type WaterPoint = {
  /** OSM node id — stable across requests, used as React/feature key. */
  id: number;
  kind: WaterPointKind;
  lng: number;
  lat: number;
  name?: string;
  operator?: string;
  /** `drinking_water=yes|no` tag — undefined means unknown. */
  drinkable?: boolean;
  fee?: boolean;
  seasonal?: boolean;
  openingHours?: string;
};

/** [west, south, east, north] — matches MapLibre's LngLatBounds order. */
export type Bbox = readonly [number, number, number, number];

/**
 * Fetch water points within `bbox` from the MongoDB-backed API. The bbox is
 * passed as query params; the route runs the GeoJSON geo query against the
 * `points_of_interest` collection and returns ready-to-render WaterPoints.
 */
export async function fetchWaterPoints(
  bbox: Bbox,
  categories: readonly string[],
  signal?: AbortSignal,
): Promise<WaterPoint[]> {
  const [west, south, east, north] = bbox;
  const qs = new URLSearchParams({
    w: String(west),
    s: String(south),
    e: String(east),
    n: String(north),
    categories: categories.join(","),
  });
  const res = await fetch(`/api/water-points?${qs.toString()}`, { signal });
  // Bare message — the page's overlay already prefixes "Points d'eau : ".
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as WaterPoint[];
}

export const KIND_LABEL: Record<WaterPointKind, string> = {
  [WaterPointKind.DrinkingWater]: "Point d'eau potable",
  [WaterPointKind.WaterPoint]: "Point d'eau",
  [WaterPointKind.Tap]: "Robinet",
  [WaterPointKind.Fountain]: "Fontaine",
  [WaterPointKind.Spring]: "Source",
  [WaterPointKind.Other]: "Eau (OSM)",
};
