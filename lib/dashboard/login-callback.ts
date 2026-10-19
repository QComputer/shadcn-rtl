import { appPath } from "@/lib/app-base-path"
import type { SupportedLocale } from "@/lib/i18n"

const CALLBACK_ORIGIN = "https://bazarbaaz.invalid"

/** Preserve a dashboard deep link through sign-in without allowing an external redirect. */
export function dashboardLoginCallbackUrl(requestedPath: string | null, locale: SupportedLocale): string {
  const fallbackPath = `/${locale}/dashboard`
  if (!requestedPath || !requestedPath.startsWith("/") || requestedPath.startsWith("//") || requestedPath.includes("\\")) {
    return appPath(fallbackPath)
  }

  try {
    const requestedUrl = new URL(requestedPath, CALLBACK_ORIGIN)
    if (requestedUrl.origin !== CALLBACK_ORIGIN) return appPath(fallbackPath)
    const dashboardRoot = `/${locale}/dashboard`
    if (requestedUrl.pathname !== dashboardRoot && !requestedUrl.pathname.startsWith(`${dashboardRoot}/`)) {
      return appPath(fallbackPath)
    }
    return appPath(`${requestedUrl.pathname}${requestedUrl.search}`)
  } catch {
    return appPath(fallbackPath)
  }
}
