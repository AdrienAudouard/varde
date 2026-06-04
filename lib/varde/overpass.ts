// Overpass API client — fetches OpenStreetMap water points within a bbox.
// Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
//
// We surface five OSM features as "water points" relevant to a trail planner:
//   amenity=drinking_water           — public drinking fountain (most common)
//   amenity=water_point              — designated water tap (often campsites)
//   man_made=drinking_fountain       — alternate fountain tag
//   man_made=water_tap               — generic outdoor tap
//   natural=spring                   — natural spring (treat as unreliable)
//
// The Overpass response is parsed into a small, typed structure; we keep the
// raw tags on each result so the UI can show whatever's there without us
// having to enumerate every OSM convention.

const OVERPASS_URL =
  process.env.NEXT_PUBLIC_OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

export type WaterPointKind =
  | "drinking_water"
  | "water_point"
  | "tap"
  | "spring"
  | "other";

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
  /** Original OSM tags, escaped at render time. */
  tags: Readonly<Record<string, string>>;
};

/** [west, south, east, north] — matches MapLibre's LngLatBounds order. */
export type Bbox = readonly [number, number, number, number];

type OverpassNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OverpassResponse = {
  // Optional + unknown because we can't trust the parsed body shape until the
  // `Array.isArray` guard in `fetchWaterPoints` has run.
  elements?: ReadonlyArray<OverpassNode | { type: string }>;
};

function buildQuery(bbox: Bbox): string {
  const [west, south, east, north] = bbox;
  // Overpass QL bbox is (south, west, north, east).
  const b = `(${south},${west},${north},${east})`;
  return `[out:json][timeout:25];
(
  node["amenity"="drinking_water"]${b};
  node["amenity"="water_point"]${b};
  node["man_made"="drinking_fountain"]${b};
  node["man_made"="water_tap"]${b};
  node["natural"="spring"]${b};
);
out body;`;
}

function classify(tags: Record<string, string>): WaterPointKind {
  if (tags.amenity === "drinking_water") return "drinking_water";
  if (tags.amenity === "water_point") return "water_point";
  if (tags.man_made === "drinking_fountain") return "drinking_water";
  if (tags.man_made === "water_tap") return "tap";
  if (tags.natural === "spring") return "spring";
  return "other";
}

function boolTag(v: string | undefined): boolean | undefined {
  if (v === "yes") return true;
  if (v === "no") return false;
  return undefined;
}

export async function fetchWaterPoints(
  bbox: Bbox,
  signal?: AbortSignal,
): Promise<WaterPoint[]> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    body: "data=" + encodeURIComponent(buildQuery(bbox)),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = (await res.json()) as OverpassResponse;
  // Defensive against a 200 with an unexpected shape (e.g. a rate-limit HTML
  // page that happens to parse as JSON, or a future Overpass schema change).
  if (!Array.isArray(json.elements)) {
    throw new Error("Overpass: unexpected response shape");
  }
  const out: WaterPoint[] = [];
  for (const el of json.elements) {
    if (el.type !== "node") continue;
    const node = el as OverpassNode;
    const tags = node.tags ?? {};
    out.push({
      id: node.id,
      kind: classify(tags),
      lng: node.lon,
      lat: node.lat,
      name: tags.name,
      operator: tags.operator,
      drinkable: boolTag(tags["drinking_water"]),
      fee: boolTag(tags.fee),
      seasonal: tags.seasonal === "yes",
      openingHours: tags["opening_hours"],
      tags,
    });
  }
  return out;
}

export const KIND_LABEL: Record<WaterPointKind, string> = {
  drinking_water: "Point d'eau potable",
  water_point: "Point d'eau",
  tap: "Robinet",
  spring: "Source",
  other: "Eau (OSM)",
};
