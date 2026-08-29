import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { BazarBaazHomepage } from "@/components/public-experience/bazarbaaz-homepage";
import { getPublicDemoExperience } from "@/lib/public-experience/demo-experience.service";
import { buildHomepageViewModel } from "@/lib/public-experience/homepage-view-model";
import { getCanonicalUrl } from "@/lib/seo";

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "بازارباز | از کسب‌وکار سنتی تا حضور دیجیتال هوشمند",
  description:
    "بازارباز تجربه عمومی، منو یا خدمات دیجیتال، CRM، SEO، محتوا و دموهای تعاملی را برای کسب‌وکارهای محلی در یک لایه عملیاتی نمایش می‌دهد.",
  alternates: { canonical: getCanonicalUrl("/fa") },
  openGraph: {
    title: "بازارباز | حضور دیجیتال هوشمند برای کسب‌وکارهای محلی",
    description:
      "یک تجربه investor/customer-facing برای دیدن قابلیت‌های واقعی بازارباز: صفحه کسب‌وکار، منو، CRM، SEO، محتوا و Demo Universe.",
    url: getCanonicalUrl("/fa"),
    siteName: "بازارباز",
    images: [{ url: getCanonicalUrl("/og-image"), width: 1200, height: 630 }],
    locale: "fa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "بازارباز | حضور دیجیتال هوشمند برای کسب‌وکارهای محلی",
    description: "تجربه عمومی و دموی تعاملی بازارباز برای کسب‌وکار، مشتری و سرمایه‌گذار.",
    images: [getCanonicalUrl("/og-image")],
  },
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const demoExperience = await getPublicDemoExperience()
  const model = buildHomepageViewModel(demoExperience)

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Bazarbaaz",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: getCanonicalUrl(`/${locale}`),
          description: metadata.description,
          offers: { "@type": "Offer", availability: "https://schema.org/PreOrder" },
        }}
      />
      <BazarBaazHomepage model={model} locale={locale} />
    </>
  )
}
