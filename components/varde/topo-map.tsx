"use client";

// MapLibre GL JS swap-in for the previous SVG placeholder.
// Renders the trace, slope overlay, selected-segment highlight, hover marker,
// and POI markers on top of a real cartographic basemap (MapTiler Landscape).
// All interaction contracts (hoverKm sync, selectedPoi, selectedSeg, slopeOn)
// match the previous component so the rest of the planning view is untouched.

import { useEffect, useRef } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
  type MapMouseEvent,
} from "maplibre-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  POIS,
  ROUTE,
  ROUTE_BOUNDS,
  SEGMENTS,
  gradeAt,
  pointAtKm,
  poiGeoPos,
  svgToLngLat,
  type Poi,
  type PoiType,
} from "@/lib/varde/data";
import { slopeColor } from "@/lib/varde/slope";

export type AutonomyMode = "panel" | "badges" | "table";

type TopoMapProps = {
  slopeOn: boolean;
  hoverKm: number | null;
  setHoverKm: (km: number | null) => void;
  selectedSeg: number | null;
  autonomyMode: AutonomyMode;
  selectedPoi: string | null;
  setSelectedPoi: (id: string | null) => void;
};

// The MapTiler Landscape style. Override with NEXT_PUBLIC_MAPTILER_STYLE_URL in
// .env.local once the key is moved off the client bundle.
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAPTILER_STYLE_URL ??
  "https://api.maptiler.com/maps/landscape-v4/style.json?key=WXsPov0z1sCuQAGizPZ5";

// Hardcoded color tokens — MapLibre's paint spec can't read CSS variables.
// These mirror :root[data-theme="papier"] in globals.css. If the dark theme
// (Nuit) is reintroduced, swap these via getComputedStyle on mount.
const ACCENT = "#c25a2e";
const ACCENT_DARK_INK = "#2a2317";
const TERMINUS_START = "#3f7a52";
const MARKER_STROKE = "#f7f1e5";

const POI_COLOR: Record<PoiType, string> = {
  eau: "var(--poi-eau)",
  source: "var(--poi-eau)",
  ravito: "var(--poi-ravito)",
  refuge: "var(--poi-refuge)",
};

const ROUTE_COORDS: number[][] = ROUTE.map((p) => [p.lng, p.lat]);

// Pre-compute slope segment features once at module load (deterministic).
const SLOPE_FEATURES: Array<Feature<LineString, { color: string }>> = (() => {
  const out: Array<Feature<LineString, { color: string }>> = [];
  const stepN = 3;
  for (let i = 0; i < ROUTE.length - stepN; i += stepN) {
    const a = ROUTE[i];
    const b = ROUTE[Math.min(ROUTE.length - 1, i + stepN)];
    out.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      properties: { color: slopeColor(gradeAt(i + 1)) },
    });
  }
  return out;
})();

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

function poiGlyphSvg(type: PoiType): string {
  switch (type) {
    case "eau":
      return '<path d="M0,-6 C4,-1 4.5,2 0,6 C-4.5,2 -4,-1 0,-6 Z" fill="#fff"/>';
    case "source":
      return '<path d="M0,-6 C4,-1 4.5,2 0,6 C-4.5,2 -4,-1 0,-6 Z" fill="none" stroke="#fff" stroke-width="1.6"/>';
    case "ravito":
      return '<rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" fill="#fff"/>';
    case "refuge":
      return '<path d="M-5,4 L-5,-1 L0,-5 L5,-1 L5,4 Z" fill="#fff"/>';
  }
}

function makeMarkerElement(poi: Poi, onActivate: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "varde-poi-marker " + poi.type + (poi.fiable ? "" : " unreliable");
  el.setAttribute("aria-label", `${poi.name} — ${poi.type}`);

  const dot = document.createElement("span");
  dot.className = "varde-poi-dot";
  dot.style.backgroundColor = POI_COLOR[poi.type];
  dot.innerHTML = `<svg viewBox="-12 -12 24 24" width="100%" height="100%">${poiGlyphSvg(poi.type)}</svg>`;
  el.appendChild(dot);

  if (!poi.fiable) {
    const ring = document.createElement("span");
    ring.className = "varde-poi-ring";
    ring.style.borderColor = POI_COLOR[poi.type];
    el.appendChild(ring);
  }

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onActivate();
  });
  return el;
}

