import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { BrandMark } from "./landing-glyphs";

interface LandingFooterProps {
  dict: Dictionary["footer"];
}

export function LandingFooter({ dict }: LandingFooterProps) {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="brand" href="#top">
              <span className="brand-mark">
                <BrandMark />
              </span>
              Varde
            </Link>
            <p>{dict.tagline}</p>
          </div>
          <div className="foot-col">
            <h5>{dict.productHead}</h5>
            <a href="#features">{dict.links.features}</a>
            <a href="#how">{dict.links.how}</a>
            <a href="#uses">{dict.links.uses}</a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>{dict.copyright}</span>
          <span className="mono">{dict.madeIn}</span>
        </div>
      </div>
    </footer>
  );
}
