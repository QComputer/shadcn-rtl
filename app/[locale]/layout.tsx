import type { Metadata } from "next";
import "@/app/globals.css"
import { localeConfig, supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { ThemeProvider } from "@/hooks/use-theme";
import { SessionProvider } from "next-auth/react";
import { getDictionary } from "@/lib/dictionary"
import { AuthProvider } from "@/hooks/use-auth";
import { LocaleProvider } from "@/components/locale-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { PwaInstallManager } from "@/components/pwa-install-manager"
import { getPublicBaseUrl, buildPublicMetadata } from "@/lib/seo"
import { headers } from "next/headers"
import { appPath, appResourceUrl, resolveAppBasePath } from "@/lib/app-base-path"
import { PlatformFooter } from "@/components/public/platform-footer"
import { resolveTenantPwaRequestContext } from "@/lib/tenant-pwa-context.server"
import { resolvePlatformFallbackBranding } from "@/lib/organization-branding"
import { isTenantPwaInstallable, safeTenantAssetUrl } from "@/lib/operational-app-manifest"

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const basePath = resolveAppBasePath();
  const context = await resolveTenantPwaRequestContext(requestHeaders).catch(() => ({ kind: "unknown" as const }));
  if (context.kind === "platform") {
    const branding = resolvePlatformFallbackBranding();
    return {
      icons: {
        icon: appResourceUrl(branding.favicon, basePath),
        apple: appResourceUrl(branding.appleTouchIcon, basePath),
      },
      manifest: appResourceUrl("/manifest.webmanifest", basePath),
      themeColor: "#2F5BFF",
    };
  }
  if (context.kind === "tenant") {
    const branding = context.branding;
    const favicon = safeTenantAssetUrl(branding.favicon || branding.pwaIcons.icon192 || branding.logo, basePath);
    const appleTouchIcon = safeTenantAssetUrl(branding.appleTouchIcon || branding.pwaIcons.icon512 || branding.logo, basePath);
    return {
      icons: {
        ...(favicon ? { icon: favicon } : {}),
        ...(appleTouchIcon ? { apple: appleTouchIcon } : {}),
      },
      manifest: appResourceUrl("/manifest.webmanifest", basePath),
    };
  }
  return {
    icons: { icon: [], apple: [] },
    manifest: appResourceUrl("/manifest.webmanifest", basePath),
  };
}

function normalizeLocale(locale: string | undefined): SupportedLocale {
  if (supportedLocales.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  return "fa" as SupportedLocale;
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [headersList, { locale: routeLocale }] = await Promise.all([headers(), params]);
  const pwaContext = await resolveTenantPwaRequestContext(headersList).catch(() => ({ kind: "unknown" as const }));
  const appBasePath = resolveAppBasePath();
  const pwaAppName = pwaContext.kind === "tenant"
    ? pwaContext.branding.displayName
    : pwaContext.kind === "platform"
      ? "بازارباز"
      : "";
  const pwaAppIcon = pwaContext.kind === "tenant"
    ? safeTenantAssetUrl(pwaContext.branding.pwaIcons.icon192, appBasePath)
    : pwaContext.kind === "platform"
      ? appResourceUrl(resolvePlatformFallbackBranding().pwaIcons.icon192, appBasePath)
      : null;
  const pwaInstallReady = pwaContext.kind === "platform"
    || (pwaContext.kind === "tenant" && isTenantPwaInstallable(pwaContext.branding));
  const tenantPublicBaseUrlHeader = headersList.get('x-bazar-tenant-public-base-url');
  const isTenantContext = !!tenantPublicBaseUrlHeader;
  let baseUrl: string | URL | undefined;
  if (isTenantContext && tenantPublicBaseUrlHeader) {
    try {
      baseUrl = new URL(tenantPublicBaseUrlHeader);
    } catch (error) {
      console.error("Invalid tenant public base URL header:", tenantPublicBaseUrlHeader, error);
      baseUrl = getPublicBaseUrl();
    }
  } else {
    baseUrl = getPublicBaseUrl();
  }
  const pathname = headersList.get("x-url-pathname") || "/";
  const locale = normalizeLocale(routeLocale);
  const dict = getDictionary(locale)
  const footerContext = headersList.get("x-bazar-public-footer-context") || "platform";
  const showPlatformFooter = footerContext === "platform";
  const t = (key: string): string => {
    const keys = key.split(".")
    let value: any = dict
    for (const k of keys) {
      value = value?.[k]
    }
    return value || key
  }
  const metadata: Metadata = buildPublicMetadata({
    locale: locale,
    baseUrl: baseUrl,
    path: pathname,
    title: `${t("home.platformName") || "Bazarbaaz"} | بازارباز`,
    description: t("home.description") || "پلتفرم مدیریت کسب‌وکار ایرانی: فروشگاه، نوبت‌دهی، مشتریان، باشگاه مشتریان، پیامک، اعلان و داشبورد مدیریتی فارسی.",
    keywords: ["Bazarbaaz", "پلتفرم کسب‌وکار", "مدیریت کسب‌وکار", "فروشگاه آنلاین", "نوبت‌دهی آنلاین", "باشگاه مشتریان", "پیامک-marketing", "داشبورد مدیریتی", "بازارباز"],
  });

  (metadata as any).title = {
    template: "%s | بازارباز",
    default: "بازارباز | از کسب‌وکار سنتی تا حضور دیجیتال هوشمند",
  };
  return (
    <html lang={locale} dir={localeConfig[locale].dir}>
      <head key={locale}>
      </head>
      <body className="antialiased">
        <SessionProvider basePath={appPath("/api/auth")}>
          <LocaleProvider defaultLocale={locale}>
            <AuthProvider>
              <ErrorBoundary>
                <ThemeProvider defaultTheme="dark" storageKey="shadcn-rtl-theme">
                  {children}
                  <PwaInstallManager enabled={process.env.PWA_ENABLED !== "false" && pwaInstallReady} locale={locale} basePath={appBasePath} appName={pwaAppName} appIcon={pwaAppIcon} />
                </ThemeProvider>
              </ErrorBoundary>
            </AuthProvider>
          </LocaleProvider>
        </SessionProvider>
        {showPlatformFooter ? (
          <PlatformFooter locale={locale} platformName={t("home.platformName") || "Bazarbaaz"} />
        ) : null}
      </body>
    </html>
  );
}
