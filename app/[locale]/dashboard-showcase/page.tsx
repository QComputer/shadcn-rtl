import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { featurePagesContent } from "@/lib/content/b2b-feature-pages-content"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = featurePagesContent.fa.dashboardShowcase
  return {
    title: {
      default: content.seo.title,
      template: "%s | بازارباز",
    },
    description: content.seo.description,
  }
}

export default async function DashboardShowcasePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = featurePagesContent.fa.dashboardShowcase

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
          </div>
        </div>
      </section>

      <main className="space-y-16 md:space-y-24">
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">نمای کلی داشبورد</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                در داشبورد بازارباز به همه ابزارهای مورد نیاز کسب‌وکار خود دسترسی دارید:
              </p>
              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {content.overview.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span className="text-sm text-foreground/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl mb-12">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">جریان‌های کاری اصلی</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                هر بخش داشبورد برای حل یک نیاز مشخص کسب‌وکار شما طراحی شده است.
              </p>
            </div>
            <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {content.workflows.map((workflow) => (
                <Card key={workflow.id} className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{workflow.icon}</span>
                      <CardTitle className="text-base">{workflow.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{workflow.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-secondary/20 p-8 sm:p-12">
              <div className="flex items-center gap-3 mb-6">
                <Badge variant="secondary" className="text-[10px]">امتیاز اعتماد</Badge>
              </div>
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">{content.safety.title}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{content.safety.subtitle}</p>
              <ul className="mt-8 space-y-4">
                {content.safety.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span className="text-sm text-foreground/90">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">آماده ejercer هستید؟</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                با ثبت‌نام در بازارباز می‌توانید پنل مدیریت مخصوص کسب‌وکار خود را داشته باشید.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href={`/${locale}/request-demo`}>
                  <Button size="lg" className="rounded-xl">{content.cta.primary}</Button>
                </Link>
                <Link href={`/${locale}/pricing`}>
                  <Button size="lg" variant="outline" className="rounded-xl bg-background/60">{content.cta.secondary}</Button>
                </Link>
                <Link href={`/${locale}/login`}>
                  <Button size="lg" variant="outline" className="rounded-xl bg-background/60">{content.cta.tertiary}</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
