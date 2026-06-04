"use client";

// Buttons here keep the design's `.btn` utility classes (Varde tokens) rather
// than shadcn Button: the visual language is paper-themed and tightly coupled
// to the CSS variables in globals.css.

import { Icon } from "@/components/varde/icon";
import { SEGMENTS, dplus, dminus, fmtDur, TOTAL_HOURS } from "@/lib/varde/data";

type TopBarProps = {
  slopeOn: boolean;
  setSlopeOn: (v: boolean) => void;
  onImport: () => void;
};

type StatProps = {
  label: string;
  val: string;
  sub: string;
};

function Stat({ label, val, sub }: StatProps) {
  return (
    <div className="tb-stat">
      <div className="tb-stat-v">
        {val}
        <span className="tb-unit">{sub}</span>
      </div>
      <div className="tb-stat-l">{label}</div>
    </div>
  );
}

export function TopBar({ slopeOn, setSlopeOn, onImport }: TopBarProps) {
  const maxWater = SEGMENTS.reduce((a, s) => Math.max(a, s.water), 0);
  return (
    <header className="topbar">
      <div className="tb-title">
        <div className="tb-name">
          Tour des Crêtes
          <button type="button" className="tb-edit">
            <Icon name="edit" size={15} />
          </button>
        </div>
        <div className="tb-meta">
          Massif du Vallon · créée le 28 mai · <span className="tb-tag">En préparation</span>
        </div>
      </div>
      <div className="tb-stats">
        <Stat label="Distance" val="34,2" sub=" km" />
        <Stat label="D+" val={"+" + dplus} sub=" m" />
        <Stat label="D−" val={"−" + dminus} sub=" m" />
        <Stat label="Estimé" val={fmtDur(TOTAL_HOURS)} sub="" />
        <Stat label="Eau / segment" val={maxWater.toFixed(1).replace(".", ",")} sub=" L" />
      </div>
      <div className="tb-actions">
        <button
          type="button"
          className={"btn ghost" + (slopeOn ? " on" : "")}
          onClick={() => setSlopeOn(!slopeOn)}
        >
          <Icon name="grad" size={17} /> Calque pente
        </button>
        <button type="button" className="btn ghost" onClick={onImport}>
          <Icon name="import" size={17} /> Importer GPX
        </button>
        <button type="button" className="btn primary">
          <Icon name="import" size={17} /> Exporter
        </button>
      </div>
    </header>
  );
}
