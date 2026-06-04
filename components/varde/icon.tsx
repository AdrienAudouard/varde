import type { ReactNode } from "react";

export type IconName =
  | "library"
  | "pencil"
  | "import"
  | "layers"
  | "drop"
  | "clock"
  | "up"
  | "down"
  | "route"
  | "settings"
  | "flag"
  | "close"
  | "edit"
  | "alert"
  | "check"
  | "house"
  | "fork"
  | "grad";

const PATHS: Record<IconName, ReactNode> = {
  library: (
    <g>
      <rect x="3" y="4" width="14" height="16" rx="1.5" />
      <path d="M7 4v16M20 6v14" />
    </g>
  ),
  pencil: (
    <g>
      <path d="M4 20l4-1 9.5-9.5a2 2 0 0 0-2.8-2.8L5 16z" />
    </g>
  ),
  import: (
    <g>
      <path d="M12 3v11M8 11l4 4 4-4" />
      <path d="M4 19h16" />
    </g>
  ),
  layers: (
    <g>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </g>
  ),
  drop: (
    <g>
      <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" />
    </g>
  ),
  clock: (
    <g>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </g>
  ),
  up: (
    <g>
      <path d="M5 17l7-10 7 10" />
    </g>
  ),
  down: (
    <g>
      <path d="M5 7l7 10 7-10" />
    </g>
  ),
  route: (
    <g>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8 6h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8" />
    </g>
  ),
  settings: (
    <g>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </g>
  ),
  flag: (
    <g>
      <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
    </g>
  ),
  close: (
    <g>
      <path d="M6 6l12 12M18 6L6 18" />
    </g>
  ),
  edit: (
    <g>
      <path d="M4 20l4-1 9.5-9.5a2 2 0 0 0-2.8-2.8L5 16z" />
    </g>
  ),
  alert: (
    <g>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17v.5" />
    </g>
  ),
  check: (
    <g>
      <path d="M5 12l5 5 9-11" />
    </g>
  ),
  house: (
    <g>
      <path d="M4 11l8-6 8 6M6 10v9h12v-9" />
    </g>
  ),
  fork: (
    <g>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7v10M15 7v4" />
    </g>
  ),
  grad: (
    <g>
      <path d="M3 20h18M3 20L17 6M9 20l8-9" />
    </g>
  ),
};

type IconProps = {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{
        width: size,
        height: size,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      }}
    >
      {PATHS[name]}
    </svg>
  );
}
