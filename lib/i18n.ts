import "server-only";

const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  fa: () => import("@/dictionaries/fa.json").then((module) => module.default),
  ar: () => import("@/dictionaries/ar.json").then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  return dictionaries[locale as keyof typeof dictionaries]?.() ?? dictionaries.en();
};

export const supportedLocales = ["en", "fa", "ar"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
