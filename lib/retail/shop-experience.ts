type RetailShopBranding = {
  retailPresentationTheme?: string | null;
  retailPreviewOnly?: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether the tenant's product, cart, and checkout routes use the modern
 * retail experience. This setting is independent of the storefront homepage.
 */
export function hasModernRetailProductExperience(
  settings: unknown,
  branding: RetailShopBranding,
): boolean {
  if (branding.retailPreviewOnly === true) return false;
  if (branding.retailPresentationTheme) return true;

  if (!isRecord(settings)) return false;
  const retailCatalog = settings.retailCatalog;
  if (!isRecord(retailCatalog)) return false;

  return retailCatalog.productExperience === "VARIANTS_V1";
}

export function shouldLoadPublishedRetailCatalog(input: {
  locale: string;
  forcePublishedCatalog?: boolean;
  hasPresentationTheme: boolean;
  previewOnly: boolean;
}) {
  return input.locale === "fa"
    && !input.previewOnly
    && (input.forcePublishedCatalog === true || input.hasPresentationTheme);
}
