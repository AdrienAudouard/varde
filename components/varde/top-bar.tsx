"use client";

// Buttons here keep the design's `.btn` utility classes (Varde tokens) rather
// than shadcn Button: the visual language is paper-themed and tightly coupled
// to the CSS variables in globals.css.

import { Icon } from "@/components/varde/icon";
import { fmtDur, type Segment, type Trace } from "@/lib/varde/data";

type TopBarProps = {
  trace: Trace | null;
  segments: readonly Segment[];
  onImport: () => void;
};

type StatProps = {
  label: string;
  val: string;
  sub: string;
};

const PLACEHOLDER = "—";

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

export function TopBar({ trace, segments, onImport }: TopBarProps) {
  const hasTrace = trace != null && segments.length > 0;

  const totalKm = trace != null && trace.route.length > 0 ? trace.route[trace.route.length - 1].dist : 0;
  let dplus = 0;
  let dminus = 0;
  for (const s of segments) {
    dplus += s.dplus;
    dminus += s.dminus;
  }
  const totalHours = segments.reduce((a, s) => a + s.hours, 0);
  const maxWater = hasTrace ? segments.reduce((a, s) => Math.max(a, s.water), 0) : 0;

  return (
    <header className="topbar">
      <div className="tb-title">
        <div className="tb-name">
          {hasTrace ? "Trace importée" : "Aucune trace"}
          <button type="button" className="tb-edit" disabled={!hasTrace}>
            <Icon name="edit" size={15} />
          </button>
        </div>
        <div className="tb-meta">
          {hasTrace ? (
            <>
              Plan d&apos;autonomie · <span className="tb-tag">En préparation</span>
            </>
          ) : (
            "Importe un GPX pour commencer"
          )}
        </div>
      </div>
      <div className="tb-stats">
        <Stat
          label="Distance"
          val={hasTrace ? totalKm.toFixed(1).replace(".", ",") : PLACEHOLDER}
          sub={hasTrace ? " km" : ""}
        />
        <Stat label="D+" val={hasTrace ? "+" + Math.round(dplus) : PLACEHOLDER} sub={hasTrace ? " m" : ""} />
        <Stat label="D−" val={hasTrace ? "−" + Math.round(dminus) : PLACEHOLDER} sub={hasTrace ? " m" : ""} />
        <Stat label="Estimé" val={hasTrace ? fmtDur(totalHours) : PLACEHOLDER} sub="" />
        <Stat
          label="Eau / segment"
          val={hasTrace ? maxWater.toFixed(1).replace(".", ",") : PLACEHOLDER}
          sub={hasTrace ? " L" : ""}
        />
      </div>
      <div className="tb-actions">
        <button type="button" className="btn ghost" onClick={onImport}>
          <Icon name="import" size={17} /> Importer GPX
        </button>
        <button type="button" className="btn primary" disabled={!hasTrace}>
          <Icon name="import" size={17} /> Exporter
        </button>
      </div>
    </header>
  );
}
