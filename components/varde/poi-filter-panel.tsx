"use client";

// Advanced "which POIs to show" filter, nested: category (water / refuge /
// supermarket) at the top, sub-kinds underneath. Categories drive the server
// query; sub-kinds filter the already-fetched points client-side. Water and
// refuge both have data; supermarket is a selectable placeholder ("à venir").
// Each category carries its own sub-kinds + labels so the panel stays data-driven
// across POI types.

import { Icon } from "@/components/varde/icon";
import {
  KIND_LABEL as WATER_KIND_LABEL,
  WATER_FILTER_KINDS,
} from "@/lib/varde/water-points";
import {
  KIND_LABEL as REFUGE_KIND_LABEL,
  REFUGE_FILTER_KINDS,
} from "@/lib/varde/refuges";

type CategoryConfig = {
  key: string;
  label: string;
  /** Has data in the collection today. */
  available: boolean;
  /** Nested sub-kinds — wire values, used as the `pf-dot-<kind>` class + key. */
  kinds: readonly string[];
  /** Display label per sub-kind. */
  kindLabel: Record<string, string>;
};

// Top-level categories. `water` and `refuge` have data; `supermarket` is a
// selectable placeholder so the panel shows the eventual shape.
export const POI_CATEGORIES: readonly CategoryConfig[] = [
  {
    key: "water",
    label: "Points d'eau",
    available: true,
    kinds: WATER_FILTER_KINDS,
    kindLabel: WATER_KIND_LABEL,
  },
  {
    key: "refuge",
    label: "Refuges",
    available: true,
    kinds: REFUGE_FILTER_KINDS,
    kindLabel: REFUGE_KIND_LABEL,
  },
  { key: "supermarket", label: "Supermarchés", available: false, kinds: [], kindLabel: {} },
];

type PoiFilterPanelProps = {
  selectedCategories: ReadonlySet<string>;
  selectedKinds: ReadonlySet<string>;
  onToggleCategory: (key: string) => void;
  onToggleKind: (kind: string) => void;
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
                    <span className="pf-lab">{cat.kindLabel[kind]}</span>
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
