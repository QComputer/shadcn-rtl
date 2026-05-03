/**
 * i18n Routing Configuration
 * Custom routing utilities for multi-locale support
 */

import { supportedLocales, localeConfig, type SupportedLocale } from "./i18n";

/**
 * Routing configuration
 */
export const routing = {
  // A list of all locales that are supported
  locales: [...supportedLocales] as const,
  
  // Used when no locale matches
  defaultLocale: "fa" as SupportedLocale,
  
  // Path prefix strategy: always include locale prefix
  localePrefix: "always" as const
};

/**
 * Get locale configuration for a specific locale
 */
export function getLocaleConfig(locale: SupportedLocale) {
  return localeConfig[locale];
}

/**
 * Get all available locales with their configurations
 */
export function getAvailableLocales() {
  return supportedLocales.map((locale) => ({
    locale,
    ...localeConfig[locale]
  }));
}

/**
 * Check if a path has a locale prefix
 */
export function hasLocalePrefix(path: string): boolean {
  const pathParts = path.split("/").filter(Boolean);
  if (pathParts.length === 0) return false;
  
  const firstPart = pathParts[0];
  return supportedLocales.includes(firstPart as SupportedLocale);
}

/**
 * Extract locale from path
 */
export function getLocaleFromPath(path: string): SupportedLocale | null {
  const pathParts = path.split("/").filter(Boolean);
  if (pathParts.length === 0) return null;
  
  const firstPart = pathParts[0];
  if (supportedLocales.includes(firstPart as SupportedLocale)) {
    return firstPart as SupportedLocale;
  }
  
  return null;
}

/**
 * Add locale prefix to path if not present
 */
export function addLocalePrefix(path: string, locale: SupportedLocale = "fa"): string {
  if (hasLocalePrefix(path)) {
    return path;
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  
  return `/${locale}/${cleanPath}`;
}

/**
 * Remove locale prefix from path
 */
export function removeLocalePrefix(path: string): string {
  const pathParts = path.split("/").filter(Boolean);
  if (pathParts.length === 0) return "/";
  
  const firstPart = pathParts[0];
  if (supportedLocales.includes(firstPart as SupportedLocale)) {
    return "/" + pathParts.slice(1).join("/");
  }
  
  return path;
}

/**
 * Navigation utilities using Next.js App Router
 */
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

/**
 * Locale-aware Link component
 */
export { Link };

/**
 * Get current pathname without locale prefix
 */
export function useLocalePathname() {
  const pathname = usePathname();
  return removeLocalePrefix(pathname);
}

/**
 * Push to a new route with locale
 */
export function useLocaleRouter() {
  const router = useRouter();
  const pathname = usePathname();
  
  const push = (href: string, locale?: SupportedLocale) => {
    const targetLocale = locale || getLocaleFromPath(pathname) || "fa";
    const newPath = hasLocalePrefix(href) ? href : addLocalePrefix(href, targetLocale);
    router.push(newPath);
  };
  
  const replace = (href: string, locale?: SupportedLocale) => {
    const targetLocale = locale || getLocaleFromPath(pathname) || "fa";
    const newPath = hasLocalePrefix(href) ? href : addLocalePrefix(href, targetLocale);
    router.replace(newPath);
  };
  
  return { push, replace, router };
}

/**
 * Redirect to a new route with locale
 */
export function localeRedirect(path: string, locale: SupportedLocale = "fa") {
  const newPath = hasLocalePrefix(path) ? path : addLocalePrefix(path, locale);
  return Response.redirect(new URL(newPath, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
