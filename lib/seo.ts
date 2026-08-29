import type { Metadata } from "next";
import { localeConfig, supportedLocales, type SupportedLocale } from "@/lib/i18n";

const DEFAULT_BASE_URL = "https://bazarbaaz.ir";
const LEGACY_PRODUCTION_HOSTS = new Set([
  "shadcn-rtl.vercel.app",
  "bazar-baz.ir",
  "www.bazar-baz.ir",
]);
const DEFAULT_TITLE = "Bazarbaaz";
const DEFAULT_DESCRIPTION = "Multi-tenant commerce and appointment booking marketplace.";
const DEFAULT_IMAGE = "/og-image";

export type GeneratedOgImageKind = "organization" | "category" | "product" | "service";

export type GeneratedOgImageInput = {
  kind: GeneratedOgImageKind;
  locale: string;
  title: string;
  subtitle?: string | null;
  organizationName?: string | null;
};

export type PublicSeoInput = {
  locale: string;
  baseUrl?: string | URL;
  path: string;
  title: string;
  description?: string | null;
  image?: string | null;
  keywords?: string[];
  type?: "website" | "article";
  alternatePath?: (locale: SupportedLocale) => string;
  icons?: Metadata["icons"];
};

export type SeoOrganization = {
  name: string | null;
  slug: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export function getPublicBaseUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_DEPLOYED_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_BASE_URL;

  const normalizedUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : rawUrl.startsWith("localhost") || rawUrl.startsWith("127.0.0.1")
      ? `http://${rawUrl}`
      : `https://${rawUrl}`;

  const url = new URL(normalizedUrl);
  if (process.env.VERCEL_ENV === "production" && LEGACY_PRODUCTION_HOSTS.has(url.hostname)) {
    return new URL(DEFAULT_BASE_URL);
  }

  return url;
}

export function getSupportedLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

export function normalizePath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function getCanonicalUrl(path = "/", baseUrl?: string | URL) {
  return new URL(normalizePath(path), baseUrl || getPublicBaseUrl()).toString();
}

export function getSeoImageUrl(image?: string | null, baseUrl?: string | URL) {
  const value = image?.trim();
  if (!value) return getCanonicalUrl(DEFAULT_IMAGE, baseUrl);

  try {
    return new URL(value).toString();
  } catch {
    return getCanonicalUrl(value.startsWith("/") ? value : `/${value}`, baseUrl);
  }
}

function isDurableSeoImage(image?: string | null) {
  const value = image?.trim();
  if (!value) return false;

  // Legacy local uploads are not durable across Vercel deployments. Prefer generated
  // share cards over advertising stale /uploads URLs to social crawlers.
  return !value.startsWith("/uploads/");
}

function compactOgText(value: string | null | undefined, fallback: string, maxLength: number) {
  const normalized = (value || fallback).replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function buildGeneratedOgImagePath(input: GeneratedOgImageInput) {
  const locale = getSupportedLocale(input.locale);
  const params = new URLSearchParams({
    kind: input.kind,
    locale,
    title: compactOgText(input.title, DEFAULT_TITLE, 86),
  });

  const subtitle = compactOgText(input.subtitle, "", 96);
  if (subtitle) params.set("subtitle", subtitle);

  const organizationName = compactOgText(input.organizationName, "", 72);
  if (organizationName) params.set("organization", organizationName);

  return `${DEFAULT_IMAGE}?${params.toString()}`;
}

export function getUploadedOrGeneratedSeoImageUrl(
  uploadedImage: string | null | undefined,
  generatedImage: GeneratedOgImageInput,
  baseUrl?: string | URL,
) {
  return isDurableSeoImage(uploadedImage)
    ? getSeoImageUrl(uploadedImage, baseUrl)
    : getSeoImageUrl(buildGeneratedOgImagePath(generatedImage), baseUrl);
}

export function truncateSeoText(value: string | null | undefined, fallback = DEFAULT_DESCRIPTION, maxLength = 155) {
  const normalized = (value || fallback).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function buildLocaleAlternates(
  currentLocale: string,
  path: string,
  alternatePath?: (locale: SupportedLocale) => string,
  baseUrl?: string | URL,
) {
  const locale = getSupportedLocale(currentLocale);
  const resolvePath =
    alternatePath ||
    ((nextLocale: SupportedLocale) => {
      const normalizedPath = normalizePath(path);
      if (normalizedPath === `/${locale}`) return `/${nextLocale}`;
      if (normalizedPath.startsWith(`/${locale}/`)) {
        return `/${nextLocale}${normalizedPath.slice(locale.length + 1)}`;
      }
      return normalizedPath;
    });

  const languages = Object.fromEntries(
    supportedLocales.map((nextLocale) => [
      localeConfig[nextLocale].languageCode,
      getCanonicalUrl(resolvePath(nextLocale), baseUrl),
    ]),
  );

  return {
    canonical: getCanonicalUrl(resolvePath(locale), baseUrl),
    languages: {
      ...languages,
      "x-default": getCanonicalUrl(resolvePath("fa"), baseUrl),
    },
  };
}

export function buildPublicMetadata(input: PublicSeoInput): Metadata {
  const locale = getSupportedLocale(input.locale);
  const description = truncateSeoText(input.description);
  const image = getSeoImageUrl(input.image, input.baseUrl);
  const alternates = buildLocaleAlternates(locale, input.path, input.alternatePath, input.baseUrl);

  return {
    metadataBase: input.baseUrl ? new URL(input.baseUrl) : getPublicBaseUrl(),
    title: input.title || DEFAULT_TITLE,
    description,
    keywords: input.keywords,
    alternates,
    icons: input.icons,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: input.title || DEFAULT_TITLE,
      description,
      url: alternates.canonical,
      siteName: DEFAULT_TITLE,
      images: [{ url: image, width: 1200, height: 630, alt: input.title || DEFAULT_TITLE }],
      locale: localeConfig[locale].languageCode.replace("-", "_"),
      alternateLocale: supportedLocales
        .filter((nextLocale) => nextLocale !== locale)
        .map((nextLocale) => localeConfig[nextLocale].languageCode.replace("-", "_")),
      type: input.type || "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title || DEFAULT_TITLE,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: input.title || DEFAULT_TITLE }],
    },
  };
}

export function buildNoIndexMetadata(title: string, description = DEFAULT_DESCRIPTION): Metadata {
  return {
    metadataBase: getPublicBaseUrl(),
    title,
    description: truncateSeoText(description),
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
  };
}

export function buildOrganizationJsonLd(input: {
  organization: SeoOrganization;
  path: string;
  kind: "Store" | "LocalBusiness";
  baseUrl?: string | URL;
}) {
  const { organization, path, kind } = input;
  const url = getCanonicalUrl(path, input.baseUrl);
  const image = getSeoImageUrl(organization.coverImage || organization.logo, input.baseUrl);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": kind,
    "@id": `${url}#organization`,
    name: organization.name || DEFAULT_TITLE,
    url,
    description: truncateSeoText(organization.description),
    image,
    logo: getSeoImageUrl(organization.logo, input.baseUrl),
  };

  if (organization.phone) data.telephone = organization.phone;
  if (organization.email) data.email = organization.email;
  if (organization.address) data.address = organization.address;
  if (organization.lat != null && organization.lng != null) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: organization.lat,
      longitude: organization.lng,
    };
  }

  return data;
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>, baseUrl?: string | URL) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path, baseUrl),
    })),
  };
}
