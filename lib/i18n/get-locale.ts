import "server-only";

import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

// Reads the locale preference cookie on the server. Used by the root layout
// (for `<html lang>`) and the landing page (to pick the dictionary). Defensive:
// any failure reading cookies falls back to the default locale rather than
// throwing during render.
export async function getLocale(): Promise<Locale> {
  try {
    const value = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (value && isLocale(value)) return value;
  } catch {
    // `cookies()` can throw in contexts without a request store — fall through.
  }
  return defaultLocale;
}
