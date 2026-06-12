import {
  areaD,
  lineD,
  POI_COLOR,
  POIS,
  pointAtKm,
  profileScale,
  TOTAL_KM,
} from "@/lib/varde/landing-mock";

const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 24;

interface ElevationProfileMockProps {
  id: string;
  pois?: boolean;
  width?: number;
  height?: number;
}

// Deterministic elevation profile rendered as static SVG. `id` namespaces the
// fill gradient def. Mirrors the source's non-compact layout (y/x grid + POIs).
export function ElevationProfileMock({
  id,
  pois = false,
  width = 520,
  height = 172,
}: ElevationProfileMockProps) {
  const gradId = `pf-${id}`;
  const scale = profileScale(width, height, PAD_L, PAD_R, PAD_T, PAD_B);
  const { xOf, yOf, minE, maxE, plotH, padT } = scale;

  const yLabels: number[] = [];
  for (let e = Math.ceil(minE / 200) * 200; e <= maxE; e += 200) yLabels.push(e);

  const xLabels: number[] = [];
  for (let k = 0; k <= TOTAL_KM; k += 5) xLabels.push(k);

  return (
    <svg
      className="profile-svg"
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor="var(--prof-fill-top)" />
          <stop offset="100%" stopColor="var(--prof-fill-bot)" />
        </linearGradient>
      </defs>

      <g className="prof-grid">
        {yLabels.map((e) => (
          <line key={`y${e}`} x1={PAD_L} y1={yOf(e)} x2={width - PAD_R} y2={yOf(e)} />
        ))}
        {yLabels.map((e) => (
          <text key={`yl${e}`} x={PAD_L - 8} y={yOf(e) + 3} className="prof-ylab">
            {e}
          </text>
        ))}
      </g>

      <path d={areaD(scale)} fill={`url(#${gradId})`} className="prof-area" />
      <path d={lineD(scale)} className="prof-line" fill="none" />

      {pois &&
        POIS.map((p) => {
          const e = pointAtKm(p.km).ele;
          return (
            <g key={p.id}>
              <line x1={xOf(p.km)} y1={padT} x2={xOf(p.km)} y2={padT + plotH} className="poi-vline" />
              <circle
                cx={xOf(p.km)}
                cy={yOf(e)}
                r={4.5}
                fill={POI_COLOR[p.type]}
                stroke="var(--marker-stroke)"
                strokeWidth={1.5}
                strokeDasharray={p.fiable ? undefined : "2 2"}
              />
            </g>
          );
        })}

      <g className="prof-grid">
        {xLabels.map((k) => (
          <text key={`x${k}`} x={xOf(k)} y={height - 7} className="prof-xlab">
            {k}
          </text>
        ))}
        <text x={width - PAD_R} y={height - 7} className="prof-xlab end">
          km
        </text>
      </g>
    </svg>
  );
}
