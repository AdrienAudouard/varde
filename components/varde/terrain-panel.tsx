"use client";

import { Icon } from "@/components/varde/icon";
import { fmtDur } from "@/lib/varde/data";
import type { TerrainSection, TerrainType } from "@/lib/varde/terrain";

type TerrainPanelProps = {
  terrain: readonly TerrainSection[];
  selected: number | null;
  setSelected: (i: number | null) => void;
  hoverKm: number | null;
};

const TERRAIN_LABEL: Record<TerrainType, string> = {
  up: "Montée",
  down: "Descente",
  flat: "Plat",
};

function fmtKm(km: number): string {
  return km.toFixed(1).replace(".", ",");
}

function fmtGrade(grade: number): string {
  const sign = grade >= 0 ? "+" : "";
  return sign + grade.toFixed(1).replace(".", ",");
}

export function TerrainPanel({ terrain, selected, setSelected, hoverKm }: TerrainPanelProps) {
  const upCount = terrain.reduce((a, t) => a + (t.type === "up" ? 1 : 0), 0);
  const downCount = terrain.reduce((a, t) => a + (t.type === "down" ? 1 : 0), 0);
  const totalUp = terrain.reduce((a, t) => a + t.dplus, 0);
  const totalDown = terrain.reduce((a, t) => a + t.dminus, 0);
  return (
    <>
      <div className="au-head">
        <h2>Profil du terrain</h2>
        <p>Montées, descentes et plats du parcours.</p>
      </div>
      <div className="au-summary">
        <div className="aus">
          <span className="aus-v">{upCount}</span>
          <span className="aus-l">montées</span>
        </div>
        <div className="aus">
          <span className="aus-v">{downCount}</span>
          <span className="aus-l">descentes</span>
        </div>
        <div className="aus">
          <span className="aus-v">
            {Math.round(totalUp)}
            <small> / {Math.round(totalDown)} m</small>
          </span>
          <span className="aus-l">D+ / D−</span>
        </div>
      </div>
      <div className="au-list">
        {terrain.map((t, i) => {
          const active = selected === i;
          const here = hoverKm != null && hoverKm >= t.fromKm && hoverKm <= t.toKm;
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              className={"segcard" + (active ? " active" : "") + (here ? " here" : "")}
              onClick={() => setSelected(active ? null : i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(active ? null : i);
                }
              }}
            >
              <div className="segcard-top">
                <span className={"terr-badge " + t.type}>{TERRAIN_LABEL[t.type]}</span>
                <div className="seg-arrive">
                  {fmtKm(t.fromKm)}–{fmtKm(t.toKm)} km
                </div>
              </div>
              <div className="segcard-stats">
                <div className="ss">
                  <span className="ss-v">{fmtKm(t.dist)}</span>
                  <span className="ss-l">km</span>
                </div>
                <div className="ss up">
                  <Icon name="up" size={13} />
                  <span className="ss-v">{Math.round(t.dplus)}</span>
                  <span className="ss-l">D+</span>
                </div>
                <div className="ss down">
                  <Icon name="down" size={13} />
                  <span className="ss-v">{Math.round(t.dminus)}</span>
                  <span className="ss-l">D−</span>
                </div>
                <div className="ss">
                  <span className="ss-v">{fmtGrade(t.avgGrade)}</span>
                  <span className="ss-l">% moy.</span>
                </div>
                <div className="ss">
                  <span className="ss-v">{fmtDur(t.hours)}</span>
                  <span className="ss-l">durée</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
