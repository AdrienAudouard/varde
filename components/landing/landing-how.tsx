import type { Dictionary } from "@/lib/i18n/dictionaries";
import { WaterDropGlyph } from "./landing-glyphs";

interface LandingHowProps {
  dict: Dictionary["how"];
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  import: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
    </svg>
  ),
  water: <WaterDropGlyph size={13} />,
  export: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3v5h5M14 3l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h8Z" />
    </svg>
  ),
};

export function LandingHow({ dict }: LandingHowProps) {
  return (
    <section className="how" id="how">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">
            <span className="dot">●</span> {dict.eyebrow}
          </span>
          <h2 className="display">{dict.title}</h2>
          <p>{dict.lead}</p>
        </div>
        <div className="steps">
          {dict.steps.map((step) => (
            <div className="step" key={step.num}>
              <div className="step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <span className="step-meta">
                {STEP_ICONS[step.icon]} {step.meta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
