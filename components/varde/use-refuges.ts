"use client";

// Fetches refuges within a bbox from the refuges.info-backed /api/refuges route,
// debounced so rapid bbox changes (map panning, dev StrictMode double-invoke)
// collapse into one request, with the in-flight request aborted on change.
// Mirrors use-water-points.ts.
//
// Two entry points share the same core:
//   - useRefuges(bbox, categories) — caller supplies the bbox (the map viewport)
//                                    and the selected POI categories; only queries
//                                    when "refuge" is selected, so unchecking the
//                                    category stops the third-party call.
//   - useRouteRefuges(route)       — bbox derived from a route's padded extent,
//                                    always refuges, used to project them onto the
//                                    path for the plan.

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoutePoint } from "@/lib/varde/data";
import { routeBbox } from "@/lib/varde/geo";
import { fetchRefuges, type Refuge } from "@/lib/varde/refuges";
import type { Bbox } from "@/lib/varde/water-points";

// Pad a route's search box by ~1.5 km in degrees so a refuge within the proximity
// threshold of an endpoint still falls inside the queried area.
const BBOX_PAD_DEG = 0.014;

// Wait this long after the last bbox change before hitting the API.
const DEBOUNCE_MS = 300;

const REFUGE_CATEGORY = "refuge";
const ROUTE_CATEGORIES: readonly string[] = [REFUGE_CATEGORY];

export type RefugesResult = {
  refuges: readonly Refuge[];
  isLoading: boolean;
  error: string | null;
};

const EMPTY: readonly Refuge[] = [];
const EMPTY_RESULT: RefugesResult = { refuges: EMPTY, isLoading: false, error: null };

export function useRefuges(
  bbox: Bbox | null,
  categories: readonly string[],
): RefugesResult {
  const [result, setResult] = useState<RefugesResult>(EMPTY_RESULT);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Gate on the refuge category: unchecking it must stop the third-party call.
  // A boolean is the only thing the effect depends on, so a fresh categories
  // array of equal contents won't refire the fetch.
  const want = categories.includes(REFUGE_CATEGORY);

  useEffect(() => {
    if (!bbox || !want) return;

    const ctrl = new AbortController();
    // Debounce: a burst of bbox changes only fires the last one.
    const timer = setTimeout(() => {
      setResult({ refuges: EMPTY, isLoading: true, error: null });

      fetchRefuges(bbox, ROUTE_CATEGORIES, ctrl.signal)
        .then((refuges) => {
          if (ctrl.signal.aborted || !aliveRef.current) return;
          setResult({ refuges, isLoading: false, error: null });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!aliveRef.current) return;
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[varde/refuges] fetch failed", err);
          setResult({ refuges: EMPTY, isLoading: false, error: msg });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [bbox, want]);

  // No bbox or refuge unselected ⇒ clean empty state without storing it.
  return bbox && want ? result : EMPTY_RESULT;
}

export function useRouteRefuges(route: readonly RoutePoint[]): RefugesResult {
  // A stable bbox: only re-fetch when the route's (padded) extent changes.
  const bbox = useMemo<Bbox | null>(() => routeBbox(route, BBOX_PAD_DEG), [route]);
  return useRefuges(bbox, ROUTE_CATEGORIES);
}
