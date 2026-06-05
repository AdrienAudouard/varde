"use client";

import { Icon } from "@/components/varde/icon";
import { fmtDur, fmtTime, type Segment } from "@/lib/varde/data";

type AutonomyPanelProps = {
  segments: readonly Segment[];
  selected: number | null;
  setSelected: (i: number | null) => void;
  hoverKm: number | null;
};

function WaterGauge({ liters }: { liters: number }) {
  const cells = Math.ceil(liters / 0.5);
  return (
    <div className="wgauge" title={liters.toFixed(2) + " L"}>
      {Array.from({ length: Math.max(cells, 1) }).map((_, i) => (
        <span key={i} className={"wcell" + (i < liters / 0.5 ? " full" : "")} />
      ))}
      <span className="wgauge-lab">{liters.toFixed(1).replace(".", ",")} L</span>
    </div>
  );
}

export function AutonomyPanel({ segments, selected, setSelected, hoverKm }: AutonomyPanelProps) {
  const totalWater = segments.reduce((a, s) => a + s.water, 0);
  const longest = segments.reduce((a, s) => Math.max(a, s.dist), 0);
  const maxWater = segments.reduce((a, s) => Math.max(a, s.water), 0);
  return (
    <>
      <div className="au-head">
        <h2>Plan d&apos;autonomie</h2>
        <p>Entre chaque point d&apos;eau : ce qu&apos;il faut prévoir.</p>
      </div>
      <div className="au-summary">
        <div className="aus">
          <span className="aus-v">{segments.length}</span>
          <span className="aus-l">segments</span>
        </div>
        <div className="aus">
          <span className="aus-v">
            {longest.toFixed(1).replace(".", ",")}
            <small> km</small>
          </span>
          <span className="aus-l">+ long sans eau</span>
        </div>
        <div className="aus">
          <span className="aus-v">
            {maxWater.toFixed(1).replace(".", ",")}
            <small> L</small>
          </span>
          <span className="aus-l">à porter (max)</span>
        </div>
      </div>
      <div className="au-list">
        {segments.map((s, i) => {
          const active = selected === i;
          const here = hoverKm != null && hoverKm >= s.from.km && hoverKm <= s.to.km;
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
                <div className="seg-route">
                  <span className="seg-dot start" />
                  <div className="seg-names">
                    <span className="seg-from">{s.from.name}</span>
                    <span className="seg-arrow">→ {s.to.name}</span>
                  </div>
                </div>
                <div className="seg-arrive">
                  <Icon name="clock" size={13} /> {fmtTime(s.arrive)}
                </div>
              </div>
              <div className="segcard-stats">
                <div className="ss">
                  <span className="ss-v">{s.dist.toFixed(1).replace(".", ",")}</span>
                  <span className="ss-l">km</span>
                </div>
                <div className="ss up">
                  <Icon name="up" size={13} />
                  <span className="ss-v">{Math.round(s.dplus)}</span>
                  <span className="ss-l">D+</span>
                </div>
                <div className="ss down">
                  <Icon name="down" size={13} />
                  <span className="ss-v">{Math.round(s.dminus)}</span>
                  <span className="ss-l">D−</span>
                </div>
                <div className="ss">
                  <span className="ss-v">{fmtDur(s.hours)}</span>
                  <span className="ss-l">durée</span>
                </div>
              </div>
              <WaterGauge liters={s.water} />
            </div>
          );
        })}
      </div>
      <div className="au-foot">
        <span>Total à boire estimé</span>
        <strong>{totalWater.toFixed(1).replace(".", ",")} L</strong>
      </div>
    </>
  );
}
