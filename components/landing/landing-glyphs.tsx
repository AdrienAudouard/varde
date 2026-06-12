// Small inline SVG glyphs reused across more than one landing section. True
// one-offs stay inlined in their own section — only shared shapes live here.

// Water drop: appears in the hero feature chips, the autonomy feature list, and
// the "mark your water" step.
export function WaterDropGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z" />
    </svg>
  );
}

// The Varde summit mark used in the nav brand and the footer brand.
export function BrandMark() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 19L9 7l3.5 6 2-3.5L21 19H3Z" fill="var(--accent)" />
    </svg>
  );
}
