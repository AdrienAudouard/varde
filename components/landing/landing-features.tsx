import type { Dictionary } from "@/lib/i18n/dictionaries";
import { TopoMapMock } from "./topo-map-mock";
import { ElevationProfileMock } from "./elevation-profile-mock";
import { WaterDropGlyph } from "./landing-glyphs";

interface LandingFeaturesProps {
  dict: Dictionary["features"];
}

const TOTAL_GAUGE_CELLS = 6;

const ITEM_ICONS: Record<string, React.ReactNode> = {
  water: <WaterDropGlyph size={13} />,
  clock: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  warn: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.3 3.5 2 18a1.5 1.5 0 0 0 1.3 2.3h17.4A1.5 1.5 0 0 0 22 18L13.7 3.5a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h0" />
    </svg>
  ),
};

const SEG_DOT_COLOR: Record<string, string> = {
  ravito: "var(--poi-ravito)",
  refuge: "var(--poi-refuge)",
  eau: "var(--poi-eau)",
};

function WaterGauge({ filled, label }: { filled: number; label: string }) {
  return (
    <div className="wgauge">
      {Array.from({ length: TOTAL_GAUGE_CELLS }, (_, i) => (
        <span key={i} className={i < filled ? "wcell full" : "wcell"} />
      ))}
      <span className="wgauge-lab">{label}</span>
    </div>
  );
}

export function LandingFeatures({ dict }: LandingFeaturesProps) {
  return (
    <section className="features band" id="features">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">
            <span className="dot">●</span> {dict.eyebrow}
          </span>
          <h2 className="display">{dict.title}</h2>
          <p>{dict.lead}</p>
        </div>

        <div className="feat-hero">
          <div className="feat-copy">
            <div className="fc-eyebrow">
              <span className="fc-num">{dict.primary.num}</span>
              <span className="eyebrow">{dict.primary.eyebrow}</span>
            </div>
            <h3 className="display">{dict.primary.title}</h3>
            <p>{dict.primary.body}</p>
            <ul className="feat-list">
              {dict.primary.items.map((item, i) => (
                <li key={i}>
                  <span className="li-ic">{ITEM_ICONS[item.icon]}</span>
                  <span>
                    <b>{item.bold}</b> <span className="sub">{item.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="au-preview">
            <div className="aup-head">
              <h4>{dict.preview.headTitle}</h4>
              <p>{dict.preview.headSub}</p>
            </div>
            <div className="aup-summary">
              <div className="aup-s">
                <div className="v">8</div>
                <div className="l">{dict.preview.summary.segments}</div>
              </div>
              <div className="aup-s">
                <div className="v">
                  7.1 <small>km</small>
                </div>
                <div className="l">{dict.preview.summary.longestDry}</div>
              </div>
              <div className="aup-s">
                <div className="v">
                  1.1 <small>L</small>
                </div>
                <div className="l">{dict.preview.summary.carryMax}</div>
              </div>
            </div>
            <div className="aup-list">
              {dict.preview.segments.map((seg, i) => (
                <div key={i} className={i === 0 ? "segcard here" : "segcard"}>
                  <div className="sc-top">
                    <div className="sc-route">
                      <span className="sc-dot" style={{ background: SEG_DOT_COLOR[seg.color] }} />
                      <div>
                        <div className="sc-from">{seg.from}</div>
                        <div className="sc-arrow">{seg.to}</div>
                      </div>
                    </div>
                    <span className="sc-time">{seg.time}</span>
                  </div>
                  <div className="sc-stats">
                    <span className="sc-stat">
                      <span className="v">{seg.km}</span>
                      <span className="l">{dict.preview.units.km}</span>
                    </span>
                    <span className="sc-stat up">
                      <span className="v">{seg.up}</span>
                      <span className="l">{dict.preview.units.up}</span>
                    </span>
                    <span className="sc-stat down">
                      <span className="v">{seg.down}</span>
                      <span className="l">{dict.preview.units.down}</span>
                    </span>
                  </div>
                  <WaterGauge filled={seg.filledCells} label={seg.liters} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="feat-row">
          <div className="feat-card">
            <div className="fcd-visual">
              <TopoMapMock id="feat" slope />
              <div className="slope-legend">
                <div className="sl-row">
                  <span className="sl-lab">{dict.topo.legend.climb}</span>
                  <span className="sl-bar up" />
                </div>
                <div className="sl-row">
                  <span className="sl-lab">{dict.topo.legend.descent}</span>
                  <span className="sl-bar down" />
                </div>
              </div>
            </div>
            <div className="fcd-body">
              <div className="fc-eyebrow">
                <span className="fc-num">{dict.topo.num}</span>
                <span className="eyebrow">{dict.topo.eyebrow}</span>
              </div>
              <h3 className="display">{dict.topo.title}</h3>
              <p>{dict.topo.body}</p>
            </div>
          </div>

          <div className="feat-card">
            <div className="fcd-visual prof">
              <div style={{ width: "100%" }}>
                <ElevationProfileMock id="fp" pois />
              </div>
            </div>
            <div className="fcd-body">
              <div className="fc-eyebrow">
                <span className="fc-num">{dict.profile.num}</span>
                <span className="eyebrow">{dict.profile.eyebrow}</span>
              </div>
              <h3 className="display">{dict.profile.title}</h3>
              <p>{dict.profile.body}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
