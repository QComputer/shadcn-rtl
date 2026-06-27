import type { Metadata } from "next";
import { localeConfig, supportedLocales, type SupportedLocale } from "@/lib/i18n";

const DEFAULT_BASE_URL = "https://bazar-baz.ir";
const LEGACY_PRODUCTION_HOSTS = new Set(["shadcn-rtl.vercel.app"]);
const DEFAULT_TITLE = "Bazar Baz";
const DEFAULT_DESCRIPTION = "Multi-tenant commerce and appointment booking marketplace.";
const DEFAULT_IMAGE = "/og-image";

export type PublicSeoInput = {
  locale: string;
  path: string;
  title: string;
  description?: string | null;
  image?: string | null;
  keywords?: string[];
  type?: "website" | "article";
  alternatePath?: (locale: SupportedLocale) => string;
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

export function getCanonicalUrl(path = "/") {
  return new URL(normalizePath(path), getPublicBaseUrl()).toString();
}

export function getSeoImageUrl(image?: string | null) {
  const value = image?.trim();
  if (!value) return getCanonicalUrl(DEFAULT_IMAGE);

  try {
    return new URL(value).toString();
  } catch {
    return getCanonicalUrl(value.startsWith("/") ? value : `/${value}`);
  }
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
      getCanonicalUrl(resolvePath(nextLocale)),
    ]),
  );

  return {
    canonical: getCanonicalUrl(resolvePath(locale)),
    languages: {
      ...languages,
      "x-default": getCanonicalUrl(resolvePath("fa")),
    },
  };
}

export function buildPublicMetadata(input: PublicSeoInput): Metadata {
  const locale = getSupportedLocale(input.locale);
  const description = truncateSeoText(input.description);
  const image = getSeoImageUrl(input.image);
  const alternates = buildLocaleAlternates(locale, input.path, input.alternatePath);

  return {
    metadataBase: getPublicBaseUrl(),
    title: input.title || DEFAULT_TITLE,
    description,
    keywords: input.keywords,
    alternates,
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
      images: [{ url: image }],
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
      images: [image],
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
}) {
  const { organization, path, kind } = input;
  const url = getCanonicalUrl(path);
  const image = getSeoImageUrl(organization.coverImage || organization.logo);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": kind,
    "@id": `${url}#organization`,
    name: organization.name || DEFAULT_TITLE,
    url,
    description: truncateSeoText(organization.description),
    image,
    logo: getSeoImageUrl(organization.logo),
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

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path),
    })),
  };
}
