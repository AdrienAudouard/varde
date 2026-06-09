// Browser-only glue for the terrain slope overlay: a MapLibre custom protocol
// that turns the MapTiler terrain-RGB DEM into slope-angle-shaded raster tiles
// on the fly, plus the source/layer setup. The per-pixel maths is the pure
// `colorizeSlopeRGBA` in lib/varde/terrain-slope.ts; this file only does the
// browser plumbing (fetch → canvas → ImageBitmap) and MapLibre registration, so
// it must never be imported on the server (topo-map.tsx is `ssr: false`).

import maplibregl, {
  type AddProtocolAction,
  type Map as MaplibreMap,
  type RasterTileSource,
} from "maplibre-gl";
import { STYLE_URL, maptilerKeyFromStyleUrl } from "@/components/varde/topo-map-style";
import {
  colorizeSlopeRGBA,
  DEFAULT_SLOPE_RANGE,
  type SlopeRange,
} from "@/lib/varde/terrain-slope";

export const TERRAIN_SLOPE_SCHEME = "varde-slope";
export const TERRAIN_SLOPE_SOURCE = "terrain-slope";
export const TERRAIN_SLOPE_LAYER = "terrain-slope-fill";

// Overlay translucency — lets the basemap's relief and contours read through
// the slope colours. Per-pixel alpha stays binary, so this is the single knob
// for overall opacity.
const SLOPE_OPACITY = 0.5;

// The overlay is only meaningful zoomed into terrain; below this the DEM is too
// coarse and we'd colour huge areas pointlessly. Also bounds per-tile compute.
const SLOPE_MIN_ZOOM = 9;

// MapTiler terrain-RGB ("terrain-rgb-v2") facts, taken from its tiles.json:
// @2x WebP tiles (decode to 512²), Mapbox encoding, world coverage, max z14.
// Hardcoded rather than fetched so the source/layer can be added synchronously
// (no race where a toggle fires before an async tiles.json resolves). Reuses the
// same key as setupTerrain's DEM — no second env var.
const DEM_TILE_SIZE = 512;
const DEM_MAX_ZOOM = 14;
const MERCATOR_MAX_LAT = 85.0511;

function demTileTemplate(): string | null {
  const key = maptilerKeyFromStyleUrl(STYLE_URL);
  if (!key) return null;
  return `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`;
}

// Custom-scheme tiles template with the active grade-% range baked into the
// query. Encoding the range in the URL is what lets a range change invalidate
// MapLibre's tile cache: new lo/hi → new URLs → re-request → the handler
// re-colours, instead of serving stale tiles.
function slopeTilesTemplate(range: SlopeRange): string {
  return `${TERRAIN_SLOPE_SCHEME}://{z}/{x}/{y}?lo=${range.min}&hi=${range.max}`;
}

function parseSlopeTile(
  url: string,
): { z: number; x: number; y: number; lo: number; hi: number } | null {
  // varde-slope://z/x/y?lo=..&hi=.. — MapLibre substitutes {z}/{x}/{y} with the
  // canonical integer coords before calling the handler; lo/hi carry the range.
  const m = url.match(/:\/\/(\d+)\/(\d+)\/(\d+)/);
  if (!m) return null;
  const lo = Number(url.match(/[?&]lo=([\d.]+)/)?.[1]);
  const hi = Number(url.match(/[?&]hi=([\d.]+)/)?.[1]);
  return {
    z: Number(m[1]),
    x: Number(m[2]),
    y: Number(m[3]),
    lo: Number.isFinite(lo) ? lo : DEFAULT_SLOPE_RANGE.min,
    hi: Number.isFinite(hi) ? hi : DEFAULT_SLOPE_RANGE.max,
  };
}

