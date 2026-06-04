"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  ROUTE,
  POIS,
  SEGMENTS,
  TOTAL_KM,
  gradeAt,
  pointAtKm,
  minEle,
  maxEle,
  type PoiType,
} from "@/lib/varde/data";
import { slopeColor } from "@/lib/varde/slope";
import type { AutonomyMode } from "@/components/varde/topo-map";

type ElevationProfileProps = {
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

  const plotW = w - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const minE = Math.floor(minEle / 100) * 100 - 20;
  const maxE = Math.ceil(maxEle / 100) * 100 + 20;
  const xOf = (km: number) => PAD_L + (km / TOTAL_KM) * plotW;
  const yOf = (e: number) => PAD_T + plotH - ((e - minE) / (maxE - minE)) * plotH;

  const areaD = useMemo(() => {
    let d = `M${xOf(0)},${yOf(ROUTE[0].ele)}`;
    for (const p of ROUTE) d += ` L${xOf(p.dist).toFixed(1)},${yOf(p.ele).toFixed(1)}`;
    d += ` L${xOf(TOTAL_KM)},${PAD_T + plotH} L${xOf(0)},${PAD_T + plotH} Z`;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

  const lineD = useMemo(() => {
    return "M" + ROUTE.map((p) => `${xOf(p.dist).toFixed(1)},${yOf(p.ele).toFixed(1)}`).join(" L");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);

  const slopeBars = useMemo(() => {
    if (!slopeOn) return null;
    const bars: Array<{ x: number; w: number; color: string }> = [];
    const stepN = 2;
    for (let i = 0; i < ROUTE.length - stepN; i += stepN) {
      const a = ROUTE[i];
      const b = ROUTE[Math.min(ROUTE.length - 1, i + stepN)];
      bars.push({
        x: xOf(a.dist),
        w: Math.max(1, xOf(b.dist) - xOf(a.dist)),
        color: slopeColor(gradeAt(i + 1)),
      });
    }
    return bars;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slopeOn, w]);

  const hoverPt = hoverKm != null ? pointAtKm(hoverKm) : null;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * w;
    const km = ((x - PAD_L) / plotW) * TOTAL_KM;
    if (km >= 0 && km <= TOTAL_KM) setHoverKm(km);
    else setHoverKm(null);
  }

  const yTicks: number[] = [];
  for (let e = Math.ceil(minE / 200) * 200; e <= maxE; e += 200) yTicks.push(e);
  const xTicks: number[] = [];
  for (let k = 0; k <= TOTAL_KM; k += 5) xTicks.push(k);

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
          SEGMENTS.map((s, i) => (
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

        {POIS.map((p) => {
          const e = pointAtKm(p.km).ele;
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
