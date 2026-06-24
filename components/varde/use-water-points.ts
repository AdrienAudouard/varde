"use client";

// Fetches water points within a bbox from the MongoDB-backed /api/water-points
// route, debounced so rapid bbox changes (map panning, quick re-imports, dev
// StrictMode double-invoke) collapse into one request, and the in-flight request
// is aborted when the bbox changes again.
//
// Two entry points share the same core:
//   - useWaterPoints(bbox, categories) — caller supplies the bbox (e.g. the map
//                                        viewport) and which POI categories to
//                                        query; populates the on-map overlay.
//   - useRouteWaterPoints(route)       — bbox derived from a route's padded extent,
//                                        always water, used to project water onto
//                                        the path for the plan. Kept separate so the
//                                        plan stays anchored when the map pans away
//                                        and is never narrowed by the display filter.

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoutePoint } from "@/lib/varde/data";
import { routeBbox } from "@/lib/varde/geo";
import { fetchWaterPoints, type Bbox, type WaterPoint } from "@/lib/varde/water-points";

// Pad a route's search box by ~1.5 km in degrees so a point within the proximity
// threshold of an endpoint still falls inside the queried area.
const BBOX_PAD_DEG = 0.014;

// Wait this long after the last bbox change before hitting the database.
const DEBOUNCE_MS = 300;

// The plan always queries water, regardless of the map's display filter.
const WATER_CATEGORIES: readonly string[] = ["water"];

export type WaterPointsResult = {
  waterPoints: readonly WaterPoint[];
  isLoading: boolean;
  error: string | null;
};

const EMPTY: readonly WaterPoint[] = [];
const EMPTY_RESULT: WaterPointsResult = { waterPoints: EMPTY, isLoading: false, error: null };

export function useWaterPoints(
  bbox: Bbox | null,
  categories: readonly string[],
): WaterPointsResult {
  const [result, setResult] = useState<WaterPointsResult>(EMPTY_RESULT);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Value-based key: a fresh categories array of equal values must NOT refire the
  // fetch, so the effect deps on this string (and reconstructs the array from it)
  // rather than on the array's identity. Empty string ⇒ nothing selected.
  const catKey = categories.length ? [...categories].sort().join(",") : "";

  useEffect(() => {
    if (!bbox || !catKey) return;
    const cats = catKey.split(",");

    const ctrl = new AbortController();
    // Debounce the request: a burst of bbox changes only fires the last one.
    const timer = setTimeout(() => {
      setResult({ waterPoints: EMPTY, isLoading: true, error: null });

      fetchWaterPoints(bbox, cats, ctrl.signal)
        .then((points) => {
          if (ctrl.signal.aborted || !aliveRef.current) return;
          setResult({ waterPoints: points, isLoading: false, error: null });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!aliveRef.current) return;
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[varde/water-points] fetch failed", err);
          setResult({ waterPoints: EMPTY, isLoading: false, error: msg });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [bbox, catKey]);

  // No bbox or no categories selected ⇒ clean empty state without storing it
  // (storing it synchronously in an effect causes cascading renders).
  return bbox && catKey ? result : EMPTY_RESULT;
}

export function useRouteWaterPoints(route: readonly RoutePoint[]): WaterPointsResult {
  // A stable bbox: only re-fetch when the route's (padded) extent changes, not
  // on every render. `null` means there's no route to query.
  const bbox = useMemo<Bbox | null>(() => routeBbox(route, BBOX_PAD_DEG), [route]);
  return useWaterPoints(bbox, WATER_CATEGORIES);
}
