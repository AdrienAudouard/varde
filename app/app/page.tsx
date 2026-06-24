"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/varde/icon";
import { TopBar } from "@/components/varde/top-bar";
import type { AutonomyMode, MapZoomControls } from "@/components/varde/topo-map";
import { ElevationProfile } from "@/components/varde/elevation-profile";
import { AutonomyPanels, type AutonomyTab } from "@/components/varde/autonomy-panels";
import { PoiDetail } from "@/components/varde/poi-detail";
import { ImportModal } from "@/components/varde/import-modal";
import { buildSegments, type Trace } from "@/lib/varde/data";
import { buildTerrain } from "@/lib/varde/terrain";
import { DEFAULT_SLOPE_RANGE, type SlopeRange } from "@/lib/varde/terrain-slope";
import { SlopeRangeControl } from "@/components/varde/slope-range-control";
import { waterPointsToPois } from "@/lib/varde/water-proximity";
import { useRouteWaterPoints, useWaterPoints } from "@/components/varde/use-water-points";
import { type Bbox, WaterPointKind, WATER_FILTER_KINDS } from "@/lib/varde/water-points";
import { PoiFilterPanel } from "@/components/varde/poi-filter-panel";

// MapLibre touches `window` at module load — keep it out of the server bundle.
const TopoMap = dynamic(
  () => import("@/components/varde/topo-map").then((m) => m.TopoMap),
  { ssr: false, loading: () => <div className="topomap topomap-loading" /> },
);

const AUTONOMY_MODE: AutonomyMode = "panel";

