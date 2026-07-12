import { b2bHomepageContent } from "@/lib/content/b2b-homepage-content"
import { B2BHero } from "@/components/b2b/b2b-hero"
import { B2BCapabilities } from "@/components/b2b/b2b-capabilities"
import { B2BIndustries } from "@/components/b2b/b2b-industries"
import { B2BDemoPreview } from "@/components/b2b/b2b-demo-preview"
import { B2BHowItWorks } from "@/components/b2b/b2b-how-it-works"
import { B2BFaq } from "@/components/b2b/b2b-faq"
import { B2BFinalCta } from "@/components/b2b/b2b-cta"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export const metadata = {
  title: {
    default: b2bHomepageContent.fa.seo.title,
    template: "%s | بازارباز",
  },
  description: b2bHomepageContent.fa.seo.description,
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const isRTL = locale === "fa" || locale === "ar"

  const content = b2bHomepageContent.fa

  return (
    <div className="min-h-screen bg-background">
      <B2BHero content={content.hero} isRTL={isRTL} locale={locale} demoHref={`/${locale}/demo`} primaryHref={`/${locale}/request-demo`} />

      <main>
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{content.problem.title}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{content.problem.subtitle}</p>
              <ul className="mt-8 space-y-3 text-muted-foreground">
                {content.problem.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive/80" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{content.solution.title}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{content.solution.subtitle}</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {content.solution.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <B2BCapabilities capabilities={content.capabilities} />

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href={`/${locale}/features`}>
                  <Button size="lg" variant="outline" className="rounded-xl bg-background/60">مشاهده همه امکانات</Button>
                </Link>
                <Link href={`/${locale}/onboarding`}>
                  <Button size="lg" variant="outline" className="rounded-xl bg-background/60">ویزارد راه‌اندازی</Button>
                </Link>
                <Link href={`/${locale}/dashboard-showcase`}>
                  <Button size="lg" variant="outline" className="rounded-xl bg-background/60">داشبورد مدیریتی</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <B2BIndustries industries={content.industries} />

        <B2BDemoPreview demos={content.demoBusinesses} isRTL={isRTL} locale={locale} />

        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{content.notifications.title}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{content.notifications.subtitle}</p>
            </div>
            <ul className="mx-auto max-w-2xl space-y-3 text-muted-foreground">
              {content.notifications.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{content.trust.title}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{content.trust.subtitle}</p>
              <ul className="mt-8 space-y-3 text-muted-foreground">
                {content.trust.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <B2BHowItWorks steps={content.howItWorks} />

        <B2BFaq items={content.faq} />

        <B2BFinalCta isRTL={isRTL} locale={locale} primaryHref={`/${locale}/request-demo`} />
      </main>
    </div>
  )
}
