// Internationalization utilities
// Note: This module is used by both Server and Client components

// Import dictionaries
import en from "@/dictionaries/en.json";
import fa from "@/dictionaries/fa.json";
import ar from "@/dictionaries/ar.json";

// Dictionary type - use a flexible Record type to avoid strict type mismatches between locale dictionaries
export type Dictionary = Record<string, Record<string, unknown>>;

// Supported locales - Persian is primary native language
export const supportedLocales = ["fa", "en", "ar"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

// Locale configurations
export const localeConfig: Record<SupportedLocale, {
  dir: "rtl" | "ltr";
  name: string;
  nativeName: string;
  languageCode: string;
}> = {
  fa: {
    dir: "rtl",
    name: "Persian",
    nativeName: "فارسی",
    languageCode: "fa-IR"
  },
  en: {
    dir: "ltr",
    name: "English",
    nativeName: "English",
    languageCode: "en-US"
  },
  ar: {
    dir: "rtl",
    name: "Arabic",
    nativeName: "العربية",
    languageCode: "ar-SA"
  }
};

// Dictionary loader - uses dynamic import for server-only content
let dictionaries: Record<SupportedLocale, () => Promise<Dictionary>> | null = null;

function getDictionaryLoaders() {
  if (!dictionaries) {
    // Lazy load dictionaries to avoid server-only issues
    dictionaries = {
      en: () => import("@/dictionaries/en.json").then((m) => m.default as Dictionary),
      fa: () => import("@/dictionaries/fa.json").then((m) => m.default as Dictionary),
      ar: () => import("@/dictionaries/ar.json").then((m) => m.default as Dictionary),
    };
  }
  return dictionaries;
}

/**
 * Get dictionary for a given locale
 */
export async function getDictionary(locale: string): Promise<Dictionary> {
  const localeKey = locale as SupportedLocale;
  const loaders = getDictionaryLoaders();
  
  if (supportedLocales.includes(localeKey)) {
    return loaders[localeKey]();
  }
  
  // Fallback to English
  return loaders.en();
}

/**
 * Get direction (RTL/LTR) for a locale
 */
export function getDirection(locale: string): "rtl" | "ltr" {
  const localeKey = locale as SupportedLocale;
  return localeConfig[localeKey]?.dir ?? "rtl";
}

/**
 * Check if a locale is RTL
 */
export function isRTL(locale: string): boolean {
  return getDirection(locale) === "rtl";
}

/**
 * Get native name of a locale
 */
export function getLocaleNativeName(locale: string): string {
  const localeKey = locale as SupportedLocale;
  return localeConfig[localeKey]?.nativeName ?? locale;
}

/**
 * Get default locale (Persian)
 */
export function getDefaultLocale(): SupportedLocale {
  return "fa";
}

/**
 * Check if locale is supported
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale);
}
