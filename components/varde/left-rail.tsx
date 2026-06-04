"use client";

import { Icon, type IconName } from "@/components/varde/icon";

export type View = "plan" | "library";

type LeftRailProps = {
  view: View;
  setView: (v: View) => void;
};

const ITEMS: ReadonlyArray<{ id: View; icon: IconName; label: string }> = [
  { id: "plan", icon: "route", label: "Plan" },
  { id: "library", icon: "library", label: "Traces" },
];

export function LeftRail({ view, setView }: LeftRailProps) {
  return (
    <nav className="rail">
      <div className="rail-logo" title="Varde">
        <svg viewBox="0 0 24 24" width="26" height="26">
          <path d="M3 20L10 7l4 6 2-3 5 10z" fill="var(--accent)" />
          <circle cx="10" cy="7" r="1.6" fill="var(--paper)" />
        </svg>
      </div>
      <div className="rail-items">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            type="button"
            className={"rail-btn" + (view === it.id ? " active" : "")}
            onClick={() => setView(it.id)}
            title={it.label}
          >
            <Icon name={it.icon} />
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      <div className="rail-bottom">
        <button type="button" className="rail-btn" title="Réglages">
          <Icon name="settings" />
          <span>Réglages</span>
        </button>
      </div>
    </nav>
  );
}
