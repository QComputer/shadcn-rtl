import type { Metadata } from "next";
import "@/app/globals.css"
import { localeConfig, supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { ThemeProvider } from "@/hooks/use-theme";

export const metadata: Metadata = {
  title: "جامعه صفر",
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

  return (
    <html lang={locale} dir={config.dir}>
      <head key={locale}>
      </head>
      <body className="antialiased">
      <ThemeProvider defaultTheme="dark" storageKey="shadcn-rtl-theme">
          {children}
      </ThemeProvider>
      </body>
    </html>
  );
}
