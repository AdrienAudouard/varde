"use client";

import { AutonomyPanel } from "@/components/varde/autonomy-panel";
import { TerrainPanel } from "@/components/varde/terrain-panel";
import type { Segment } from "@/lib/varde/data";
import type { TerrainSection } from "@/lib/varde/terrain";

export type AutonomyTab = "water" | "terrain";

type AutonomyPanelsProps = {
  segments: readonly Segment[];
  terrain: readonly TerrainSection[];
  selected: number | null;
  setSelected: (i: number | null) => void;
  hoverKm: number | null;
  activeTab: AutonomyTab;
  setActiveTab: (tab: AutonomyTab) => void;
};

export function AutonomyPanels({
  segments,
  terrain,
  selected,
  setSelected,
  hoverKm,
  activeTab,
  setActiveTab,
}: AutonomyPanelsProps) {
  // Switching tabs clears the selection so a stale index can't point past the
  // end of the newly-active list.
  function switchTab(tab: AutonomyTab) {
    setActiveTab(tab);
    setSelected(null);
  }
  return (
    <aside className="autonomy">
      <div className="au-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className="au-tab"
          aria-selected={activeTab === "water"}
          onClick={() => switchTab("water")}
        >
          Plan d&apos;eau
        </button>
        <button
          type="button"
          role="tab"
          className="au-tab"
          aria-selected={activeTab === "terrain"}
          onClick={() => switchTab("terrain")}
        >
          Terrain
        </button>
      </div>
      {activeTab === "water" ? (
        <AutonomyPanel
          segments={segments}
          selected={selected}
          setSelected={setSelected}
          hoverKm={hoverKm}
        />
      ) : (
        <TerrainPanel
          terrain={terrain}
          selected={selected}
          setSelected={setSelected}
          hoverKm={hoverKm}
        />
      )}
    </aside>
  );
}
