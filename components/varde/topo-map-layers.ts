// MapLibre source + layer setup for the topo map, run once inside the map's
// `load` callback. Split into explicit ordered steps (NOT a config-array loop)
// because layer insertion order is load-bearing: route → slope → terminus →
// seg-hi → hover → osm-water keeps the highlight/hover/water layers stacked on
// top of the route line.

import type { Map as MaplibreMap } from "maplibre-gl";
import {
  ACCENT,
  ACCENT_DARK_INK,
  EMPTY_FC,
  MARKER_STROKE,
  STYLE_URL,
  TERMINUS_START,
  TERRAIN_EXAGGERATION,
  USER_LOC_COLOR,
  maptilerKeyFromStyleUrl,
  osmWaterColorExpr,
} from "@/components/varde/topo-map-style";

// 3D terrain: drape every layer over a MapTiler elevation DEM so the route and
// POIs follow the ground and a Ctrl/right-click-drag tilt reveals real relief.
// Skipped when the style URL carries no key.
export function setupTerrain(map: MaplibreMap): void {
  const maptilerKey = maptilerKeyFromStyleUrl(STYLE_URL);
  if (!maptilerKey) return;
  map.addSource("terrain-dem", {
    type: "raster-dem",
    url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${maptilerKey}`,
  });
  map.setTerrain({ source: "terrain-dem", exaggeration: TERRAIN_EXAGGERATION });
  map.setSky({
    "sky-color": "#bcd4ec",
    "horizon-color": "#e7eef6",
    "fog-color": "#f7f1e5",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.5,
  });
}

// Trace-dependent sources, created unconditionally and seeded empty in insertion
// order route → slope → terminus → seg-hi → hover → user-loc so the highlight/
// hover/position layers stay on top. The `[trace]` effect fills these when a
// trace loads; `user-loc` is driven separately by the geolocate button.
export function addTraceLayers(map: MaplibreMap): void {
  map.addSource("route", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "route-casing",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": MARKER_STROKE, "line-width": 9, "line-opacity": 0.92 },
  });
  map.addLayer({
    id: "route-main",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ACCENT, "line-width": 5 },
  });

  map.addSource("slope", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "slope-line",
    type: "line",
    source: "slope",
    layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
    paint: { "line-color": ["get", "color"], "line-width": 6.5 },
  });

  map.addSource("terminus", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "terminus-dot",
    type: "circle",
    source: "terminus",
    paint: {
      "circle-radius": 9,
      "circle-color": [
        "match",
        ["get", "kind"],
        "start",
        TERMINUS_START,
        "finish",
        ACCENT,
        "#000",
      ],
      "circle-stroke-color": MARKER_STROKE,
      "circle-stroke-width": 3,
    },
  });

  map.addSource("seg-hi", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "seg-hi-line",
    type: "line",
    source: "seg-hi",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ACCENT_DARK_INK,
      "line-width": 5,
      "line-opacity": 0.32,
      "line-dasharray": [1, 9],
    },
  });

  map.addSource("hover-pt", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "hover-halo",
    type: "circle",
    source: "hover-pt",
    paint: { "circle-radius": 9, "circle-color": ACCENT, "circle-opacity": 0.22 },
  });
  map.addLayer({
    id: "hover-dot",
    type: "circle",
    source: "hover-pt",
    paint: {
      "circle-radius": 4.5,
      "circle-color": ACCENT,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
  });

  // "You are here" marker, populated when the geolocate button resolves a fix.
  // Added last so the live position sits above the route/hover layers.
  map.addSource("user-loc", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "user-loc-halo",
    type: "circle",
    source: "user-loc",
    paint: { "circle-radius": 12, "circle-color": USER_LOC_COLOR, "circle-opacity": 0.18 },
  });
  map.addLayer({
    id: "user-loc-dot",
    type: "circle",
    source: "user-loc",
    paint: {
      "circle-radius": 6,
      "circle-color": USER_LOC_COLOR,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2.5,
    },
  });
}

// OSM water points layer (populated by the Overpass fetch effect). Added last so
// it sits above the route and hover layers.
export function addWaterLayers(map: MaplibreMap): void {
  map.addSource("osm-water", { type: "geojson", data: EMPTY_FC });
  map.addLayer({
    id: "osm-water-halo",
    type: "circle",
    source: "osm-water",
    minzoom: 9,
    paint: {
      "circle-radius": 9,
      "circle-color": osmWaterColorExpr(),
      "circle-opacity": 0.22,
    },
  });
  map.addLayer({
    id: "osm-water-dot",
    type: "circle",
    source: "osm-water",
    minzoom: 9,
    paint: {
      "circle-radius": 4.5,
      "circle-color": osmWaterColorExpr(),
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 1.5,
    },
  });
}
