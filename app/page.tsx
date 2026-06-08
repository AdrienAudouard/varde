"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/varde/icon";
import { LeftRail, type View } from "@/components/varde/left-rail";
import { TopBar } from "@/components/varde/top-bar";
import type { AutonomyMode } from "@/components/varde/topo-map";
import { ElevationProfile } from "@/components/varde/elevation-profile";
import { AutonomyPanels, type AutonomyTab } from "@/components/varde/autonomy-panels";
import { PoiDetail } from "@/components/varde/poi-detail";
import { Library } from "@/components/varde/library";
import { ImportModal } from "@/components/varde/import-modal";
import { buildSegments, type Trace } from "@/lib/varde/data";
import { buildTerrain } from "@/lib/varde/terrain";
import { SLOPE_BAND_LEGEND } from "@/lib/varde/terrain-slope";
import { waterPointsToPois } from "@/lib/varde/water-proximity";
import { useRouteWaterPoints } from "@/components/varde/use-route-water-points";

// MapLibre touches `window` at module load — keep it out of the server bundle.
const TopoMap = dynamic(
  () => import("@/components/varde/topo-map").then((m) => m.TopoMap),
  { ssr: false, loading: () => <div className="topomap topomap-loading" /> },
);

const AUTONOMY_MODE: AutonomyMode = "panel";

export default function Page() {
  const [view, setView] = useState<View>("plan");
  const [slopeOn, setSlopeOn] = useState(false);
  const [terrainSlopeOn, setTerrainSlopeOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateTarget, setLocateTarget] = useState<{ lng: number; lat: number } | null>(null);
  const [hoverKm, setHoverKm] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AutonomyTab>("water");
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [trace, setTrace] = useState<Trace | null>(null);

  const route = useMemo(() => trace?.route ?? [], [trace]);

  // Single Overpass fetch for the whole route; projected onto the path and
  // merged into the trace so the pure `buildSegments` picks the water points up.
  const { waterPoints, isLoading: waterLoading, error: waterError } = useRouteWaterPoints(route);
  const derivedPois = useMemo(
    () => waterPointsToPois(route, waterPoints),
    [route, waterPoints],
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
      <LeftRail view={view} setView={setView} />

      <main className="main">
        {view === "plan" && (
          <>
            <TopBar
              trace={trace}
              segments={segments}
              onImport={() => setImportOpen(true)}
            />
            <div className="plan-body">
              <section className="map-col">
                <div className="map-stage">
                  <TopoMap
                    trace={mergedTrace}
                    waterPoints={waterPoints}
                    slopeOn={slopeOn}
                    terrainSlopeOn={terrainSlopeOn}
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
                      Overpass API : {waterError}
                    </div>
                  )}
                  {locateError && (
                    <div className="varde-water-error" role="status">
                      {locateError}
                    </div>
                  )}
                  <div className="map-ctrls">
                    <button type="button" className="mc-btn">
                      +
                    </button>
                    <button type="button" className="mc-btn">
                      −
                    </button>
                    <button
                      type="button"
                      className="mc-btn"
                      onClick={handleLocate}
                      disabled={locating}
                      title="Ma position"
                      aria-label="Centrer sur ma position"
                    >
                      {locating ? (
                        <span
                          className="varde-spinner"
                          role="status"
                          aria-label="Localisation en cours"
                        />
                      ) : (
                        <Icon name="locate" size={18} />
                      )}
                    </button>
                    <button
                      type="button"
                      className={"mc-btn" + (slopeOn ? " on" : "")}
                      onClick={() => setSlopeOn(!slopeOn)}
                      title="Calque pente"
                    >
                      <Icon name="grad" size={18} />
                    </button>
                    <button
                      type="button"
                      className={"mc-btn" + (terrainSlopeOn ? " on" : "")}
                      onClick={() => setTerrainSlopeOn(!terrainSlopeOn)}
                      title="Carte des pentes"
                    >
                      <Icon name="layers" size={18} />
                    </button>
                  </div>
                  <div className="map-legends">
                    {terrainSlopeOn && (
                      <div className="slope-legend terrain-slope-legend">
                        <span className="tsl-title">Pente du terrain</span>
                        {SLOPE_BAND_LEGEND.map((band) => (
                          <div className="sl-row" key={band.label}>
                            <span className="tsl-sw" style={{ background: band.color }} />
                            <span className="sl-lab">{band.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {slopeOn ? (
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
                    )}
                  </div>
                  {selectedPoiData && (
                    <PoiDetail
                      poi={selectedPoiData}
                      seg={selectedPoiSeg}
                      onClose={() => setSelectedPoi(null)}
                    />
                  )}
                </div>
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
              </section>

              {hasTrace ? (
                <AutonomyPanels
                  segments={segments}
                  terrain={terrain}
                  selected={selected}
                  setSelected={setSelected}
                  hoverKm={hoverKm}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              ) : (
                <aside className="autonomy">
                  <div className="empty-state">
                    <div className="empty-state-ic">
                      <Icon name="route" size={28} />
                    </div>
                    <h2 className="empty-state-title">Aucune trace chargée</h2>
                    <p className="empty-state-text">
                      Importe un fichier GPX pour visualiser le profil, les points d&apos;eau et le
                      plan d&apos;autonomie.
                    </p>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setImportOpen(true)}
                    >
                      <Icon name="import" size={17} /> Importer un GPX
                    </button>
                  </div>
                </aside>
              )}
            </div>
          </>
        )}

        {view === "library" && <Library onImport={() => setImportOpen(true)} />}
      </main>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(t) => {
          setTrace(t);
          setImportOpen(false);
          setView("plan");
          setSelected(null);
          setSelectedPoi(null);
        }}
      />
    </div>
  );
}
