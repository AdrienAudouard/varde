import {
  CONTOURS,
  gradeAt,
  poiMapPos,
  POI_COLOR,
  POIS,
  ROUTE,
  routeD,
  slopeColor,
  type PoiType,
} from "@/lib/varde/landing-mock";

const VBW = 1000;
const VBH = 680;
const SLOPE_STEP = 3;

// The route geometry is identical for every instance, so compute the path
// string and the projected POI positions once at module scope.
const ROUTE_D = routeD();
const POI_POSITIONS = POIS.map((p) => ({ ...p, pos: poiMapPos(p.km, p.offset) }));

// Vertical bars of grid lines, then horizontal — matches the source's `.grat`.
const GRAT_VERTICAL = Array.from({ length: 9 }, (_, i) => i * 125);
const GRAT_HORIZONTAL = Array.from({ length: 6 }, (_, i) => i * 136);

// Slope-colored segments along the route (only used when `slope` is on).
const SLOPE_SEGMENTS = (() => {
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  for (let i = 0; i < ROUTE.length - SLOPE_STEP; i += SLOPE_STEP) {
    const a = ROUTE[i];
    const b = ROUTE[Math.min(ROUTE.length - 1, i + SLOPE_STEP)];
    segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: slopeColor(gradeAt(i + 1)) });
  }
  return segs;
})();

function PoiGlyph({ type }: { type: PoiType }) {
  if (type === "eau") return <path d="M0,-6 C4,-1 4.5,2 0,6 C-4.5,2 -4,-1 0,-6 Z" fill="#fff" />;
  if (type === "source")
    return (
      <path
        d="M0,-6 C4,-1 4.5,2 0,6 C-4.5,2 -4,-1 0,-6 Z"
        fill="none"
        stroke="#fff"
        strokeWidth={1.6}
      />
    );
  if (type === "ravito")
    return <rect x={-4.5} y={-4.5} width={9} height={9} rx={1.5} fill="#fff" />;
  if (type === "refuge") return <path d="M-5,4 L-5,-1 L0,-5 L5,-1 L5,4 Z" fill="#fff" />;
  return null;
}

interface TopoMapMockProps {
  id: string;
  slope?: boolean;
}

// Deterministic topographic map rendered as static SVG. `id` namespaces the
// hill gradient def so multiple instances (hero + feature) don't collide.
export function TopoMapMock({ id, slope = false }: TopoMapMockProps) {
  const hillId = `hill-${id}`;
  return (
    <svg
      className="topomap"
      viewBox={`0 0 ${VBW} ${VBH}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={hillId} cx="40%" cy="32%" r="75%">
          <stop offset="0%" stopColor="var(--hill-hi)" />
          <stop offset="100%" stopColor="var(--hill-lo)" />
        </radialGradient>
      </defs>

      <rect x={0} y={0} width={VBW} height={VBH} fill="var(--map-base)" />
      <rect x={0} y={0} width={VBW} height={VBH} fill={`url(#${hillId})`} opacity={0.55} />

      <g className="forest" opacity={0.5}>
        <ellipse cx={250} cy={250} rx={170} ry={120} />
        <ellipse cx={720} cy={200} rx={150} ry={110} />
        <ellipse cx={600} cy={560} rx={200} ry={130} />
        <ellipse cx={120} cy={470} rx={120} ry={150} />
      </g>

      <g className="water">
        <ellipse cx={245} cy={585} rx={78} ry={34} />
        <path d="M323,585 Q420,600 470,560 T640,560 Q720,540 800,560" fill="none" className="river" />
      </g>

      <g className="grat">
        {GRAT_VERTICAL.map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={VBH} />
        ))}
        {GRAT_HORIZONTAL.map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={VBW} y2={y} />
        ))}
      </g>

      <g className="contours">
        {CONTOURS.map((rings, gi) =>
          rings.map((r, ri) => (
            <path key={`${gi}-${ri}`} d={r.d} className={r.bold ? "contour bold" : "contour"} />
          )),
        )}
      </g>

      {slope ? (
        <>
          <path d={ROUTE_D} className="route-casing" />
          <g>
            {SLOPE_SEGMENTS.map((s, i) => (
              <line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={s.color}
                strokeWidth={6.5}
                strokeLinecap="round"
              />
            ))}
          </g>
        </>
      ) : (
        <>
          <path d={ROUTE_D} className="route-casing" />
          <path d={ROUTE_D} className="route-main" />
        </>
      )}

      <g className="poi-connectors">
        {POI_POSITIONS.map((p) => (
          <line key={p.id} x1={p.pos.anchorX} y1={p.pos.anchorY} x2={p.pos.x} y2={p.pos.y} />
        ))}
      </g>
      <g>
        {POI_POSITIONS.map((p) => (
          <circle key={p.id} cx={p.pos.anchorX} cy={p.pos.anchorY} r={3.2} className="poi-anchor" />
        ))}
      </g>

      <g className="terminus">
        <circle cx={ROUTE[0].x} cy={ROUTE[0].y} r={9} className="start" />
        <circle cx={ROUTE[ROUTE.length - 1].x} cy={ROUTE[ROUTE.length - 1].y} r={9} className="finish" />
      </g>

      <g>
        {POI_POSITIONS.map((p) => (
          <g
            key={p.id}
            transform={`translate(${p.pos.x.toFixed(1)},${p.pos.y.toFixed(1)})`}
            className="poi"
          >
            <circle
              r={12}
              fill={POI_COLOR[p.type]}
              className="poi-dot"
              stroke="var(--marker-stroke)"
              strokeWidth={2.5}
            />
            <PoiGlyph type={p.type} />
            {!p.fiable && (
              <circle
                r={20}
                fill="none"
                stroke={POI_COLOR[p.type]}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.8}
              />
            )}
          </g>
        ))}
      </g>
    </svg>
  );
}
