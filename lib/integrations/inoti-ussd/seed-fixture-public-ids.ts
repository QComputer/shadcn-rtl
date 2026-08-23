export const SEEDED_INOTI_USSD_PUBLIC_IDS = {
  platform: "1b6e8958-6e2a-4d4d-8d62-6d36be2284de",
  akaShoes: "b4aa4d7a-2f63-47f2-8f58-32d22bd61766",
  cafeLeo: "e8c71496-34ec-4e7d-bbd3-7fcfa3a9eab1",
  italiano13: "f2a05d81-bf39-4bb4-a3a6-7a1d3dd3f975",
} as const;

export const SEEDED_INOTI_USSD_PUBLIC_ID_BY_SLUG = {
  "bazarbaaz-platform": SEEDED_INOTI_USSD_PUBLIC_IDS.platform,
  "aka-shoes": SEEDED_INOTI_USSD_PUBLIC_IDS.akaShoes,
  "cafe-leo": SEEDED_INOTI_USSD_PUBLIC_IDS.cafeLeo,
  "italiano-13": SEEDED_INOTI_USSD_PUBLIC_IDS.italiano13,
} as const;
