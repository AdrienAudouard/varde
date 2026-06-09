"use client";

// MapLibre GL JS swap-in for the previous SVG placeholder.
// Renders the trace, slope overlay, selected-segment highlight, hover marker,
// and POI markers on top of a real cartographic basemap (MapTiler Landscape).
// All interaction contracts (hoverKm sync, selectedPoi, selectedRange, slopeOn)
// match the previous component so the rest of the planning view is untouched.

import { useEffect, useRef } from "react";
import maplibregl, {
  type GeoJSONSource,
  type Map as MaplibreMap,
  type MapMouseEvent,
} from "maplibre-gl";
import type { Feature, LineString, Point } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { pointAtKm, type Trace } from "@/lib/varde/data";
import { type WaterPoint, type WaterPointKind } from "@/lib/varde/overpass";
import { buildSlopeFeatures, routeCoords } from "@/lib/varde/topo-features";
import {
  DEFAULT_VIEW,
  EMPTY_FC,
  STYLE_URL,
} from "@/components/varde/topo-map-style";
import { buildOsmPopupContent, makeMarkerElement } from "@/components/varde/topo-map-dom";
import {
  addTraceLayers,
  addWaterLayers,
  setupTerrain,
} from "@/components/varde/topo-map-layers";
import {
  TERRAIN_SLOPE_LAYER,
  addTerrainSlopeLayer,
  registerTerrainSlopeProtocol,
  setTerrainSlopeRange,
} from "@/components/varde/terrain-slope-protocol";
import type { SlopeRange } from "@/lib/varde/terrain-slope";

// Register the slope custom protocol once at module load (idempotent), before
// any map mounts — the protocol must exist before the slope source requests a
// tile. Safe under React StrictMode's double mount.
registerTerrainSlopeProtocol();

export type AutonomyMode = "panel" | "badges" | "table";

type TopoMapProps = {
  trace: Trace | null;
  /** OSM water points for the route area, fetched once per trace by the page.
   *  Rendered as the secondary `osm-water` layer; the page also projects them
   *  into the trace's pois for the autonomy plan. */
  waterPoints: readonly WaterPoint[];
  slopeOn: boolean;
  /** Avalanche-style terrain slope overlay (the whole mountainside),
   *  independent of `slopeOn` (which colours only the route line). */
  terrainSlopeOn: boolean;
  /** Grade-% [min, max] window the terrain overlay renders (gradient across it,
   *  transparent outside). Changing it re-renders the slope tiles. */
  slopeRange: SlopeRange;
  hoverKm: number | null;
  setHoverKm: (km: number | null) => void;
  selectedRange: { fromKm: number; toKm: number } | null;
  autonomyMode: AutonomyMode;
  selectedPoi: string | null;
  setSelectedPoi: (id: string | null) => void;
  /** Latest geolocation fix from the "my location" button. A fresh object (one
   *  per press) flies the map to it and drops the position marker. */
  locateTarget: { lng: number; lat: number } | null;
};

// Runs `fn` once the map's sources/layers exist: immediately when the load
// callback has already fired, otherwise deferred to the next `load`. Collapses
// the repeated "defer until ready" guard at the top of each update effect.
function runWhenMapReady(
  map: MaplibreMap,
  ready: boolean,
  fn: () => void,
): void {
  if (ready) fn();
  else map.once("load", fn);
}

