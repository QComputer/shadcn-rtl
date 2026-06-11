import type { Metadata } from "next";
import "@/app/globals.css"
import { localeConfig, supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { ThemeProvider } from "@/hooks/use-theme";
import { SessionProvider } from "next-auth/react";
import { getDictionary } from "@/lib/dictionary"
import { AuthProvider } from "@/hooks/use-auth";
import { LocaleProvider } from "@/components/locale-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import Link from "next/link";
import { Building2, ShoppingBag, Calendar, ArrowLeft, ArrowRight, Phone } from "lucide-react"
import { toPersianDigits } from "@/lib/persian";

function resolveMetadataBase() {
  const rawUrl =
    process.env.NEXT_PUBLIC_DEPLOYED_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bazar-baz.ir";

  const normalizedUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : rawUrl.startsWith("localhost") || rawUrl.startsWith("127.0.0.1")
      ? `http://${rawUrl}`
      : `https://${rawUrl}`;

  return new URL(normalizedUrl);
}


export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "بازارباز - پلتفرم تجارت الکترونیک و رزو آنلاین نوبت",
    template: "%s | بازارباز"
  },
  description: "پلتفرم تجارت الکترونیک و رزرو نوبت",
  keywords: ["Bazar Baz", "marketplace", "online shop", "appointment booking", "بازارباز"],
  openGraph: {
    title: "بازارباز - پلتفرم تجارت الکترونیک و رزرو نوبت",
    description: "پلتفرم تجارت الکترونیک، فروشگاه آنلاین و رزرو نوبت",
    url: "https://bazar-baz.ir",
    siteName: "بازارباز",
    images: [
      {
        url: "/og-image.jpg",
        width: 800,
        height: 600,
      },
    ],
    locale: "fa",
    type: "website",
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
                </ThemeProvider>
              </ErrorBoundary>
            </AuthProvider>
          </LocaleProvider>
        </SessionProvider>
        {/* Footer */}
        <footer className="bg-muted/50 py-12 mt-12">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Link
                  href={`/${locale}`}
                  className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                >
                  <Building2 className="h-6 w-6 text-primary" />
                  <span className="font-bold text-lg">{t("home.platformName") || "پلتفرم تجارت"}</span>
                </Link>
              </div>
              <div className="flex gap-2">
                <Phone className="h-3 w-3 mt-1" /> <a className="text-xs">{toPersianDigits(0) + toPersianDigits(9162244868)}</a>
              </div>
              <a referrerPolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'>
                <img referrerPolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7' alt='' className='cursor:pointer' slot='PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'/>
              </a>
              <p className="text-sm text-muted-foreground">
                <Link href='/myResume.pdf'>درمورد ما</Link>
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}