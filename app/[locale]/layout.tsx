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
import { appPath, resolveAppBasePath } from "@/lib/app-base-path"
import { PlatformFooter } from "@/components/public/platform-footer"

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

function normalizeLocale(locale: string | undefined): SupportedLocale {
  if (supportedLocales.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  return "fa" as SupportedLocale;
}

export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
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
  const pathParts = pathname.split("/").filter(Boolean);
  const localeFromPath = pathParts[0];
  const locale = normalizeLocale(localeFromPath);
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
                  <PwaInstallManager enabled={process.env.PWA_ENABLED !== "false"} locale={locale} basePath={resolveAppBasePath()} />
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
