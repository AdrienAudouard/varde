"use client";

// MapLibre GL JS swap-in for the previous SVG placeholder.
// Renders the trace, slope overlay, selected-segment highlight, hover marker,
// and POI markers on top of a real cartographic basemap (MapTiler Landscape).
// All interaction contracts (hoverKm sync, selectedPoi, selectedSeg, slopeOn)
// match the previous component so the rest of the planning view is untouched.

import { useEffect, useRef, useState } from "react";
import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MaplibreMap,
  type MapMouseEvent,
} from "maplibre-gl";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  gradeAt,
  pointAtKm,
  type Poi,
  type PoiType,
  type RoutePoint,
  type Segment,
  type Trace,
} from "@/lib/varde/data";
import { slopeColor } from "@/lib/varde/slope";
import {
  KIND_LABEL,
  fetchWaterPoints,
  type Bbox,
  type WaterPoint,
  type WaterPointKind,
} from "@/lib/varde/overpass";

export type AutonomyMode = "panel" | "badges" | "table";

type TopoMapProps = {
  trace: Trace | null;
  segments: readonly Segment[];
  slopeOn: boolean;
  hoverKm: number | null;
  setHoverKm: (km: number | null) => void;
  selectedSeg: number | null;
  autonomyMode: AutonomyMode;
  selectedPoi: string | null;
  setSelectedPoi: (id: string | null) => void;
  /** Notified when an Overpass water-point fetch starts (`true`) or settles
   *  (`false`). Used by the legend to show a spinner. */
  onWaterLoadingChange?: (loading: boolean) => void;
};

