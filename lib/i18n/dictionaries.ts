import "server-only";

import type { Locale } from "./config";

// The English dictionary is the source of truth for the shape; FR must match it
// key-for-key. Section components are typed against `Dictionary` (and its
// slices) so a missing/renamed key is a compile error, not a runtime blank.
export type Dictionary = typeof import("./dictionaries/en.json");

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  fr: () => import("./dictionaries/fr.json").then((m) => m.default),
  en: () => import("./dictionaries/en.json").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
