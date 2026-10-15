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
  };
  ogImage: string;
  source: OrganizationBrandingSource;
};

export type TenantPwaBranding = {
  organizationId: string;
  displayName: string;
  shortName: string;
  logo: string | null;
  favicon: string | null;
  appleTouchIcon: string | null;
  themeColor: string | null;
  backgroundColor: string | null;
  pwaIcons: {
    icon192: string | null;
    icon512: string | null;
    maskable192: string | null;
    maskable512: string | null;
  };
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
    shortName?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    appleTouchIconUrl?: string | null;
    pwaIcon192Url?: string | null;
    pwaIcon512Url?: string | null;
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
    },
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
    displayName: "بازارباز",
    shortName: "بازارباز",
    logo: BAZARBAAZ_LOGO,
    favicon: BAZARBAAZ_FAVICON,
    appleTouchIcon: BAZARBAAZ_APPLE_TOUCH_ICON,
    pwaIcons: {
      icon192: BAZARBAAZ_PWA_192,
      icon512: BAZARBAAZ_PWA_512,
    },
    ogImage: BAZARBAAZ_OG_IMAGE,
    source: "PLATFORM_FALLBACK",
  };
}

/**
 * Resolve only assets explicitly owned by this organization's branding row.
 * Missing tenant icons stay missing; callers must never substitute platform
 * artwork for an organization.
 */
export function resolveTenantPwaBranding(input: {
  organizationId: string;
  name: string | null;
  logo: string | null;
  branding?: {
    organizationId?: string | null;
    displayName?: string | null;
    shortName?: string | null;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    appleTouchIconUrl?: string | null;
    pwaIcon192Url?: string | null;
    pwaIcon512Url?: string | null;
    pwaMaskable192Url?: string | null;
    pwaMaskable512Url?: string | null;
    themeColor?: string | null;
    backgroundColor?: string | null;
  } | null;
}): TenantPwaBranding {
  const branding = input.branding?.organizationId === input.organizationId
    ? input.branding
    : null;
  return {
    organizationId: input.organizationId,
    displayName: firstDefined(branding?.displayName, input.name) || "",
    shortName: firstDefined(branding?.shortName, input.name) || "",
    logo: firstDefined(branding?.logoUrl, input.logo),
    favicon: branding?.faviconUrl ?? null,
    appleTouchIcon: branding?.appleTouchIconUrl ?? null,
    themeColor: branding?.themeColor ?? null,
    backgroundColor: branding?.backgroundColor ?? null,
    pwaIcons: {
      icon192: branding?.pwaIcon192Url ?? null,
      icon512: branding?.pwaIcon512Url ?? null,
      maskable192: branding?.pwaMaskable192Url ?? null,
      maskable512: branding?.pwaMaskable512Url ?? null,
    },
  };
}

/** Metadata-safe tenant icon links, with tenant-only fallbacks. */
export function resolveTenantPageIcons(input: Parameters<typeof resolveTenantPwaBranding>[0]) {
  const branding = resolveTenantPwaBranding(input);
  const favicon = branding.favicon || branding.pwaIcons.icon192 || branding.logo;
  const apple = branding.appleTouchIcon || branding.pwaIcons.icon512 || branding.logo;
  const safe = (value: string | null) => {
    if (!value) return null;
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? value : null;
    } catch {
      return null;
    }
  };
  const safeFavicon = safe(favicon);
  const safeApple = safe(apple);
  return {
    icon: safeFavicon ? [{ url: safeFavicon }] : [],
    apple: safeApple ? [{ url: safeApple }] : [],
  };
}