export default function Page() {
  const [slopeOn, setSlopeOn] = useState(false);
  const [terrainSlopeOn, setTerrainSlopeOn] = useState(false);
  const [slopeRange, setSlopeRange] = useState<SlopeRange>(DEFAULT_SLOPE_RANGE);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateTarget, setLocateTarget] = useState<{ lng: number; lat: number } | null>(null);
  const [hoverKm, setHoverKm] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AutonomyTab>("water");
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  const [trace, setTrace] = useState<Trace | null>(null);
  // Current map viewport bbox, updated by TopoMap on load and after each move.
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null);
  // Imperative zoom handlers handed up by the map, driving the +/- buttons.
  const [zoomControls, setZoomControls] = useState<MapZoomControls | null>(null);

  // Advanced POI filter: which categories to fetch + which water sub-kinds to show.
  const [poiFilterOpen, setPoiFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ReadonlySet<string>>(
    () => new Set(["water"]),
  );
  const [selectedKinds, setSelectedKinds] = useState<ReadonlySet<WaterPointKind>>(
    () => new Set(WATER_FILTER_KINDS),
  );
  const toggleCategory = (key: string) =>
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleKind = (kind: WaterPointKind) =>
    setSelectedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const route = useMemo(() => trace?.route ?? [], [trace]);

  // Two independent water-point fetches (both debounced, MongoDB-backed):
  //  - viewport: drives the on-map overlay, refetched as the map moves, so points
  //    show even when no GPX is loaded.
  //  - route: a stable route-area fetch projected onto the path for the autonomy
  //    plan, so the plan stays put when the map pans away from the route.
  const {
    waterPoints: viewportWaterPoints,
    isLoading: viewportLoading,
    error: viewportError,
  } = useWaterPoints(viewportBbox, [...selectedCategories]);
  const {
    waterPoints: routeWaterPoints,
    isLoading: routeLoading,
    error: routeError,
  } = useRouteWaterPoints(route);
  // The map filter applies to the plan too: keep only the selected water
  // sub-kinds, and drop water entirely if its category is unchecked. Mirrors the
  // display filter below so map and plan stay in lockstep.
  const filteredRouteWaterPoints = useMemo(
    () =>
      selectedCategories.has("water")
        ? routeWaterPoints.filter((wp) => selectedKinds.has(wp.kind))
        : [],
    [routeWaterPoints, selectedCategories, selectedKinds],
  );
  const derivedPois = useMemo(
    () => waterPointsToPois(route, filteredRouteWaterPoints),
    [route, filteredRouteWaterPoints],
  );
  // Feed the existing overlay/legend. routeError/routeLoading are inert when
  // there's no route (the hook returns an empty result for a null bbox).
  const waterError = viewportError ?? routeError;
  const waterLoading = viewportLoading || routeLoading;
  // Apply the sub-kind filter client-side: category selection already narrowed
  // the fetch, this hides unchecked water kinds without a refetch.
  const displayWaterPoints = useMemo(
    () => viewportWaterPoints.filter((wp) => selectedKinds.has(wp.kind)),
    [viewportWaterPoints, selectedKinds],
  );
  // Spread keeps `route` referentially stable, so the map's geometry/fitBounds
  // effect (keyed on `trace?.route`) won't re-fire when derived pois arrive.
  const mergedTrace = useMemo<Trace | null>(
    () => (trace ? { ...trace, pois: [...trace.pois, ...derivedPois] } : null),
    [trace, derivedPois],
  );

  const pois = mergedTrace?.pois ?? [];
  const segments = useMemo(() => buildSegments(mergedTrace), [mergedTrace]);
  const terrain = useMemo(() => buildTerrain(route), [route]);
  const hasTrace = trace != null;

  // The bands shown on the map/profile follow the active tab, so a single
  // km-range selection model drives both the highlight and the band rects.
  const bands = useMemo(
    () =>
      activeTab === "water"
        ? segments.map((s) => ({ fromKm: s.from.km, toKm: s.to.km }))
        : terrain.map((t) => ({ fromKm: t.fromKm, toKm: t.toKm })),
    [activeTab, segments, terrain],
  );
  const selectedRange = useMemo(
    () => (selected != null ? bands[selected] ?? null : null),
    [selected, bands],
  );

  const selectedPoiData = selectedPoi != null ? pois.find((p) => p.id === selectedPoi) ?? null : null;
  const selectedPoiSeg =
    selectedPoiData != null ? segments.find((s) => s.to.km === selectedPoiData.km) ?? null : null;

  // Geolocate: request a one-shot browser fix, then hand the coords to the map
  // (a fresh object each press re-triggers its fly-to effect). Needs a secure
  // context (HTTPS / localhost). Errors surface as a transient toast.
  const handleLocate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocateError("Géolocalisation non disponible sur cet appareil");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocateTarget({ lng: pos.coords.longitude, lat: pos.coords.latitude });
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Accès à la position refusé"
            : "Position indisponible",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div className="app">
      <main className="main">
        {hasTrace && (
          <TopBar
            trace={trace}
            segments={segments}
            onImport={() => setImportOpen(true)}
          />
        )}
        <div className={"plan-body" + (hasTrace ? "" : " map-only")}>
          <section className="map-col">
            <div className="map-stage">
              {!hasTrace && (
                <div className="map-import-float">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setImportOpen(true)}
                  >
                    <Icon name="import" size={17} /> Importer un GPX
                  </button>
                </div>
              )}
              <TopoMap
                trace={mergedTrace}
                waterPoints={displayWaterPoints}
                onViewportChange={setViewportBbox}
                onZoomControls={setZoomControls}
                slopeOn={slopeOn}
                terrainSlopeOn={terrainSlopeOn}
                slopeRange={slopeRange}
                locateTarget={locateTarget}
                hoverKm={hoverKm}
                setHoverKm={setHoverKm}
                selectedRange={selectedRange}
                autonomyMode={AUTONOMY_MODE}
                selectedPoi={selectedPoi}
                setSelectedPoi={setSelectedPoi}
              />
              {waterError && (
                <div className="varde-water-error" role="status">
                  Points d&apos;eau : {waterError}
                </div>
              )}
              {locateError && (
                <div className="varde-water-error" role="status">
                  {locateError}
                </div>
              )}
              <div className="map-ctrls">
                <button
                  type="button"
                  className={"mc-btn" + (controlsOpen ? " on" : "")}
                  onClick={() => setControlsOpen((open) => !open)}
                  aria-expanded={controlsOpen}
                >
                  <span className="mc-ico">
                    <Icon name="settings" size={18} />
                  </span>
                  <span className="mc-lab">Options de la carte</span>
                </button>
                {controlsOpen && (
                  <>
                    <button
                      type="button"
                      className="mc-btn"
                      onClick={() => zoomControls?.zoomIn()}
                    >
                      <span className="mc-ico">+</span>
                      <span className="mc-lab">Zoom avant</span>
                    </button>
                    <button
                      type="button"
                      className="mc-btn"
                      onClick={() => zoomControls?.zoomOut()}
                    >
                      <span className="mc-ico">−</span>
                      <span className="mc-lab">Zoom arrière</span>
                    </button>
                    <button
                      type="button"
                      className="mc-btn"
                      onClick={handleLocate}
                      disabled={locating}
                    >
                      <span className="mc-ico">
                        {locating ? (
                          <span
                            className="varde-spinner"
                            role="status"
                            aria-label="Localisation en cours"
                          />
                        ) : (
                          <Icon name="locate" size={18} />
                        )}
                      </span>
                      <span className="mc-lab">Ma position</span>
                    </button>
                    {/* Route-line slope colouring — only meaningful with a trace. */}
                    {hasTrace && (
                      <button
                        type="button"
                        className={"mc-btn" + (slopeOn ? " on" : "")}
                        onClick={() => setSlopeOn(!slopeOn)}
                        aria-pressed={slopeOn}
                      >
                        <span className="mc-ico">
                          <Icon name="grad" size={18} />
                        </span>
                        <span className="mc-lab">Calque pente</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className={"mc-btn" + (terrainSlopeOn ? " on" : "")}
                      onClick={() => setTerrainSlopeOn(!terrainSlopeOn)}
                      aria-pressed={terrainSlopeOn}
                    >
                      <span className="mc-ico">
                        <Icon name="mountain" size={18} />
                      </span>
                      <span className="mc-lab">Carte des pentes</span>
                    </button>
                    <button
                      type="button"
                      className={"mc-btn" + (poiFilterOpen ? " on" : "")}
                      onClick={() => setPoiFilterOpen((open) => !open)}
                      aria-expanded={poiFilterOpen}
                    >
                      <span className="mc-ico">
                        <Icon name="layers" size={18} />
                      </span>
                      <span className="mc-lab">Points d&apos;intérêt</span>
                    </button>
                  </>
                )}
              </div>
              {poiFilterOpen && (
                <PoiFilterPanel
                  selectedCategories={selectedCategories}
                  selectedKinds={selectedKinds}
                  onToggleCategory={toggleCategory}
                  onToggleKind={toggleKind}
                  onClose={() => setPoiFilterOpen(false)}
                />
              )}
              <div className="map-legends">
                {terrainSlopeOn && (
                  <div className="slope-legend terrain-slope-legend">
                    <span className="tsl-title">Pente du terrain</span>
                    <SlopeRangeControl range={slopeRange} onChange={setSlopeRange} />
                  </div>
                )}
                {hasTrace &&
                  (slopeOn ? (
                    <div className="slope-legend">
                      <div className="sl-row">
                        <span className="sl-lab">Montée</span>
                        <span className="sl-bar up" />
                        <span className="sl-mx mono">30%+</span>
                      </div>
                      <div className="sl-row">
                        <span className="sl-lab">Descente</span>
                        <span className="sl-bar down" />
                        <span className="sl-mx mono">30%+</span>
                      </div>
                    </div>
                  ) : (
                    <div className="map-legend">
                      <span>
                        <i className="lg eau" /> Eau
                        {waterLoading && (
                          <span
                            className="varde-spinner"
                            role="status"
                            aria-label="Chargement des points d'eau"
                          />
                        )}
                      </span>
                      <span>
                        <i className="lg ravito" /> Ravito
                      </span>
                      <span>
                        <i className="lg refuge" /> Refuge
                      </span>
                      <span>
                        <i className="lg dash" /> À vérifier
                      </span>
                    </div>
                  ))}
              </div>
              {selectedPoiData && (
                <PoiDetail
                  poi={selectedPoiData}
                  seg={selectedPoiSeg}
                  onClose={() => setSelectedPoi(null)}
                />
              )}
            </div>
            {hasTrace && (
              <div className="profile-panel">
                <div className="pp-head">
                  <span className="pp-title">Profil altimétrique</span>
                  <span className="pp-hint mono">
                    {hoverKm != null
                      ? `${hoverKm.toFixed(1).replace(".", ",")} km`
                      : "survole pour explorer"}
                  </span>
                </div>
                <ElevationProfile
                  route={route}
                  pois={pois}
                  bands={bands}
                  hoverKm={hoverKm}
                  setHoverKm={setHoverKm}
                  slopeOn={slopeOn}
                  selected={selected}
                  setSelected={setSelected}
                  autonomyMode={AUTONOMY_MODE}
                />
              </div>
            )}
          </section>

          {hasTrace && (
            <AutonomyPanels
              segments={segments}
              terrain={terrain}
              selected={selected}
              setSelected={setSelected}
              hoverKm={hoverKm}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}
        </div>
      </main>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(t) => {
          setTrace(t);
          setImportOpen(false);
          setSelected(null);
          setSelectedPoi(null);
        }}
      />
    </div>
  );
}
