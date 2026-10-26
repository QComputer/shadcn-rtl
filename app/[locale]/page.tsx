import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { BazarBaazHomepage } from "@/components/public-experience/bazarbaaz-homepage";
import { getCanonicalUrl } from "@/lib/seo";

type Locale = "fa" | "en" | "ar";

function normalizeLocale(locale: string | undefined): Locale {
  return locale === "en" || locale === "ar" ? locale : "fa";
}

export const metadata: Metadata = {
  title: "بازارباز | راه‌اندازی و مدیریت آنلاین کسب‌وکار",
  description: "صفحه کسب‌وکارت را آنلاین بساز، محصولات و خدماتت را معرفی کن و کارهای روزانه را از یک پنل مدیریت کن.",
  alternates: { canonical: getCanonicalUrl("/fa") },
  openGraph: {
    title: "بازارباز | کسب‌وکارت را آنلاین راه بینداز",
    description: "یک صفحه آنلاین برای کسب‌وکارت بساز و سفارش‌ها، خدمات و ارتباط با مشتریانت را مدیریت کن.",
    url: getCanonicalUrl("/fa"),
    siteName: "بازارباز",
    images: [{ url: getCanonicalUrl("/og-image"), width: 1200, height: 630 }],
    locale: "fa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "بازارباز | راه‌اندازی آنلاین کسب‌وکار",
    description: "صفحه کسب‌وکارت را بساز و از یک پنل مدیریت کن.",
    images: [getCanonicalUrl("/og-image")],
  },
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Bazarbaaz",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: getCanonicalUrl(`/${locale}`),
        description: metadata.description,
      }} />
      <BazarBaazHomepage locale={locale} />
    </>
  );
}
