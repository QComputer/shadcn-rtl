export type OrganizationBrandingSource = "BAZARBAAZ_MANAGED" | "EXTERNAL_SYNC" | "PLATFORM_FALLBACK";

export type ResolvedOrganizationBranding = {
  organizationId: string;
  displayName: string;
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
  logoInverse: string;
  mark: string;
  monochromeIcon: string;
  themeColor: string;
  backgroundColor: string;
  ogImage: string;
  source: OrganizationBrandingSource;
};

const BAZARBAAZ_LOGO = "/brand/marks/bazarbaaz-mark.svg";
const BAZARBAAZ_LOGO_INVERSE = "/brand/marks/bazarbaaz-mark-mono-white.svg";
const BAZARBAAZ_MARK = "/brand/marks/bazarbaaz-mark.svg";
const BAZARBAAZ_MARK_MONOCHROME = "/brand/marks/bazarbaaz-mark-mono-ink.svg";
const BAZARBAAZ_FAVICON = "/icons/favicon.svg";
const BAZARBAAZ_APPLE_TOUCH_ICON = "/icons/apple-touch-icon.png";
const BAZARBAAZ_PWA_192 = "/icons/icon-192x192.png";
const BAZARBAAZ_PWA_512 = "/icons/icon-512x512.png";
const BAZARBAAZ_PWA_MASKABLE_192 = "/icons/icon-maskable-192x192.png";
const BAZARBAAZ_PWA_MASKABLE_512 = "/icons/icon-maskable-512x512.png";
const BAZARBAAZ_THEME_COLOR = "#2F5BFF";
const BAZARBAAZ_BACKGROUND_COLOR = "#0f172a";
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
    shortName?: string | null;
    logoUrl?: string | null;
    logoInverseUrl?: string | null;
    markUrl?: string | null;
    faviconUrl?: string | null;
    appleTouchIconUrl?: string | null;
    pwaIcon192Url?: string | null;
    pwaMaskable192Url?: string | null;
    pwaMaskable512Url?: string | null;
    pwaIcon512Url?: string | null;
    monochromeIconUrl?: string | null;
    themeColor?: string | null;
    backgroundColor?: string | null;
    ogImageUrl?: string | null;
    source?: OrganizationBrandingSource | null;
  } | null;
}): ResolvedOrganizationBranding {
  const branding = input.branding?.organizationId === input.organizationId
    ? input.branding
    : null;

  return {
    organizationId: input.organizationId,
    displayName: firstDefined(branding?.displayName, input.name) || "Bazarbaaz",
    shortName: firstDefined(branding?.shortName, input.name) || "Bazarbaaz",
    logo: firstDefined(branding?.logoUrl, input.logo, BAZARBAAZ_LOGO),
    favicon: firstDefined(branding?.faviconUrl, BAZARBAAZ_FAVICON),
    appleTouchIcon: firstDefined(branding?.appleTouchIconUrl, branding?.faviconUrl, BAZARBAAZ_APPLE_TOUCH_ICON),
    pwaIcons: {
      icon192: firstDefined(branding?.pwaIcon192Url, BAZARBAAZ_PWA_192),
      icon512: firstDefined(branding?.pwaIcon512Url, BAZARBAAZ_PWA_512),
      maskable192: firstDefined(branding?.pwaMaskable192Url, BAZARBAAZ_PWA_MASKABLE_192),
      maskable512: firstDefined(branding?.pwaMaskable512Url, BAZARBAAZ_PWA_MASKABLE_512),
    },
    logoInverse: firstDefined(branding?.logoInverseUrl, input.logo, BAZARBAAZ_LOGO_INVERSE),
    mark: firstDefined(branding?.markUrl, input.logo, BAZARBAAZ_MARK),
    monochromeIcon: firstDefined(branding?.monochromeIconUrl, BAZARBAAZ_MARK_MONOCHROME),
    themeColor: branding?.themeColor || BAZARBAAZ_THEME_COLOR,
    backgroundColor: branding?.backgroundColor || BAZARBAAZ_BACKGROUND_COLOR,
    ogImage: firstDefined(
      branding?.ogImageUrl,
      input.coverImage || input.logo,
      BAZARBAAZ_OG_IMAGE,
    ),
    source: branding?.source ?? "PLATFORM_FALLBACK",
  };
}

export function resolvePlatformFallbackBranding(): ResolvedOrganizationBranding {
  return {
    organizationId: "platform",
    displayName: "Bazarbaaz",
    shortName: "بازارباز",
    logo: BAZARBAAZ_LOGO,
    favicon: BAZARBAAZ_FAVICON,
    appleTouchIcon: BAZARBAAZ_APPLE_TOUCH_ICON,
    pwaIcons: {
      icon192: BAZARBAAZ_PWA_192,
      icon512: BAZARBAAZ_PWA_512,
      maskable192: BAZARBAAZ_PWA_MASKABLE_192,
      maskable512: BAZARBAAZ_PWA_MASKABLE_512,
    },
    logoInverse: BAZARBAAZ_LOGO_INVERSE,
    mark: BAZARBAAZ_MARK,
    monochromeIcon: BAZARBAAZ_MARK_MONOCHROME,
    themeColor: BAZARBAAZ_THEME_COLOR,
    backgroundColor: BAZARBAAZ_BACKGROUND_COLOR,
    ogImage: BAZARBAAZ_OG_IMAGE,
    source: "PLATFORM_FALLBACK",
  };
}