// Fetch the DEM tile, decode elevation, colour by slope angle, hand MapLibre a
// ready ImageBitmap. Fetching the bytes ourselves and decoding via a Blob keeps
// the canvas untainted, so getImageData never throws a SecurityError (MapTiler
// serves the tiles CORS-open — the same dataset setupTerrain already loads).
const loadSlopeTile: AddProtocolAction = async (params, abortController) => {
  const coords = parseSlopeTile(params.url);
  const template = demTileTemplate();
  if (!coords || !template) {
    throw new Error(`terrain-slope: cannot resolve DEM tile for ${params.url}`);
  }
  const demUrl = template
    .replace("{z}", String(coords.z))
    .replace("{x}", String(coords.x))
    .replace("{y}", String(coords.y));

  const resp = await fetch(demUrl, { signal: abortController.signal });
  if (!resp.ok) {
    throw new Error(`terrain-slope: DEM tile ${coords.z}/${coords.x}/${coords.y} → ${resp.status}`);
  }
  const bitmap = await createImageBitmap(await resp.blob());
  const { width, height } = bitmap;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("terrain-slope: no 2d context");
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const src = ctx.getImageData(0, 0, width, height).data;
  const shaded = colorizeSlopeRGBA(src, width, height, coords.z, coords.y, coords.lo, coords.hi);
  // Copy into a context-created ImageData (its buffer is correctly typed) rather
  // than `new ImageData(shaded, ...)`, which trips the strict ArrayBuffer types.
  const outImage = ctx.createImageData(width, height);
  outImage.data.set(shaded);
  ctx.putImageData(outImage, 0, 0);

  return { data: canvas.transferToImageBitmap() };
};

// `addProtocol` writes to a process-global registry, so registration must be
// idempotent — React StrictMode mounts the map twice in dev. Never call
// `removeProtocol` on unmount: a remount would race a teardown.
let registered = false;
export function registerTerrainSlopeProtocol(): void {
  if (registered) return;
  registered = true;
  maplibregl.addProtocol(TERRAIN_SLOPE_SCHEME, loadSlopeTile);
}

// Adds the slope raster source + layer (hidden by default). Inserted before
// `route-casing` so the shading sits above the basemap/3D terrain but below all
// the route/POI/hover layers. Synchronous, so a toggle right after `load` finds
// the layer present. Skipped (overlay unavailable) if the style carries no key.
export function addTerrainSlopeLayer(map: MaplibreMap): void {
  if (!demTileTemplate()) return;
  if (map.getSource(TERRAIN_SLOPE_SOURCE)) return;

  map.addSource(TERRAIN_SLOPE_SOURCE, {
    type: "raster",
    tiles: [slopeTilesTemplate(DEFAULT_SLOPE_RANGE)],
    tileSize: DEM_TILE_SIZE,
    minzoom: 0,
    // Stop at the DEM's real max zoom; MapLibre overzooms the z14 parent beyond.
    maxzoom: DEM_MAX_ZOOM,
    bounds: [-180, -MERCATOR_MAX_LAT, 180, MERCATOR_MAX_LAT],
  });

  const beforeId = map.getLayer("route-casing") ? "route-casing" : undefined;
  map.addLayer(
    {
      id: TERRAIN_SLOPE_LAYER,
      type: "raster",
      source: TERRAIN_SLOPE_SOURCE,
      minzoom: SLOPE_MIN_ZOOM,
      layout: { visibility: "none" },
      // `linear` smooths the cool→hot gradient; the in/out-of-range edges get a
      // soft anti-aliased boundary rather than a hard pixel step.
      paint: { "raster-opacity": SLOPE_OPACITY, "raster-resampling": "linear" },
    },
    beforeId,
  );
}

// Re-render the overlay for a new grade-% range. Swapping the source's tiles
// template (range baked into the URL) makes MapLibre drop the stale tiles and
// re-request — the handler then re-colours them. No-op until the source exists.
// Debounce calls upstream: each change reloads every visible tile.
export function setTerrainSlopeRange(map: MaplibreMap, range: SlopeRange): void {
  const source = map.getSource(TERRAIN_SLOPE_SOURCE) as RasterTileSource | undefined;
  source?.setTiles([slopeTilesTemplate(range)]);
}
