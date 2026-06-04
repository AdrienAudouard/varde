"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/varde/icon";
import { LeftRail, type View } from "@/components/varde/left-rail";
import { TopBar } from "@/components/varde/top-bar";
import type { AutonomyMode } from "@/components/varde/topo-map";
import { ElevationProfile } from "@/components/varde/elevation-profile";
import { AutonomyPanel } from "@/components/varde/autonomy-panel";
import { RecapTable } from "@/components/varde/recap-table";
import { PoiDetail } from "@/components/varde/poi-detail";
import { Library } from "@/components/varde/library";
import { ImportModal } from "@/components/varde/import-modal";

// MapLibre touches `window` at module load — keep it out of the server bundle.
const TopoMap = dynamic(
  () => import("@/components/varde/topo-map").then((m) => m.TopoMap),
  { ssr: false, loading: () => <div className="topomap topomap-loading" /> },
);

const AUTONOMY_MODE: AutonomyMode = "panel";

export default function Page() {
  const [view, setView] = useState<View>("plan");
  const [slopeOn, setSlopeOn] = useState(false);
  const [hoverKm, setHoverKm] = useState<number | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="app">
      <LeftRail view={view} setView={setView} />

      <main className="main">
        {view === "plan" && (
          <>
            <TopBar
              slopeOn={slopeOn}
              setSlopeOn={setSlopeOn}
              onImport={() => setImportOpen(true)}
            />
            <div className="plan-body">
              <section className="map-col">
                <div className="map-stage">
                  <TopoMap
                    slopeOn={slopeOn}
                    hoverKm={hoverKm}
                    setHoverKm={setHoverKm}
                    selectedSeg={selectedSeg}
                    autonomyMode={AUTONOMY_MODE}
                    selectedPoi={selectedPoi}
                    setSelectedPoi={setSelectedPoi}
                  />
                  <div className="map-ctrls">
                    <button type="button" className="mc-btn">
                      +
                    </button>
                    <button type="button" className="mc-btn">
                      −
                    </button>
                    <button
                      type="button"
                      className={"mc-btn" + (slopeOn ? " on" : "")}
                      onClick={() => setSlopeOn(!slopeOn)}
                      title="Calque pente"
                    >
                      <Icon name="grad" size={18} />
                    </button>
                    <button type="button" className="mc-btn" title="Calques">
                      <Icon name="layers" size={18} />
                    </button>
                  </div>
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
                  {selectedPoi && <PoiDetail poiId={selectedPoi} onClose={() => setSelectedPoi(null)} />}
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
                    hoverKm={hoverKm}
                    setHoverKm={setHoverKm}
                    slopeOn={slopeOn}
                    selectedSeg={selectedSeg}
                    setSelectedSeg={setSelectedSeg}
                    autonomyMode={AUTONOMY_MODE}
                  />
                </div>
              </section>

              {AUTONOMY_MODE === "table" ? (
                <RecapTable selectedSeg={selectedSeg} setSelectedSeg={setSelectedSeg} />
              ) : (
                <AutonomyPanel
                  selectedSeg={selectedSeg}
                  setSelectedSeg={setSelectedSeg}
                  hoverKm={hoverKm}
                />
              )}
            </div>
          </>
        )}

        {view === "library" && (
          <Library onOpen={() => setView("plan")} onImport={() => setImportOpen(true)} />
        )}
      </main>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => {
          setImportOpen(false);
          setView("plan");
        }}
      />
    </div>
  );
}
