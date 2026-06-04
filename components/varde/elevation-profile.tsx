"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  gradeAt,
  pointAtKm,
  type Poi,
  type PoiType,
  type RoutePoint,
  type Segment,
} from "@/lib/varde/data";
import { slopeColor } from "@/lib/varde/slope";
import type { AutonomyMode } from "@/components/varde/topo-map";

type ElevationProfileProps = {
  route: readonly RoutePoint[];
  pois: readonly Poi[];
  segments: readonly Segment[];
  hoverKm: number | null;
  setHoverKm: (km: number | null) => void;
  slopeOn: boolean;
  selectedSeg: number | null;
  setSelectedSeg: (i: number | null) => void;
  autonomyMode: AutonomyMode;
};

const H = 168;
const PAD_L = 46;
const PAD_R = 16;
const PAD_T = 14;
const PAD_B = 26;

const POI_COLOR: Record<PoiType, string> = {
  eau: "var(--poi-eau)",
  source: "var(--poi-eau)",
  ravito: "var(--poi-ravito)",
  refuge: "var(--poi-refuge)",
};

export function ElevationProfile({
  route,
  pois,
  segments,
  hoverKm,
  setHoverKm,
  slopeOn,
  selectedSeg,
  setSelectedSeg,
  autonomyMode,
}: ElevationProfileProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Axis bounds derive from the loaded route; with no route they collapse to a
  // harmless empty plot (no segments/POIs/line are drawn below).
  const totalKm = route.length > 0 ? route[route.length - 1].dist : 0;
  const { minEle, maxEle } = useMemo(() => {
    if (route.length === 0) return { minEle: 0, maxEle: 0 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of route) {
      if (p.ele < lo) lo = p.ele;
      if (p.ele > hi) hi = p.ele;
    }
    return { minEle: lo, maxEle: hi };
  }, [route]);

  const plotW = w - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const minE = Math.floor(minEle / 100) * 100 - 20;
  const maxE = Math.ceil(maxEle / 100) * 100 + 20;
  const xSpan = totalKm || 1;
  const xOf = (km: number) => PAD_L + (km / xSpan) * plotW;
  const yOf = (e: number) => PAD_T + plotH - ((e - minE) / (maxE - minE)) * plotH;

  const areaD = useMemo(() => {
    if (route.length === 0) return "";
    let d = `M${xOf(0)},${yOf(route[0].ele)}`;
    for (const p of route) d += ` L${xOf(p.dist).toFixed(1)},${yOf(p.ele).toFixed(1)}`;
    d += ` L${xOf(totalKm)},${PAD_T + plotH} L${xOf(0)},${PAD_T + plotH} Z`;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, w]);

  const lineD = useMemo(() => {
    if (route.length === 0) return "";
    return "M" + route.map((p) => `${xOf(p.dist).toFixed(1)},${yOf(p.ele).toFixed(1)}`).join(" L");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, w]);

  const slopeBars = useMemo(() => {
    if (!slopeOn || route.length === 0) return null;
    const bars: Array<{ x: number; w: number; color: string }> = [];
    const stepN = 2;
    for (let i = 0; i < route.length - stepN; i += stepN) {
      const a = route[i];
      const b = route[Math.min(route.length - 1, i + stepN)];
      bars.push({
        x: xOf(a.dist),
        w: Math.max(1, xOf(b.dist) - xOf(a.dist)),
        color: slopeColor(gradeAt(route, i + 1)),
      });
    }
    return bars;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slopeOn, route, w]);

  const hoverPt = hoverKm != null && route.length > 0 ? pointAtKm(route, hoverKm) : null;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    if (route.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const km = ((x - PAD_L) / plotW) * totalKm;
    if (km >= 0 && km <= totalKm) setHoverKm(km);
    else setHoverKm(null);
  }

  const yTicks: number[] = [];
  for (let e = Math.ceil(minE / 200) * 200; e <= maxE; e += 200) yTicks.push(e);
  const xTicks: number[] = [];
  for (let k = 0; k <= totalKm; k += 5) xTicks.push(k);

  return (
    <div className="profile-wrap" ref={wrapRef}>
      <svg
        className="profile-svg"
        viewBox={`0 0 ${w} ${H}`}
        width="100%"
        height={H}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverKm(null)}
      >
        <defs>
          <linearGradient id="prof-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--prof-fill-top)" />
            <stop offset="100%" stopColor="var(--prof-fill-bot)" />
          </linearGradient>
          <clipPath id="prof-clip">
            <path d={areaD} />
          </clipPath>
        </defs>

        <g className="prof-grid">
          {yTicks.map((e) => (
            <g key={e}>
              <line x1={PAD_L} y1={yOf(e)} x2={w - PAD_R} y2={yOf(e)} />
              <text x={PAD_L - 8} y={yOf(e) + 3} className="prof-ylab">
                {e}
              </text>
            </g>
          ))}
        </g>

        {autonomyMode !== "badges" &&
          segments.map((s, i) => (
            <rect
              key={i}
              x={xOf(s.from.km)}
              y={PAD_T}
              width={xOf(s.to.km) - xOf(s.from.km)}
              height={plotH}
              className={"seg-band" + (selectedSeg === i ? " active" : "")}
              onClick={() => setSelectedSeg(selectedSeg === i ? null : i)}
              style={{ cursor: "pointer" }}
            />
          ))}

        <path d={areaD} fill="url(#prof-fill)" className="prof-area" />

        {slopeBars && (
          <g clipPath="url(#prof-clip)">
            {slopeBars.map((b, i) => (
              <rect key={i} x={b.x} y={PAD_T} width={b.w + 0.5} height={plotH} fill={b.color} opacity="0.92" />
            ))}
          </g>
        )}

        <path d={lineD} className="prof-line" fill="none" />

        {pois.map((p) => {
          const e = pointAtKm(route, p.km).ele;
          return (
            <g key={p.id}>
              <line x1={xOf(p.km)} y1={PAD_T} x2={xOf(p.km)} y2={PAD_T + plotH} className="poi-vline" />
              <circle
                cx={xOf(p.km)}
                cy={yOf(e)}
                r="4.5"
                fill={POI_COLOR[p.type]}
                stroke="var(--marker-stroke)"
                strokeWidth="1.5"
                strokeDasharray={p.fiable ? undefined : "2 2"}
              />
            </g>
          );
        })}

        <g className="prof-grid">
          {xTicks.map((k) => (
            <text key={k} x={xOf(k)} y={H - 8} className="prof-xlab">
              {k}
            </text>
          ))}
          <text x={w - PAD_R} y={H - 8} className="prof-xlab end">
            km
          </text>
        </g>

        {hoverPt && hoverKm != null && (
          <g>
            <line x1={xOf(hoverKm)} y1={PAD_T} x2={xOf(hoverKm)} y2={PAD_T + plotH} className="hover-line" />
            <circle cx={xOf(hoverKm)} cy={yOf(hoverPt.ele)} r="4.5" className="hover-dot-prof" />
            <g
              transform={`translate(${Math.min(w - 96, Math.max(PAD_L, xOf(hoverKm) + 8))},${PAD_T + 4})`}
            >
              <rect width="88" height="34" rx="5" className="hover-tip" />
              <text x="8" y="15" className="hover-tip-t1">
                {hoverKm.toFixed(1).replace(".", ",")} km
              </text>
              <text x="8" y="28" className="hover-tip-t2">
                {Math.round(hoverPt.ele)} m
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}
