// Pure terrain slope shading — decodes a terrain-RGB DEM tile, computes the
// ground grade (%) per pixel, and colours only the slopes inside a user-chosen
// [min, max] range with a cool→hot gradient mapped across that range (everything
// outside the range is transparent). Strictly lib-level: no DOM, no MapLibre,
// typed-array in/out — SSR-safe and trivially movable to a Web Worker. The
// browser-only fetch/canvas pipeline that drives this lives in
// components/varde/terrain-slope-protocol.ts.
//
// Grade % (not degrees) is the working unit here: grade = rise/run = the
// gradient magnitude, so grade% = √((dz/dx)² + (dz/dy)²) × 100 directly — no
// atan/tan round-trip. (For reference, 45° = 100%.)
//
// Distinct from `slope.ts`, which colours the *route line* by percent grade
// along a single track.

type Rgb = readonly [number, number, number];

/** Min/max grade (%) the overlay renders. Slopes outside it are transparent. */
export type SlopeRange = { min: number; max: number };

// Default window — moderately steep terrain (≈27°–50°), a sensible starting
// point the user narrows or widens with the on-map control.
export const DEFAULT_SLOPE_RANGE: SlopeRange = { min: 50, max: 120 };

// Cool→hot gradient stops, mapped across the active [min, max] range: a slope at
// `min` reads green, one at `max` reads red, with relative steepness in between.
const RAMP: readonly Rgb[] = [
  [60, 150, 90], // green  (range min)
  [235, 205, 65], // yellow
  [225, 130, 45], // orange
  [198, 45, 38], // red    (range max)
];

// CSS form of the same ramp, for the legend bar — single source of truth so the
// legend can't drift from the pixels.
export const SLOPE_GRADIENT_CSS = `linear-gradient(90deg, ${RAMP.map(
  (c) => `rgb(${c[0]},${c[1]},${c[2]})`,
).join(", ")})`;

// Write the ramp colour for normalised position `t` ∈ [0,1] into `out` at byte
// offset `o`. Inlined ramp lookup (no per-pixel allocation in the hot loop).
// Alpha is binary (255) — overall translucency is the layer's `raster-opacity`.
function writeRampColor(out: Uint8ClampedArray, o: number, t: number): void {
  const clamped = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const seg = clamped * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  out[o] = Math.round(a[0] + (b[0] - a[0]) * f);
  out[o + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
  out[o + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
  out[o + 3] = 255;
}

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
// never a 256 literal, or every grade comes out wrong by a factor of two.
export function groundResolutionMeters(z: number, tileY: number, tilePx: number): number {
  const n = 2 ** z;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (tileY + 0.5)) / n)));
  return (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / (n * tilePx);
}

// Decode a terrain-RGB tile and return an RGBA buffer where only slopes whose
// grade (%) falls in [minPct, maxPct] are coloured (cool→hot across the range);
// everything else is transparent. `src` is the raw RGBA from getImageData
// (length width*height*4); the result is a new same-length buffer ready for
// putImageData (zero-filled = transparent).
//
// Grade per pixel from a central difference on the decoded elevation grid:
//   dz/dx = (E − W) / (2·res),  dz/dy = (S − N) / (2·res)
//   grade% = √(dz/dx² + dz/dy²) × 100
// Border pixels clamp to the nearest interior column/row, leaving a 1px hairline
// seam between tiles — acceptable at typical opacity. The seamless upgrade is to
// sample the neighbouring tiles' edge pixels.
export function colorizeSlopeRGBA(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  z: number,
  tileY: number,
  minPct: number,
  maxPct: number,
): Uint8ClampedArray {
  const inv2res = 1 / (2 * groundResolutionMeters(z, tileY, width));
  const span = Math.max(maxPct - minPct, 1e-6); // guard against a zero-width range

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
      const pct = Math.sqrt(dzdx * dzdx + dzdy * dzdy) * 100;
      if (pct < minPct || pct > maxPct) continue; // outside the window → transparent
      writeRampColor(out, (row + x) * 4, (pct - minPct) / span);
    }
  }
  return out;
}
