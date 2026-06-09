"use client";

import { Slider } from "@/components/ui/slider";
import { SLOPE_GRADIENT_CSS, type SlopeRange } from "@/lib/varde/terrain-slope";

type SlopeRangeControlProps = {
  range: SlopeRange;
  onChange: (range: SlopeRange) => void;
  /** Upper bound of the slider, in grade %. */
  max?: number;
};

// Grade-% window control for the terrain overlay: the shadcn Slider (Radix) in
// range mode — one rail, two thumbs. The filled span between the thumbs carries
// the cool→hot gradient, so it doubles as the legend. Radix keeps the thumbs
// ordered (minStepsBetweenThumbs) and handles pointer + keyboard + a11y.
export function SlopeRangeControl({ range, onChange, max = 150 }: SlopeRangeControlProps) {
  return (
    <div className="rng">
      <span className="rng-readout mono">
        {range.min} – {range.max} %
      </span>
      <div className="rng-slider">
        <Slider
          min={0}
          max={max}
          step={1}
          minStepsBetweenThumbs={1}
          value={[range.min, range.max]}
          onValueChange={(v) => onChange({ min: Math.min(v[0], v[1]), max: Math.max(v[0], v[1]) })}
          rangeStyle={{ background: SLOPE_GRADIENT_CSS }}
          aria-label="Plage de pente (%)"
        />
      </div>
    </div>
  );
}
