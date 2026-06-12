"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { BrandMark } from "./landing-glyphs";
import { LocaleSwitcher } from "./locale-switcher";

interface LandingNavProps {
  dict: Dictionary["nav"];
  locale: Locale;
}

// Sticky nav. Client only because the border appears once the page scrolls past
// a small threshold — there's no server equivalent for a scroll position.
export function LandingNav({ dict, locale }: LandingNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={cn("nav", isScrolled && "scrolled")}>
      <div className="nav-inner">
        <Link className="brand" href="#top">
          <span className="brand-mark">
            <BrandMark />
          </span>
          Varde
        </Link>
        <nav className="nav-links">
          <a href="#features">{dict.features}</a>
          <a href="#how">{dict.how}</a>
          <a href="#uses">{dict.uses}</a>
        </nav>
        <div className="nav-right">
          <LocaleSwitcher active={locale} />
          <Link className="btn primary sm" href="/app">
            {dict.launch}
          </Link>
        </div>
      </div>
    </header>
  );
}
