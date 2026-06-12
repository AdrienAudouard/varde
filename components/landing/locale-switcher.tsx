"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { locales, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

interface LocaleSwitcherProps {
  active: Locale;
}

// FR/EN preference control. Writes a non-sensitive locale cookie then asks the
// server to re-render — the server owns `<html lang>` and the dictionary, so we
// never touch `document.documentElement.lang` ourselves.
export function LocaleSwitcher({ active }: LocaleSwitcherProps) {
  const router = useRouter();

  const select = (next: Locale) => {
    if (next === active) return;
    // `document.cookie` is a setter, not a reassignment of an outer binding —
    // writing a pref cookie in a click handler is correct. The immutability
    // rule misreads it; an effect (its suggested fix) would be the anti-pattern.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  };

  return (
    <div className="locale-switch" role="group" aria-label="Language">
      {locales.map((loc) => (
        <button
          key={loc}
          type="button"
          className={cn("ls-opt", loc === active && "on")}
          aria-pressed={loc === active}
          onClick={() => select(loc)}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
