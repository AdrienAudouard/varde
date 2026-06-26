// Client access to mountain refuges (shelters), backed by the refuges.info
// public API through the /api/refuges route handler. Unlike water points
// (MongoDB-backed), this data is third-party and fetched live: the route proxies
// refuges.info, transforms its GeoJSON, and returns this exact Refuge[] shape, so
// the client just fetches and forwards. Classification lives server-side.

import type { Bbox } from "@/lib/varde/water-points";

// String enum (wire values unchanged) so call sites reference members instead of
// magic strings. The values double as the map feature's `kind` property and the
// CSS `pf-dot-<kind>` class suffix. Ids map to refuges.info point types.
export enum RefugeKind {
  Guarded = "refuge_garde", // refuges.info type 10 — staffed refuge
  Unguarded = "cabane_non_gardee", // type 7 — unstaffed cabin
  Gite = "gite_etape", // type 9 — gîte d'étape
  Other = "other",
}

// The refuge sub-kinds offered in the map filter, in display order. `Other` is
// reachable by the classifier (unexpected type ids) but not offered in the UI.
export const REFUGE_FILTER_KINDS: readonly RefugeKind[] = [
  RefugeKind.Guarded,
  RefugeKind.Unguarded,
  RefugeKind.Gite,
];

export type Refuge = {
  /** refuges.info point id — stable across requests, used as React/feature key. */
  id: number;
  kind: RefugeKind;
  lng: number;
  lat: number;
  name?: string;
  /** Altitude in metres (properties.coord.alt). */
  alt?: number;
  /** Sleeping capacity (properties.places.valeur); omitted when 0/unknown. */
  beds?: number;
  /**
   * Whether the refuge provides water. Drives the autonomy plan: only
   * water-bearing refuges are projected onto the route as resupply stops, so a
   * dry shelter never resets the water-need gauge. Derived server-side from the
   * point type (staffed refuge) or the icon name (encodes "eau").
   */
  hasWater: boolean;
  /** Free-text status (properties.etat.valeur), e.g. "Fermé"; omitted when empty. */
  status?: string;
  /** Link to the refuges.info detail page (properties.lien). */
  link?: string;
};

/**
 * Fetch refuges within `bbox` from the refuges.info-backed API. The bbox is
 * passed as query params; the route proxies refuges.info, transforms the GeoJSON
 * and returns ready-to-render Refuges. `categories` mirrors the water route's
 * contract — the request is a no-op (returns []) unless "refuge" is present.
 */
export async function fetchRefuges(
  bbox: Bbox,
  categories: readonly string[],
  signal?: AbortSignal,
): Promise<Refuge[]> {
  const [west, south, east, north] = bbox;
  const qs = new URLSearchParams({
    w: String(west),
    s: String(south),
    e: String(east),
    n: String(north),
    categories: categories.join(","),
  });
  const res = await fetch(`/api/refuges?${qs.toString()}`, { signal });
  // Bare message — the page's overlay already prefixes "Refuges : ".
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Refuge[];
}

export const KIND_LABEL: Record<RefugeKind, string> = {
  [RefugeKind.Guarded]: "Refuge gardé",
  [RefugeKind.Unguarded]: "Cabane non gardée",
  [RefugeKind.Gite]: "Gîte d'étape",
  [RefugeKind.Other]: "Refuge",
};
