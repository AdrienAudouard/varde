import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { TopoMapMock } from "./topo-map-mock";
import { WaterDropGlyph } from "./landing-glyphs";

interface LandingHeroProps {
  dict: Dictionary["hero"];
}

export function LandingHero({ dict }: LandingHeroProps) {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="dot">●</span> {dict.eyebrow}
            </span>
            <h1 className="display">
              {dict.headline}
              <span className="em">{dict.headlineEm}</span>
            </h1>
            <p className="lead">{dict.lead}</p>

            <div className="hero-feats">
              <span className="hf">
                <span className="hf-ic">
                  <WaterDropGlyph />
                </span>{" "}
                {dict.feats.water}
              </span>
              <span className="hf">
                <span className="hf-ic">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 17l5-7 4 4 4-8 5 8" />
                  </svg>
                </span>{" "}
                {dict.feats.timing}
              </span>
              <span className="hf">
                <span className="hf-ic">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
                    <path d="M9 4v14M15 6v14" />
                  </svg>
                </span>{" "}
                {dict.feats.gpx}
              </span>
            </div>

            <div className="hero-cta">
              <Link className="btn primary" href="/app">
                {dict.launch}
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="map-card">
              <TopoMapMock id="hero" />
              <div className="map-chip">
                <span className="tag">{dict.mapChipTag}</span> {dict.mapChipName}
              </div>
              <div className="map-legend">
                <span>
                  <span className="lg eau" />
                  {dict.legend.water}
                </span>
                <span>
                  <span className="lg ravito" />
                  {dict.legend.refuel}
                </span>
                <span>
                  <span className="lg refuge" />
                  {dict.legend.refuge}
                </span>
              </div>
            </div>
            <div className="float-seg">
              <div className="fs-top">
                <div className="fs-route">
                  <span className="fs-dot" />
                  <div>
                    <div className="fs-from">{dict.floatSeg.from}</div>
                    <div className="fs-arrow">{dict.floatSeg.to}</div>
                  </div>
                </div>
                <span className="fs-time">{dict.floatSeg.time}</span>
              </div>
              <div className="fs-stats">
                <span className="fs-stat">
                  <span className="v">5.6</span>
                  <span className="l">{dict.floatSeg.km}</span>
                </span>
                <span className="fs-stat up">
                  <span className="v">+505</span>
                  <span className="l">{dict.floatSeg.up}</span>
                </span>
                <span className="fs-stat down">
                  <span className="v">−272</span>
                  <span className="l">{dict.floatSeg.down}</span>
                </span>
              </div>
              <div className="wgauge">
                <span className="wcell full" />
                <span className="wcell full" />
                <span className="wcell full" />
                <span className="wcell full" />
                <span className="wcell full" />
                <span className="wcell" />
                <span className="wgauge-lab">{dict.floatSeg.liters}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
