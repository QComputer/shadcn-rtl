export type OrganizationBrandingSource = "BAZARBAAZ_MANAGED" | "EXTERNAL_SYNC" | "PLATFORM_FALLBACK";

export type ResolvedOrganizationBranding = {
  organizationId: string;
  displayName: string;
  applicationName: string;
  shortName: string;
  logo: string;
  favicon: string;
  appleTouchIcon: string;
  pwaIcons: {
    icon192: string;
    icon512: string;
    maskable192: string;
    maskable512: string;
  };
  ogImage: string;
  themeColor: string;
  backgroundColor: string;
  source: OrganizationBrandingSource;
};

const BAZARBAAZ_LOGO = "/brand/marks/bazarbaaz-mark.svg";
const BAZARBAAZ_FAVICON = "/icons/favicon.svg";
const BAZARBAAZ_APPLE_TOUCH_ICON = "/icons/apple-touch-icon.png";
const BAZARBAAZ_PWA_192 = "/icons/icon-192x192.png";
const BAZARBAAZ_PWA_512 = "/icons/icon-512x512.png";
const BAZARBAAZ_OG_IMAGE = "/og-image";

function firstDefined<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

export function resolveOrganizationBranding(input: {
  organizationId: string;
  name: string | null;
  logo: string | null;
  coverImage: string | null;
  branding?: {
    organizationId?: string | null;
    displayName?: string | null;
    applicationName?: string | null;
    shortName?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    appleTouchIconUrl?: string | null;
    pwaIcon192Url?: string | null;
    pwaIcon512Url?: string | null;
    pwaMaskable192Url?: string | null;
    pwaMaskable512Url?: string | null;
    ogImageUrl?: string | null;
    themeColor?: string | null;
    backgroundColor?: string | null;
    source?: OrganizationBrandingSource | null;
  } | null;
}): ResolvedOrganizationBranding {
  const branding = input.branding?.organizationId === input.organizationId
    ? input.branding
    : null;

  const icon192 = firstDefined(branding?.pwaIcon192Url, BAZARBAAZ_PWA_192) as string;
  const icon512 = firstDefined(branding?.pwaIcon512Url, BAZARBAAZ_PWA_512) as string;
  const derivedMaskable192 = icon192.includes("icon-192x192.png") ? icon192.replace("icon-192x192.png", "maskable-192x192.png") : null;
  const derivedMaskable512 = icon512.includes("icon-512x512.png") ? icon512.replace("icon-512x512.png", "maskable-512x512.png") : null;
  const maskable192 = firstDefined(branding?.pwaMaskable192Url, derivedMaskable192, "/icons/icon-maskable-192x192.png") as string;
  const maskable512 = firstDefined(branding?.pwaMaskable512Url, derivedMaskable512, "/icons/icon-maskable-512x512.png") as string;
  return {
    organizationId: input.organizationId,
    displayName: firstDefined(branding?.displayName, input.name) || "Bazarbaaz",
    applicationName: firstDefined(branding?.applicationName, branding?.displayName, input.name) || "Bazarbaaz",
    shortName: firstDefined(branding?.shortName, input.name) || "Bazarbaaz",
    logo: firstDefined(branding?.logoUrl, input.logo, BAZARBAAZ_LOGO),
    favicon: firstDefined(branding?.faviconUrl, BAZARBAAZ_FAVICON),
    appleTouchIcon: firstDefined(branding?.appleTouchIconUrl, branding?.faviconUrl, BAZARBAAZ_APPLE_TOUCH_ICON),
    pwaIcons: {
      icon192,
      icon512,
      maskable192,
      maskable512,
    },
    ogImage: firstDefined(
      branding?.ogImageUrl,
      input.coverImage || input.logo,
      BAZARBAAZ_OG_IMAGE,
    ),
    themeColor: branding?.themeColor || "#2F5BFF",
    backgroundColor: branding?.backgroundColor || "#ffffff",
    source: branding?.source ?? "PLATFORM_FALLBACK",
  };
}

export function resolvePlatformFallbackBranding(): ResolvedOrganizationBranding {
  return {
    organizationId: "platform",
    displayName: "Bazarbaaz",
    applicationName: "Bazarbaaz",
    shortName: "بازارباز",
    logo: BAZARBAAZ_LOGO,
    favicon: BAZARBAAZ_FAVICON,
    appleTouchIcon: BAZARBAAZ_APPLE_TOUCH_ICON,
    pwaIcons: {
      icon192: BAZARBAAZ_PWA_192,
      icon512: BAZARBAAZ_PWA_512,
      maskable192: "/icons/icon-maskable-192x192.png",
      maskable512: "/icons/icon-maskable-512x512.png",
    },
    ogImage: BAZARBAAZ_OG_IMAGE,
    themeColor: "#2F5BFF",
    backgroundColor: "#ffffff",
    source: "PLATFORM_FALLBACK",
  };
}
