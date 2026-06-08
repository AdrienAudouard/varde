"use client";

// Single Overpass fetch for the whole route, fired once per trace. The route's
// bounding box (padded so points near the endpoints aren't clipped) is the only
// query input, so the result is stable for a given trace — page-level derivation
// then projects these onto the path. This replaces the old viewport-driven
// refetch loop that lived in the map.

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoutePoint } from "@/lib/varde/data";
import { routeBbox } from "@/lib/varde/geo";
import { fetchWaterPoints, type Bbox, type WaterPoint } from "@/lib/varde/overpass";

// Pad the search box by ~1.5 km in degrees so a point within the proximity
// threshold of an endpoint still falls inside the queried area. ~0.014° latitude
// ≈ 1.5 km; longitude is wider near the equator but the route's own latitudes
// here keep this comfortably generous.
const BBOX_PAD_DEG = 0.014;

export type RouteWaterPoints = {
  waterPoints: readonly WaterPoint[];
  isLoading: boolean;
  error: string | null;
};

const EMPTY: readonly WaterPoint[] = [];
const EMPTY_RESULT: RouteWaterPoints = { waterPoints: EMPTY, isLoading: false, error: null };

export function useRouteWaterPoints(route: readonly RoutePoint[]): RouteWaterPoints {
  const [result, setResult] = useState<RouteWaterPoints>(EMPTY_RESULT);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // A stable bbox key: re-fetch only when the route's (padded) extent changes,
  // not on every render. `null` means there's no route to query.
  const bbox = useMemo<Bbox | null>(() => routeBbox(route, BBOX_PAD_DEG), [route]);

  useEffect(() => {
    if (!bbox) return;

    const ctrl = new AbortController();
    // Flip to loading as the fetch starts. This is the legitimate effect→state
    // case (signalling an external-system request is in flight), not derived
    // state; the cascading-render lint doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult({ waterPoints: EMPTY, isLoading: true, error: null });

    fetchWaterPoints(bbox, ctrl.signal)
      .then((points) => {
        if (ctrl.signal.aborted || !aliveRef.current) return;
        setResult({ waterPoints: points, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!aliveRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[varde/overpass] route fetch failed", err);
        setResult({ waterPoints: EMPTY, isLoading: false, error: msg });
      });

    return () => ctrl.abort();
  }, [bbox]);

  // With no route there's nothing to fetch; report a clean empty state without
  // storing it (storing it synchronously in an effect causes cascading renders).
  return bbox ? result : EMPTY_RESULT;
}
