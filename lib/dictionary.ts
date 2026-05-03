// Dictionary imports for client-side use
// This file provides direct imports to the JSON dictionary files

import faDictionary from "@/dictionaries/fa.json";
import enDictionary from "@/dictionaries/en.json";
import arDictionary from "@/dictionaries/ar.json";

// Re-export Dictionary type from i18n for consistency
export type { Dictionary } from "./i18n";

// Use a more flexible type that accommodates all dictionaries
export type DictionaryType = Record<string, Record<string, unknown>>;

// Map locale codes to dictionary objects
export const dictionaries: Record<string, DictionaryType> = {
  fa: faDictionary as DictionaryType,
  en: enDictionary as DictionaryType,
  ar: arDictionary as DictionaryType,
};

// Get a nested value from a dictionary using dot notation
export function getDictValue(dict: DictionaryType, path: string): string {
  const keys = path.split(".");
  let value: unknown = dict;
  
  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return path; // Return the path if not found
    }
  }
  
  return typeof value === "string" ? value : path;
}

// Create a dictionary getter function for a specific locale
export function getDictionary(locale: string): DictionaryType {
  return dictionaries[locale] || dictionaries.fa;
}
