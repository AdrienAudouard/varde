// Locale config shared by server (layout, page, get-locale) and client
// (locale-switcher). No `server-only` here — the cookie name and the locale
// list are needed on both sides.

export const locales = ["fr", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

// Non-sensitive UI preference. Read on the server to pick the dictionary and
// `<html lang>`; written by the client switcher.
export const LOCALE_COOKIE = "varde-locale";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
