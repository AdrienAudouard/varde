// Presentation constants for the topo map: camera defaults, basemap style URL,
// terrain config, and the hardcoded color tokens MapLibre's paint spec needs
// (it can't read CSS variables). Also holds the helpers that parse/consume these
// presentation values (`maptilerKeyFromStyleUrl`, `osmWaterColorExpr`), so they
// live on the components side alongside the tokens rather than in `lib/`.

import type { ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { PoiType } from "@/lib/varde/data";
import { WaterPointKind } from "@/lib/varde/water-points";

// Initial camera when no trace is loaded: centred on the French Alps
// (Tarentaise). Zoom 10 keeps the resting zoom comfortably above WATER_MIN_ZOOM
// (the terrain setup nudges the actual zoom ~0.02 below the requested value), so
// the water-point overlay shows straight away (the request: display POIs even
// without a GPX). Once a trace is imported the fitBounds effect frames it.
export const DEFAULT_VIEW = {
  center: [6.5, 45.6] as [number, number],
  zoom: 10,
};

// Min zoom at which the OSM water-point overlay renders and is queried. Below
// this a viewport can span much of the dataset, so we neither draw nor fetch it.
export const WATER_MIN_ZOOM = 9;

// The MapTiler Landscape style. Override with NEXT_PUBLIC_MAPTILER_STYLE_URL in
// .env.local once the key is moved off the client bundle.
export const STYLE_URL =
  process.env.NEXT_PUBLIC_MAPTILER_STYLE_URL ??
  "https://api.maptiler.com/maps/landscape-v4/style.json?key=WXsPov0z1sCuQAGizPZ5";

// 3D terrain relief. MapTiler serves elevation as a raster-DEM (terrain-rgb-v2);
// we reuse the API key already present in the style URL rather than adding a
// second env var. Realistic exaggeration keeps peak heights true to life so the
// relief is usable for identifying actual summits, not just eye-candy.
export const TERRAIN_EXAGGERATION = 1.2;

// Pulls the `?key=` out of the MapTiler style URL so the DEM source can share
// it. Returns null for a self-hosted style with no key — terrain is then
// skipped and the map still renders flat.
export function maptilerKeyFromStyleUrl(styleUrl: string): string | null {
  try {
    return new URL(styleUrl).searchParams.get("key");
  } catch {
    return null;
  }
}

// Hardcoded color tokens — MapLibre's paint spec can't read CSS variables.
// These mirror :root[data-theme="papier"] in globals.css. If the dark theme
// (Nuit) is reintroduced, swap these via getComputedStyle on mount.
export const ACCENT = "#c25a2e";
export const ACCENT_DARK_INK = "#2a2317";
export const TERMINUS_START = "#3f7a52";
export const MARKER_STROKE = "#f7f1e5";

// "You are here" dot — a GPS blue, deliberately outside the warm route/POI
// palette so the user's live position reads as a distinct, recognisable marker.
export const USER_LOC_COLOR = "#2f6df0";

export const POI_COLOR: Record<PoiType, string> = {
  eau: "var(--poi-eau)",
  source: "var(--poi-eau)",
  ravito: "var(--poi-ravito)",
  refuge: "var(--poi-refuge)",
};

export const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

// OSM water-point dot colors — tuned to read as a quieter, secondary layer
// alongside the user's curated POIs (which use POI_COLOR above). Springs get
// a lighter cyan to signal "less reliable"; every other tag uses the same blue.
export const WATER_DOT_COLOR = "#2b6f9e"; // drinking water (generic) — blue
export const SPRING_DOT_COLOR = "#56b4e0"; // spring — lighter cyan, signals "less reliable"
export const TAP_DOT_COLOR = "#2f9e8f"; // tap — teal
export const FOUNTAIN_DOT_COLOR = "#6f7fc4"; // fountain — indigo-blue

// Shared MapLibre `circle-color` expression for both the halo and the dot
// layers, so the two stay in lockstep on future kind tweaks. Built as a
// factory rather than a frozen constant because MapLibre's paint specs
// occasionally mutate the arrays they're given. Match cases come from the
// WaterPointKind enum (no magic strings); unmatched kinds fall back to blue.
export const osmWaterColorExpr = (): ExpressionSpecification => [
  "match",
  ["get", "kind"],
  WaterPointKind.Spring,
  SPRING_DOT_COLOR,
  WaterPointKind.Tap,
  TAP_DOT_COLOR,
  WaterPointKind.Fountain,
  FOUNTAIN_DOT_COLOR,
  WATER_DOT_COLOR,
];
