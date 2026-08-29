import type { Metadata } from "next";
import "@/app/globals.css"
import { localeConfig, supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { ThemeProvider } from "@/hooks/use-theme";
import { SessionProvider } from "next-auth/react";
import { getDictionary } from "@/lib/dictionary"
import { AuthProvider } from "@/hooks/use-auth";
import { LocaleProvider } from "@/components/locale-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaInstallManager } from "@/components/pwa-install-manager";
import { getCanonicalUrl, getPublicBaseUrl } from "@/lib/seo";
import { PlatformFooter } from "@/components/public/platform-footer";
import { headers } from "next/headers";
import { appPath, resolveAppBasePath } from "@/lib/app-base-path";


export const metadata: Metadata = {
  metadataBase: getPublicBaseUrl(),
  applicationName: "Bazarbaaz",
  manifest: appPath("/manifest.webmanifest"),
  title: {
    default: "بازارباز - پلتفرم مدیریت کسب‌وکار ایرانی",
    template: "%s | بازارباز"
  },
  description: "پلتفرم مدیریت کسب‌وکار ایرانی: فروشگاه، نوبت‌دهی، مشتریان، باشگاه مشتریان، پیامک، اعلان و داشبورد مدیریتی فارسی.",
  keywords: ["Bazarbaaz", "پلتفرم کسب‌وکار", "مدیریت کسب‌وکار", "فروشگاه آنلاین", "نوبت‌دهی آنلاین", "باشگاه مشتریان", "پیامک-marketing", "داشبورد مدیریتی", "بازارباز"],
  openGraph: {
    title: "بازارباز - پلتفرم مدیریت کسب‌وکار ایرانی",
    description: "پلتفرم مدیریت کسب‌وکار ایرانی: فروشگاه، نوبت‌دهی، مشتریان، باشگاه مشتریان، پیامک، اعلان و داشبورد مدیریتی فارسی.",
    url: "https://bazarbaaz.ir",
    siteName: "بازارباز",
    images: [
      {
        url: getCanonicalUrl("/og-image"),
        width: 1200,
        height: 630,
      },
    ],
    locale: "fa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: [getCanonicalUrl("/og-image")],
  },
  icons: {
    icon: [
      { url: appPath("/icons/favicon.svg"), type: "image/svg+xml" },
      { url: appPath("/icons/favicon-32x32.png"), sizes: "32x32", type: "image/png" },
      { url: appPath("/icons/favicon-16x16.png"), sizes: "16x16", type: "image/png" },
    ],
    shortcut: [{ url: appPath("/icons/favicon.ico") }],
    apple: [{ url: appPath("/icons/apple-touch-icon.png"), sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Bazarbaaz",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

// Generate static params for all supported locales - required for static export
export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

// Validate that the locale is supported
function validateLocale(locale: string): SupportedLocale {
  if (supportedLocales.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }
  return "fa" as SupportedLocale; // Default to Persian
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Next.js 16 - params is a Promise
  const resolvedParams = await params;
  const locale = validateLocale(resolvedParams.locale);
  const config = localeConfig[locale];
  const dict = getDictionary(locale)
  const headerList = await headers();
  const footerContext = headerList.get("x-bazar-public-footer-context") || "platform";
  const showPlatformFooter = footerContext === "platform";
  // Helper to get translations based on locale
  const t = (key: string): string => {
    const keys = key.split(".")
    let value: any = dict
    for (const k of keys) {
      value = value?.[k]
    }
    return value || key
  }


  return (
    <html lang={locale} dir={config.dir}>
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
