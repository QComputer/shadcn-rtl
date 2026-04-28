import type { Metadata } from "next";
import "@/app/globals.css"
import { localeConfig, supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { ThemeProvider } from "@/hooks/use-theme";
import { getDictionary } from "@/lib/dictionary"
import { LocaleSwitcher } from "@/components/ui/locale-switcher"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { Button } from "@/components/ui/button"
import Link from "next/link";
import { Building2, ShoppingBag, Calendar, ArrowLeft, ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "بازارباز",
  description: "پلتفرم تجارت الکترونیک و رزرو نوبت",
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
      <ThemeProvider defaultTheme="dark" storageKey="shadcn-rtl-theme">

          {children}
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
                    <a referrerPolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'>
                    <img referrerPolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=6010025&Code=PIS9oHglTwxwasymJaZx3w3cO1wbPvA7' alt='' className='cursor:pointer' slot='PIS9oHglTwxwasymJaZx3w3cO1wbPvA7'/>
                    e-namad
                    </a>
                            
            <p className="text-sm text-muted-foreground">
              © 2026 {t("home.copyright") || "تمامی حقوق محفوظ است"}
            </p>
          </div>
        </div>
      </footer>
      </ThemeProvider>
      </body>
    </html>
  );
}
