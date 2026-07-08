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
import Link from "next/link";
import { Building2 } from "lucide-react"
import { getCanonicalUrl, getPublicBaseUrl } from "@/lib/seo";
import { SpeedInsights } from '@vercel/speed-insights/next';


export const metadata: Metadata = {
  metadataBase: getPublicBaseUrl(),
  applicationName: "Bazar Baz",
  manifest: "/manifest.webmanifest",
  title: {
    default: "بازارباز - پلتفرم مدیریت کسب‌وکار ایرانی",
    template: "%s | بازارباز"
  },
  description: "پلتفرم مدیریت کسب‌وکار ایرانی: فروشگاه، نوبت‌دهی، مشتریان، باشگاه مشتریان، پیامک، اعلان و داشبورد مدیریتی فارسی.",
  keywords: ["Bazar Baz", "پلتفرم کسب‌وکار", "مدیریت کسب‌وکار", "فروشگاه آنلاین", "نوبت‌دهی آنلاین", "باشگاه مشتریان", "پیامک-marketing", "داشبورد مدیریتی", "بازارباز"],
  openGraph: {
    title: "بازارباز - پلتفرم مدیریت کسب‌وکار ایرانی",
    description: "پلتفرم مدیریت کسب‌وکار ایرانی: فروشگاه، نوبت‌دهی، مشتریان، باشگاه مشتریان، پیامک، اعلان و داشبورد مدیریتی فارسی.",
    url: "https://bazar-baz.ir",
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
    icon: [{ url: "/pwa-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/pwa-icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "Bazar Baz",
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
        <SessionProvider>
          <LocaleProvider defaultLocale={locale}>
            <AuthProvider>
              <ErrorBoundary>
                <ThemeProvider defaultTheme="dark" storageKey="shadcn-rtl-theme">
                  {children}
                  <PwaInstallManager enabled={process.env.PWA_ENABLED !== "false"} locale={locale} />
                </ThemeProvider>
              </ErrorBoundary>
            </AuthProvider>
          </LocaleProvider>
        </SessionProvider>
        <SpeedInsights />
        {/* Footer */}
        <footer className="bg-muted/50 py-12 mt-12">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <Link
                  href={`/${locale}`}
                  className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                >
                  <Building2 className="h-6 w-6 text-primary" />
                  <span className="font-bold text-lg">{t("home.platformName") || "بازارباز"}</span>
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <Link href={`/${locale}/features`} className="hover:text-foreground transition-colors">امکانات</Link>
                <Link href={`/${locale}/dashboard-showcase`} className="hover:text-foreground transition-colors">داشبورد</Link>
                <Link href={`/${locale}/demo`} className="hover:text-foreground transition-colors">نمونه‌ها</Link>
                <Link href={`/${locale}/pricing`} className="hover:text-foreground transition-colors">تعرفه‌ها</Link>
                <Link href={`/${locale}/contact`} className="hover:text-foreground transition-colors">تماس</Link>
                <Link href={`/${locale}/request-demo`} className="hover:text-foreground transition-colors">درخواست دمو</Link>
                <Link href={`/${locale}/trust`} className="hover:text-foreground transition-colors">اعتماد</Link>
                <Link href={`/${locale}/privacy`} className="hover:text-foreground transition-colors">حریم خصوصی</Link>
                <Link href={`/${locale}/terms`} className="hover:text-foreground transition-colors">شرایط استفاده</Link>
              </div>
              <div className="flex items-center gap-4">
                <a referrerPolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'>
                  <img referrerPolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7' alt='' className='cursor:pointer' slot='PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'/>
                </a>
                <p className="text-sm text-muted-foreground">بازار باز</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