// Badges mode is not wired through MapLibre yet — kept in the prop contract so
// the rest of the planning view's API is unchanged; we just don't read it here.
export function TopoMap({
  slopeOn,
  hoverKm,
  setHoverKm,
  selectedSeg,
  selectedPoi,
  setSelectedPoi,
}: TopoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());

  // Latest-callback refs so the map's load/mousemove handlers (registered once)
  // always see the current props without re-creating the map on every render.
  const setHoverKmRef = useRef(setHoverKm);
  const setSelectedPoiRef = useRef(setSelectedPoi);
  const selectedPoiRef = useRef(selectedPoi);
  useEffect(() => {
    setHoverKmRef.current = setHoverKm;
  }, [setHoverKm]);
  useEffect(() => {
    setSelectedPoiRef.current = setSelectedPoi;
  }, [setSelectedPoi]);
  useEffect(() => {
    selectedPoiRef.current = selectedPoi;
  }, [selectedPoi]);

  // Mount / unmount the map once. All later updates go through setData /
  // setLayoutProperty against the live map instance.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Stable Map<> instance captured at setup time so the cleanup closure
    // doesn't reach through markersRef at unmount (which would trip the
    // exhaustive-deps lint rule).
    const markers = markersRef.current;

    const map = new maplibregl.Map({
      container,
      style: STYLE_URL,
      bounds: [
        [ROUTE_BOUNDS[0], ROUTE_BOUNDS[1]],
        [ROUTE_BOUNDS[2], ROUTE_BOUNDS[3]],
      ],
      fitBoundsOptions: { padding: 60, animate: false },
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: ROUTE_COORDS },
          properties: {},
        },
      });
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

      map.addSource("slope", {
        type: "geojson",
        data: { type: "FeatureCollection", features: SLOPE_FEATURES },
      });
      map.addLayer({
        id: "slope-line",
        type: "line",
        source: "slope",
        layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
        paint: { "line-color": ["get", "color"], "line-width": 6.5 },
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

      const first = ROUTE[0];
      const last = ROUTE[ROUTE.length - 1];
      map.addSource("terminus", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [first.lng, first.lat] },
              properties: { kind: "start" },
            },
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [last.lng, last.lat] },
              properties: { kind: "finish" },
            },
          ],
        },
      });
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

      for (const poi of POIS) {
        const geo = poiGeoPos(poi.km, poi.offset);
        const el = makeMarkerElement(poi, () => {
          const next = selectedPoiRef.current === poi.id ? null : poi.id;
          setSelectedPoiRef.current(next);
        });
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([geo.marker[0], geo.marker[1]])
          .addTo(map);
        markers.set(poi.id, { marker, el });
      }

      readyRef.current = true;
    });

    const handleMove = (e: MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < ROUTE.length; i += 2) {
        const dx = ROUTE[i].lng - lng;
        const dy = ROUTE[i].lat - lat;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      // Threshold ≈ 600m squared in degree space at lat 45.6° — a generous
      // "near the trace" zone that still ignores pans across blank terrain.
      if (bd < 4e-5) setHoverKmRef.current(ROUTE[best].dist);
      else setHoverKmRef.current(null);
    };
    map.on("mousemove", handleMove);
    map.on("mouseout", () => setHoverKmRef.current(null));

    return () => {
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Slope layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (!map.getLayer("route-main") || !map.getLayer("slope-line")) return;
      map.setLayoutProperty("route-main", "visibility", slopeOn ? "none" : "visible");
      map.setLayoutProperty("slope-line", "visibility", slopeOn ? "visible" : "none");
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [slopeOn]);

  // Selected-segment highlight.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("seg-hi") as GeoJSONSource | undefined;
      if (!source) return;
      if (selectedSeg == null) {
        source.setData(EMPTY_FC);
        return;
      }
      const seg = SEGMENTS[selectedSeg];
      if (!seg) {
        source.setData(EMPTY_FC);
        return;
      }
      const coords = ROUTE.filter((p) => p.dist >= seg.from.km && p.dist <= seg.to.km).map(
        (p) => [p.lng, p.lat],
      );
      if (coords.length < 2) {
        source.setData(EMPTY_FC);
        return;
      }
      const feature: Feature<LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: {},
      };
      source.setData(feature);
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [selectedSeg]);

  // Hover marker (bi-directional sync with the elevation profile).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("hover-pt") as GeoJSONSource | undefined;
      if (!source) return;
      if (hoverKm == null) {
        source.setData(EMPTY_FC);
        return;
      }
      const p = pointAtKm(hoverKm);
      const [lng, lat] = svgToLngLat(p.x, p.y);
      const feature: Feature<Point> = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {},
      };
      source.setData(feature);
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [hoverKm]);

  // POI selection state is reflected via class toggling on the marker DOM.
  useEffect(() => {
    for (const [id, { el }] of markersRef.current) {
      el.classList.toggle("sel", id === selectedPoi);
    }
  }, [selectedPoi]);

  return <div ref={containerRef} className="topomap" />;
}
