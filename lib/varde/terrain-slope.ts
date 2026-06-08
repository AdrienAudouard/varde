// Pure terrain slope-angle shading — decodes a terrain-RGB DEM tile, computes
// the ground slope angle per pixel, and colours it into discrete avalanche-style
// bands (the SLF / IGN "carte des pentes" convention). Strictly lib-level: no
// DOM, no MapLibre, typed-array in/out — SSR-safe and trivially movable to a Web
// Worker. The browser-only fetch/canvas pipeline that drives this lives in
// components/varde/terrain-slope-protocol.ts.
//
// Distinct from `slope.ts`, which colours the *route line* by percent grade —
// different units (angle° vs grade%) and a different domain (whole terrain vs a
// single track), so the two palettes intentionally don't share code.

type Rgb = readonly [number, number, number];

// Slope-angle bands, ordered gentlest → steepest. Anything below the first
// band's `minDeg` renders transparent so gentle terrain shows the basemap
// through — the avalanche-map convention. The user asked for "steep climbs", so
// if their typical terrain reads too empty, lower the 30° floor here (e.g. to
// 25) — a one-line change, single source of truth for the renderer and legend.
type SlopeBand = { readonly minDeg: number; readonly rgb: Rgb };
const BANDS: readonly SlopeBand[] = [
  { minDeg: 30, rgb: [242, 224, 24] }, // yellow
  { minDeg: 35, rgb: [232, 138, 30] }, // orange
  { minDeg: 40, rgb: [216, 49, 43] }, // red
  { minDeg: 45, rgb: [139, 58, 158] }, // purple
];

// Slope angle (°) → grade (%) = tan(angle) × 100, rounded. The legend is shown
// in grade %, which trail users read more readily than degrees; the underlying
// classification stays angle-based (the SLF/IGN avalanche-map standard), so the
// percentages are the exact equivalents of the 30/35/40/45° band edges.
function gradePercent(deg: number): number {
  return Math.round(Math.tan((deg * Math.PI) / 180) * 100);
}

// Legend descriptors derived from the same band table, so the UI legend can
// never drift from what's actually rendered. Each label is the band's grade-%
// range; the steepest band is open-ended.
export const SLOPE_BAND_LEGEND: ReadonlyArray<{ label: string; color: string }> = BANDS.map(
  (b, i) => {
    const next = BANDS[i + 1];
    return {
      label: next
        ? `${gradePercent(b.minDeg)}–${gradePercent(next.minDeg)}%`
        : `≥ ${gradePercent(b.minDeg)}%`,
      color: `rgb(${b.rgb[0]},${b.rgb[1]},${b.rgb[2]})`,
    };
  },
);

// Mapbox / MapTiler terrain-RGB encoding → metres above sea level.
export function decodeElevation(r: number, g: number, b: number): number {
  return -10000 + (r * 65536 + g * 256 + b) * 0.1;
}

// WGS84 equatorial circumference (m), for the Web-Mercator ground resolution.
const EARTH_CIRCUMFERENCE_M = 40075016.6856;

// Ground metres per pixel for a Web-Mercator tile at zoom `z`, row `tileY`,
// decoded to `tilePx` pixels wide. Mercator is conformal, so the same value
// applies to both the E–W and N–S pixel spacing at a given latitude. Latitude
// is taken at the tile centre — across one tile the variation is sub-degree at
// the zooms this overlay is used (≥9), so a per-row recompute isn't worth it.
// `tilePx` MUST be the real decoded bitmap width (512 for MapTiler's @2x DEM),
// never a 256 literal, or every angle comes out wrong by a factor of two.
export function groundResolutionMeters(z: number, tileY: number, tilePx: number): number {
  const n = 2 ** z;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 0.5)) / n)));
  return (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / (n * tilePx);
}

// Index into BANDS for a slope angle, or -1 if below the gentlest band. Single
// source of truth for both the per-pixel hot loop and the tuple helper below.
function bandIndex(deg: number): number {
  let idx = -1;
  for (let i = 0; i < BANDS.length; i++) {
    if (deg >= BANDS[i].minDeg) idx = i;
  }
  return idx;
}

// Per-pixel RGBA for a slope angle. Alpha is binary (0 below the gentlest band,
// else 255): overall translucency is the raster layer's `raster-opacity`, which
// keeps band edges crisp. Exposed for tests; the tile loop inlines the lookup.
export function slopeAngleToRgba(deg: number): readonly [number, number, number, number] {
  const i = bandIndex(deg);
  if (i < 0) return [0, 0, 0, 0];
  const [r, g, b] = BANDS[i].rgb;
  return [r, g, b, 255];
}

// Decode a terrain-RGB tile and return an RGBA buffer coloured by slope angle.
// `src` is the raw RGBA from getImageData (length width*height*4); the result is
// a new same-length buffer ready for putImageData (zero-filled = transparent).
//
// Slope per pixel from a central difference on the decoded elevation grid:
//   dz/dx = (E − W) / (2·res),  dz/dy = (S − N) / (2·res)
//   angle = atan(hypot(dz/dx, dz/dy))
// Border pixels clamp to the nearest interior column/row, leaving a 1px hairline
// seam between tiles — acceptable at typical opacity. The seamless upgrade is to
// sample the neighbouring tiles' edge pixels.
export function colorizeSlopeRGBA(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  z: number,
  tileY: number,
): Uint8ClampedArray {
  const inv2res = 1 / (2 * groundResolutionMeters(z, tileY, width));
  const RAD2DEG = 180 / Math.PI;

  // Decode elevation once into a Float32 grid, then run the gradient over it.
  const elev = new Float32Array(width * height);
  for (let i = 0; i < elev.length; i++) {
    const o = i * 4;
    elev[i] = decodeElevation(src[o], src[o + 1], src[o + 2]);
  }

  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < height; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDn = y < height - 1 ? y + 1 : height - 1;
    const rowUp = yUp * width;
    const rowDn = yDn * width;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const xW = x > 0 ? x - 1 : 0;
      const xE = x < width - 1 ? x + 1 : width - 1;
      const dzdx = (elev[row + xE] - elev[row + xW]) * inv2res;
      const dzdy = (elev[rowDn + x] - elev[rowUp + x]) * inv2res;
      const deg = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * RAD2DEG;
      const bi = bandIndex(deg);
      if (bi < 0) continue; // below the gentlest band → leave transparent
      const rgb = BANDS[bi].rgb;
      const o = (row + x) * 4;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = 255;
    }
  }
  return out;
}
