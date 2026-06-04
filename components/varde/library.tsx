"use client";

import { Icon } from "@/components/varde/icon";
import { LIBRARY, fmtDur, rng, type LibraryItem } from "@/lib/varde/data";

type LibraryProps = {
  onOpen: (item: LibraryItem) => void;
  onImport: () => void;
};

function MiniProfile({ seed, active }: { seed: number; active?: boolean }) {
  const r = rng(seed);
  const N = 40;
  const w = 220;
  const h = 46;
  const pts: Array<[number, number]> = [];
  let e = 0.4 + r() * 0.2;
  for (let i = 0; i < N; i++) {
    e += (r() - 0.45) * 0.16;
    e = Math.max(0.08, Math.min(0.95, e));
    pts.push([(i / (N - 1)) * w, h - e * h]);
  }
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L");
  const area = line + ` L${w},${h} L0,${h} Z`;
  return (
    <svg className="mini-prof" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} className={"mp-area" + (active ? " active" : "")} />
      <path d={line} className={"mp-line" + (active ? " active" : "")} fill="none" />
    </svg>
  );
}

function tagSlug(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z]/g, "");
}

export function Library({ onOpen, onImport }: LibraryProps) {
  return (
    <div className="library">
      <div className="lib-head">
        <div>
          <h1>Mes traces</h1>
          <p>Prépare tes sorties : trace, points d&apos;eau, ravitos et autonomie.</p>
        </div>
        <div className="lib-head-actions">
          <button type="button" className="btn ghost" onClick={onImport}>
            <Icon name="import" size={17} /> Importer un GPX
          </button>
          <button type="button" className="btn primary">
            <Icon name="pencil" size={17} /> Nouvelle trace
          </button>
        </div>
      </div>

      <div className="lib-grid">
        <button type="button" className="trace-card new" onClick={onImport}>
          <div className="new-plus">
            <Icon name="pencil" size={24} />
          </div>
          <div className="new-t">Dessiner une trace</div>
          <div className="new-s">ou importer un fichier GPX</div>
        </button>

        {LIBRARY.map((t) => (
          <button
            key={t.id}
            type="button"
            className={"trace-card" + (t.active ? " featured" : "")}
            onClick={() => onOpen(t)}
          >
            <div className="tc-mapthumb">
              <MiniProfile seed={t.id.charCodeAt(1) * 7 + 3} active={t.active} />
              <span className={"tc-tag " + tagSlug(t.tag)}>{t.tag}</span>
            </div>
            <div className="tc-body">
              <div className="tc-name">{t.name}</div>
              <div className="tc-stats mono">
                <span>{t.dist.toFixed(1).replace(".", ",")} km</span>
                <span className="up">+{t.dplus}</span>
                <span>{fmtDur(t.hours)}</span>
              </div>
              <div className="tc-auto">
                <span className="tc-drop">
                  <Icon name="drop" size={13} /> {t.stops} pts d&apos;eau
                </span>
                <span className="tc-water">{t.water.toFixed(1).replace(".", ",")} L max</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
