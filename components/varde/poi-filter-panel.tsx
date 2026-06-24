"use client";

// Advanced "which POIs to show" filter, nested: category (water / refuge /
// supermarket) at the top, water sub-kinds underneath. Categories drive the
// server query; water sub-kinds filter the already-fetched points client-side.
// Only water has data today — refuge/supermarket are shown for the final shape
// and marked "à venir".

import { Icon } from "@/components/varde/icon";
import {
  KIND_LABEL,
  WATER_FILTER_KINDS,
  WaterPointKind,
} from "@/lib/varde/water-points";

type CategoryConfig = {
  key: string;
  label: string;
  /** Has data in the collection today. */
  available: boolean;
  /** Nested sub-kinds (water only, for now). */
  kinds: readonly WaterPointKind[];
};

// Top-level categories. `water` is the only one with data; the others are
// selectable placeholders so the panel shows the eventual shape.
export const POI_CATEGORIES: readonly CategoryConfig[] = [
  { key: "water", label: "Points d'eau", available: true, kinds: WATER_FILTER_KINDS },
  { key: "refuge", label: "Refuges", available: false, kinds: [] },
  { key: "supermarket", label: "Supermarchés", available: false, kinds: [] },
];

type PoiFilterPanelProps = {
  selectedCategories: ReadonlySet<string>;
  selectedKinds: ReadonlySet<WaterPointKind>;
  onToggleCategory: (key: string) => void;
  onToggleKind: (kind: WaterPointKind) => void;
  onClose: () => void;
};

export function PoiFilterPanel({
  selectedCategories,
  selectedKinds,
  onToggleCategory,
  onToggleKind,
  onClose,
}: PoiFilterPanelProps) {
  return (
    <div className="poi-filter" role="group" aria-label="Filtrer les points d'intérêt">
      <div className="pf-head">
        <span className="pf-title">Points d&apos;intérêt</span>
        <button type="button" className="pf-close" onClick={onClose} aria-label="Fermer le filtre">
          <Icon name="close" size={15} />
        </button>
      </div>

      {POI_CATEGORIES.map((cat) => {
        const catOn = selectedCategories.has(cat.key);
        return (
          <div key={cat.key} className="pf-cat">
            <label className={"pf-row" + (cat.available ? "" : " disabled")}>
              <input
                type="checkbox"
                checked={catOn}
                disabled={!cat.available}
                onChange={() => onToggleCategory(cat.key)}
              />
              <span className="pf-lab">{cat.label}</span>
              {!cat.available && <span className="pf-soon">à venir</span>}
            </label>

            {cat.available && catOn && cat.kinds.length > 0 && (
              <div className="pf-kinds">
                {cat.kinds.map((kind) => (
                  <label key={kind} className="pf-row pf-kind">
                    <input
                      type="checkbox"
                      checked={selectedKinds.has(kind)}
                      onChange={() => onToggleKind(kind)}
                    />
                    <span className={"pf-dot pf-dot-" + kind} aria-hidden="true" />
                    <span className="pf-lab">{KIND_LABEL[kind]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