// Initial camera when no trace is loaded: centred on the French Alps
// (Tarentaise), zoomed out enough to show regional terrain. Once a trace is
// imported the future producer can fitBounds to its geometry instead.
const DEFAULT_VIEW = {
  center: [6.5, 45.6] as [number, number],
  zoom: 7,
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

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

function routeCoords(route: readonly RoutePoint[]): number[][] {
  return route.map((p) => [p.lng, p.lat]);
}

// Slope-coloured segment features for the route overlay. Derived from the
// loaded route (empty until a trace is imported).
function buildSlopeFeatures(
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

// OSM water-point dot colors — tuned to read as a quieter, secondary layer
// alongside the user's curated POIs (which use POI_COLOR above). Springs get
// a lighter cyan to signal "less reliable"; every other tag uses the same blue.
const WATER_DOT_COLOR = "#2b6f9e";
const SPRING_DOT_COLOR = "#56b4e0";

// Shared MapLibre `circle-color` expression for both the halo and the dot
// layers, so the two stay in lockstep on future kind tweaks. Built as a
// factory rather than a frozen constant because MapLibre's paint specs
// occasionally mutate the arrays they're given.
const osmWaterColorExpr = (): ExpressionSpecification => [
  "match",
  ["get", "kind"],
  "spring",
  SPRING_DOT_COLOR,
  WATER_DOT_COLOR,
];

// Build popup DOM with textContent/href (no innerHTML) so untrusted OSM tag
// values can't smuggle script/HTML into the page.
function buildOsmPopupContent(wp: WaterPoint): HTMLElement {
  const root = document.createElement("div");
  root.className = "osm-water-popup";

  const title = document.createElement("div");
  title.className = "osm-water-popup-title";
  title.textContent = wp.name ?? KIND_LABEL[wp.kind];
  root.appendChild(title);

  const sub = document.createElement("div");
  sub.className = "osm-water-popup-sub";
  sub.textContent = wp.name ? KIND_LABEL[wp.kind] : "OpenStreetMap";
  root.appendChild(sub);

  const rows: Array<readonly [string, string]> = [];
  if (wp.drinkable === true) rows.push(["Potable", "oui"]);
  if (wp.drinkable === false) rows.push(["Potable", "non"]);
  if (wp.seasonal) rows.push(["Saisonnier", "oui"]);
  if (wp.fee === true) rows.push(["Payant", "oui"]);
  if (wp.operator) rows.push(["Opérateur", wp.operator]);
  if (wp.openingHours) rows.push(["Horaires", wp.openingHours]);

  if (rows.length > 0) {
    const list = document.createElement("dl");
    list.className = "osm-water-popup-list";
    for (const [k, v] of rows) {
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v;
      list.appendChild(dt);
      list.appendChild(dd);
    }
    root.appendChild(list);
  }

  const link = document.createElement("a");
  link.className = "osm-water-popup-link";
  link.href = `https://www.openstreetmap.org/node/${wp.id}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Voir sur OpenStreetMap →";
  root.appendChild(link);

  return root;
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
  trace,
  segments,
  slopeOn,
  hoverKm,
  setHoverKm,
  selectedSeg,
  selectedPoi,
  setSelectedPoi,
  onWaterLoadingChange,
}: TopoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Surfaces Overpass failures in the UI — the public endpoint can rate-limit
  // or 5xx on rapid pans, and a silent catch hid that completely.
  const [waterError, setWaterError] = useState<string | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const readyRef = useRef(false);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLElement }>>(new Map());
  // OSM water points fetched from Overpass — keyed by OSM node id so the click
  // popup can look up full details from the feature's `id` property without
  // round-tripping the (potentially large) tag dict through GeoJSON properties.
  const waterPointsRef = useRef<Map<number, WaterPoint>>(new Map());

  // Latest-callback refs so the map's load/mousemove handlers (registered once)
  // always see the current props without re-creating the map on every render.
  const setHoverKmRef = useRef(setHoverKm);
  const setSelectedPoiRef = useRef(setSelectedPoi);
  const selectedPoiRef = useRef(selectedPoi);
  const onWaterLoadingChangeRef = useRef(onWaterLoadingChange);
  // Latest trace, read by the persistent map handlers (mousemove → nearest
  // route point) without re-mounting the map. Trace-dependent layers are only
  // added on `load` when a trace exists — a dormant seam until GPX import lands.
  const traceRef = useRef(trace);
  useEffect(() => {
    traceRef.current = trace;
  }, [trace]);
  useEffect(() => {
    setHoverKmRef.current = setHoverKm;
  }, [setHoverKm]);
  useEffect(() => {
    setSelectedPoiRef.current = setSelectedPoi;
  }, [setSelectedPoi]);
  useEffect(() => {
    selectedPoiRef.current = selectedPoi;
  }, [selectedPoi]);
  useEffect(() => {
    onWaterLoadingChangeRef.current = onWaterLoadingChange;
  }, [onWaterLoadingChange]);

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
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("load", () => {
      // Trace-dependent sources are created unconditionally, seeded empty, in
      // insertion order route → slope → terminus → seg-hi → hover → osm-water
      // so the highlight/hover layers stay on top. The `[trace]` effect below
      // fills route/slope/terminus and rebuilds POI markers when a trace loads.
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

      // OSM water points layer (populated by the Overpass fetch below).
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

      map.on("click", "osm-water-dot", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as { id?: number } | null;
        const id = props?.id;
        if (typeof id !== "number") return;
        const wp = waterPointsRef.current.get(id);
        if (!wp) return;
        new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: "260px" })
          .setLngLat([wp.lng, wp.lat])
          .setDOMContent(buildOsmPopupContent(wp))
          .addTo(map);
      });
      map.on("mouseenter", "osm-water-dot", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "osm-water-dot", () => {
        map.getCanvas().style.cursor = "";
      });

      readyRef.current = true;
      // Kick off the first Overpass fetch now that the source exists.
      scheduleWaterFetch(0);
    });

    // --- Overpass: fetch OSM water points for the current viewport ----------
    // Debounced refetch on every moveend; in-flight requests are aborted when
    // a new one starts; identical or contained bounding boxes are skipped via
    // `bboxContains`.
    let waterFetchTimer: number | null = null;
    let waterFetchAbort: AbortController | null = null;
    let lastFetchedBbox: Bbox | null = null;

    // True when `inner` is fully contained in `outer` — used to skip refetch
    // when the user pans inside an area we already have data for.
    function bboxContains(outer: Bbox, inner: Bbox): boolean {
      const [w1, s1, e1, n1] = outer;
      const [w2, s2, e2, n2] = inner;
      return w2 >= w1 && s2 >= s1 && e2 <= e1 && n2 <= n1;
    }

    async function runWaterFetch() {
      if (!readyRef.current) return;
      if (map.getZoom() < 9) return;
      const b = map.getBounds();
      const bbox: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      if (lastFetchedBbox && bboxContains(lastFetchedBbox, bbox)) return;
      lastFetchedBbox = bbox;

      waterFetchAbort?.abort();
      const ctrl = new AbortController();
      waterFetchAbort = ctrl;
      onWaterLoadingChangeRef.current?.(true);
      try {
        const points = await fetchWaterPoints(bbox, ctrl.signal);
        // If aborted by a newer fetch, *don't* flip loading to false — the
        // replacement fetch already set it to true and owns the lifecycle.
        if (ctrl.signal.aborted) return;
        waterPointsRef.current = new Map(points.map((p) => [p.id, p]));
        const source = map.getSource("osm-water") as GeoJSONSource | undefined;
        if (!source) return;
        const features: Array<Feature<Point, { id: number; kind: WaterPointKind }>> = points.map(
          (p) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: { id: p.id, kind: p.kind },
          }),
        );
        source.setData({ type: "FeatureCollection", features });
        setWaterError(null);
        onWaterLoadingChangeRef.current?.(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Clear the cached bbox so the next pan retries (otherwise a transient
        // failure would lock us out until the user pans entirely outside this bbox).
        lastFetchedBbox = null;
        // Drop any previously-rendered points: stale markers from the prior
        // viewport are misleading once we know the current view's data is
        // unknown. The error banner explains the empty state.
        waterPointsRef.current.clear();
        const source = map.getSource("osm-water") as GeoJSONSource | undefined;
        source?.setData(EMPTY_FC);
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[varde/overpass] fetch failed", err);
        setWaterError(msg);
        onWaterLoadingChangeRef.current?.(false);
      }
    }

    function scheduleWaterFetch(delayMs: number) {
      if (waterFetchTimer != null) window.clearTimeout(waterFetchTimer);
      waterFetchTimer = window.setTimeout(runWaterFetch, delayMs);
    }

    map.on("moveend", () => scheduleWaterFetch(400));

    const handleMove = (e: MapMouseEvent) => {
      const route = traceRef.current?.route;
      if (!route || route.length === 0) return;
      const { lng, lat } = e.lngLat;
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < route.length; i += 2) {
        const dx = route[i].lng - lng;
        const dy = route[i].lat - lat;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      // Threshold ≈ 600m squared in degree space at lat 45.6° — a generous
      // "near the trace" zone that still ignores pans across blank terrain.
      if (bd < 4e-5) setHoverKmRef.current(route[best].dist);
      else setHoverKmRef.current(null);
    };
    map.on("mousemove", handleMove);
    map.on("mouseout", () => setHoverKmRef.current(null));

    return () => {
      if (waterFetchTimer != null) window.clearTimeout(waterFetchTimer);
      waterFetchAbort?.abort();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Draw the trace onto the map (route line, slope overlay, terminus dots, POI
  // markers) and frame it. Pure map mutations synced to the `trace` prop — this
  // is genuine external-system synchronization, so an effect is the right tool.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const routeSrc = map.getSource("route") as GeoJSONSource | undefined;
      const slopeSrc = map.getSource("slope") as GeoJSONSource | undefined;
      const terminusSrc = map.getSource("terminus") as GeoJSONSource | undefined;
      if (!routeSrc || !slopeSrc || !terminusSrc) {
        console.warn("[varde/map] trace effect: sources not ready", {
          routeSrc: !!routeSrc,
          slopeSrc: !!slopeSrc,
          terminusSrc: !!terminusSrc,
        });
        return;
      }

      const route = trace?.route;
      console.log("[varde/map] draw trace", { points: route?.length ?? 0 });
      const markers = markersRef.current;
      if (!route || route.length < 1) {
        routeSrc.setData(EMPTY_FC);
        slopeSrc.setData(EMPTY_FC);
        terminusSrc.setData(EMPTY_FC);
        markers.forEach(({ marker }) => marker.remove());
        markers.clear();
        return;
      }

      const routeFeature: Feature<LineString> = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: routeCoords(route) },
        properties: {},
      };
      routeSrc.setData(routeFeature);
      slopeSrc.setData({ type: "FeatureCollection", features: buildSlopeFeatures(route) });

      const first = route[0];
      const last = route[route.length - 1];
      terminusSrc.setData({
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
      });

      // Rebuild POI markers from scratch (none derived from GPX today, but the
      // import flow may add them later — this keeps the layer correct).
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      for (const poi of trace?.pois ?? []) {
        const at = pointAtKm(route, poi.km);
        const el = makeMarkerElement(poi, () => {
          const next = selectedPoiRef.current === poi.id ? null : poi.id;
          setSelectedPoiRef.current(next);
        });
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([at.lng, at.lat])
          .addTo(map);
        markers.set(poi.id, { marker, el });
      }

      // Single-pass bbox. Degenerate (single-location) tracks yield a zero-area
      // box, which fitBounds centres + clamps via maxZoom — no NaN since the
      // parser already drops non-finite coordinates.
      let w = Infinity;
      let s = Infinity;
      let e = -Infinity;
      let n = -Infinity;
      for (const p of route) {
        if (p.lng < w) w = p.lng;
        if (p.lng > e) e = p.lng;
        if (p.lat < s) s = p.lat;
        if (p.lat > n) n = p.lat;
      }
      console.log("[varde/map] fitBounds", { w, s, e, n });
      map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 14 });
    };
    if (readyRef.current) {
      apply();
    } else {
      console.log("[varde/map] trace effect deferred until map load");
      map.once("load", apply);
    }
  }, [trace]);

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
      const seg = segments[selectedSeg];
      const route = trace?.route;
      if (!seg || !route) {
        source.setData(EMPTY_FC);
        return;
      }
      const coords = route
        .filter((p) => p.dist >= seg.from.km && p.dist <= seg.to.km)
        .map((p) => [p.lng, p.lat]);
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
  }, [selectedSeg, segments, trace]);

  // Hover marker (bi-directional sync with the elevation profile).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("hover-pt") as GeoJSONSource | undefined;
      if (!source) return;
      const route = trace?.route;
      if (hoverKm == null || !route || route.length === 0) {
        source.setData(EMPTY_FC);
        return;
      }
      const p = pointAtKm(route, hoverKm);
      const feature: Feature<Point> = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: {},
      };
      source.setData(feature);
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [hoverKm, trace]);

  // POI selection state is reflected via class toggling on the marker DOM.
  useEffect(() => {
    for (const [id, { el }] of markersRef.current) {
      el.classList.toggle("sel", id === selectedPoi);
    }
  }, [selectedPoi]);

  return (
    <>
      <div ref={containerRef} className="topomap" />
      {waterError && (
        <div className="varde-water-error" role="status">
          Overpass API : {waterError}
        </div>
      )}
    </>
  );
}