// Badges mode is not wired through MapLibre yet — kept in the prop contract so
// the rest of the planning view's API is unchanged; we just don't read it here.
export function TopoMap({
  trace,
  waterPoints,
  slopeOn,
  terrainSlopeOn,
  slopeRange,
  hoverKm,
  setHoverKm,
  selectedRange,
  selectedPoi,
  setSelectedPoi,
  locateTarget,
}: TopoMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
      // Allow a steep tilt (default cap is 60°) so Ctrl/right-click-drag can
      // look across ridgelines and read the 3D relief, not just a shallow lean.
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // Keep the canvas in sync with container-size changes — e.g. the top bar,
    // profile and autonomy panels appearing when a trace loads (the map goes
    // full-bleed when none is loaded). MapLibre's built-in trackResize only
    // follows window resizes, not layout-driven container resizes.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    // Water-point click/hover interactions, registered once after the layers
    // exist. Reads `waterPointsRef` to resolve a node's full details by id.
    const registerWaterInteractions = () => {
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
    };

    map.on("load", () => {
      setupTerrain(map);
      addTraceLayers(map);
      // After addTraceLayers so `route-casing` exists for the slope layer's
      // beforeId — the shading then sits under every route/POI layer.
      addTerrainSlopeLayer(map);
      addWaterLayers(map);
      registerWaterInteractions();
      readyRef.current = true;
    });

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
      resizeObserver.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Render the OSM water-point layer from the prop, and keep `waterPointsRef`
  // in sync so the click popup can resolve a node's full details by id. Keyed on
  // the prop so the page's single fetch resolving repaints just this layer —
  // never the route geometry. Defers until the map's sources exist.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runWhenMapReady(map, readyRef.current, () => {
      const source = map.getSource("osm-water") as GeoJSONSource | undefined;
      if (!source) return;
      waterPointsRef.current = new Map(waterPoints.map((p) => [p.id, p]));
      const features: Array<Feature<Point, { id: number; kind: WaterPointKind }>> =
        waterPoints.map((p) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: { id: p.id, kind: p.kind },
        }));
      source.setData({ type: "FeatureCollection", features });
    });
  }, [waterPoints]);

  // Draw the route geometry (line, slope overlay, terminus dots) and frame it.
  // Keyed on `trace?.route` only — POI markers live in their own effect below so
  // the page's async water fetch resolving (which changes `trace.pois` but keeps
  // the same `route` array) never re-frames the map. Pure external-system sync.
  const route = trace?.route;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runWhenMapReady(map, readyRef.current, () => {
      const routeSrc = map.getSource("route") as GeoJSONSource | undefined;
      const slopeSrc = map.getSource("slope") as GeoJSONSource | undefined;
      const terminusSrc = map.getSource("terminus") as GeoJSONSource | undefined;
      if (!routeSrc || !slopeSrc || !terminusSrc) return;

      if (!route || route.length < 1) {
        routeSrc.setData(EMPTY_FC);
        slopeSrc.setData(EMPTY_FC);
        terminusSrc.setData(EMPTY_FC);
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
      map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 14 });
    });
  }, [route]);

  // Rebuild POI markers when the trace's pois change (including the water points
  // the page derives from the async Overpass fetch). Reads the route from
  // `traceRef` so it isn't keyed on geometry — only re-runs when pois change.
  const pois = trace?.pois;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runWhenMapReady(map, readyRef.current, () => {
      const markers = markersRef.current;
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      const currentRoute = traceRef.current?.route;
      if (!currentRoute || currentRoute.length < 1) return;
      for (const poi of pois ?? []) {
        const at = pointAtKm(currentRoute, poi.km);
        const el = makeMarkerElement(poi, () => {
          const next = selectedPoiRef.current === poi.id ? null : poi.id;
          setSelectedPoiRef.current(next);
        });
        if (poi.id === selectedPoiRef.current) el.classList.add("sel");
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([at.lng, at.lat])
          .addTo(map);
        markers.set(poi.id, { marker, el });
      }
    });
  }, [pois]);

  // Slope layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runWhenMapReady(map, readyRef.current, () => {
      if (!map.getLayer("route-main") || !map.getLayer("slope-line")) return;
      map.setLayoutProperty("route-main", "visibility", slopeOn ? "none" : "visible");
      map.setLayoutProperty("slope-line", "visibility", slopeOn ? "visible" : "none");
    });
  }, [slopeOn]);

  // Terrain slope overlay visibility — independent of `slopeOn`, so both the
  // route-line colouring and the whole-mountainside shading can be on.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runWhenMapReady(map, readyRef.current, () => {
      if (!map.getLayer(TERRAIN_SLOPE_LAYER)) return;
      map.setLayoutProperty(TERRAIN_SLOPE_LAYER, "visibility", terrainSlopeOn ? "visible" : "none");
    });
  }, [terrainSlopeOn]);

  // Re-render the terrain overlay when the grade-% range changes. Debounced so
  // dragging the control doesn't refetch/recompute every tile on each tick —
  // only ~250ms after the last change. (A hidden layer loads no tiles, so this
  // is cheap when the overlay is off.)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      runWhenMapReady(map, readyRef.current, () => setTerrainSlopeRange(map, slopeRange));
    }, 250);
    return () => clearTimeout(timer);
  }, [slopeRange]);

  // Selected-segment highlight.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runWhenMapReady(map, readyRef.current, () => {
      const source = map.getSource("seg-hi") as GeoJSONSource | undefined;
      if (!source) return;
      if (selectedRange == null) {
        source.setData(EMPTY_FC);
        return;
      }
      const route = trace?.route;
      if (!route) {
        source.setData(EMPTY_FC);
        return;
      }
      const coords = route
        .filter((p) => p.dist >= selectedRange.fromKm && p.dist <= selectedRange.toKm)
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
    });
  }, [selectedRange, trace]);

  // Hover marker (bi-directional sync with the elevation profile).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runWhenMapReady(map, readyRef.current, () => {
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
    });
  }, [hoverKm, trace]);

  // Fly to the latest geolocation fix and drop the "you are here" marker. A new
  // object identity (one per button press) re-runs this, so repeated presses
  // re-centre even when the coordinates are unchanged. Zooms in only if the
  // current view is wider than ~z13, so it never zooms a closer view back out.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locateTarget) return;
    runWhenMapReady(map, readyRef.current, () => {
      const source = map.getSource("user-loc") as GeoJSONSource | undefined;
      if (source) {
        const feature: Feature<Point> = {
          type: "Feature",
          geometry: { type: "Point", coordinates: [locateTarget.lng, locateTarget.lat] },
          properties: {},
        };
        source.setData(feature);
      }
      map.flyTo({
        center: [locateTarget.lng, locateTarget.lat],
        zoom: Math.max(map.getZoom(), 13),
        speed: 1.2,
      });
    });
  }, [locateTarget]);

  // POI selection state is reflected via class toggling on the marker DOM.
  useEffect(() => {
    for (const [id, { el }] of markersRef.current) {
      el.classList.toggle("sel", id === selectedPoi);
    }
  }, [selectedPoi]);

  return <div ref={containerRef} className="topomap" />;
}
