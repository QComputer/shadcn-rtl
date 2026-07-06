import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { featurePagesContent } from "@/lib/content/b2b-feature-pages-content"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = featurePagesContent.fa.features
  return {
    title: {
      default: content.seo.title,
      template: "%s | بازارباز",
    },
    description: content.seo.description,
  }
}

export default async function FeaturesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = featurePagesContent.fa.features

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-secondary/20">
        <div className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_top_left,hsl(var(--primary)/.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/.12),transparent_32%)]" />
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {content.hero.title}
            </h1>
            <p className="text-lg leading-8 text-muted-foreground sm:text-xl">
              {content.hero.subtitle}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href={`/${locale}/request-demo`}>
                <Button size="lg" className="rounded-xl">{content.cta.primary}</Button>
              </Link>
              <Link href={`/${locale}/demo`}>
                <Button size="lg" variant="outline" className="rounded-xl bg-background/60">{content.cta.secondary}</Button>
              </Link>
              <Link href={`/${locale}/dashboard-showcase`}>
                <Button size="lg" variant="outline" className="rounded-xl bg-background/60">{content.cta.tertiary}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="space-y-16 md:space-y-24">
        {content.groups.map((group) => (
          <section key={group.id} className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <div className="mx-auto max-w-3xl">
                <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{group.title}</h2>
                <p className="mt-4 text-lg text-muted-foreground">{group.what}</p>

                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div className="rounded-2xl border bg-card p-6">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">کاربران</p>
                    <p className="text-sm text-foreground/90">{group.who}</p>
                  </div>
                  <div className="rounded-2xl border bg-card p-6">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">جریان کاری نمونه</p>
                    <p className="text-sm text-foreground/90">{group.workflow}</p>
                  </div>
                  <div className="rounded-2xl border bg-card p-6">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">ارزش در داشبورد</p>
                    <p className="text-sm text-foreground/90">{group.dashboardValue}</p>
                  </div>
                  <div className="rounded-2xl border bg-card p-6">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">ارزش برای مشتری</p>
                    <p className="text-sm text-foreground/90">{group.customerFacingValue}</p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link href={`/${locale}/dashboard-showcase`}>
                    <Button variant="outline" size="sm" className="rounded-xl">مشاهده داشبورد</Button>
                  </Link>
                  <Link href={`/${locale}/request-demo`}>
                    <Button size="sm" className="rounded-xl">درخواست دمو</Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
