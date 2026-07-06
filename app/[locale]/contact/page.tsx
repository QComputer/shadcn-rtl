import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { conversionContent } from "@/lib/content/b2b-conversion-content"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export const metadata: Metadata = {
  title: {
    default: conversionContent.fa.contact.title,
    template: "%s | بازارباز",
  },
  description: conversionContent.fa.contact.subtitle,
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = conversionContent.fa.contact

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-secondary/20">
        <div className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_top_left,hsl(var(--primary)/.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/.12),transparent_32%)]" />
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {content.title}
            </h1>
            <p className="text-lg leading-8 text-muted-foreground sm:text-xl">
              {content.subtitle}
            </p>
          </div>
        </div>
      </section>

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{content.suitableFor}</CardTitle>
                <CardDescription>بازارباز برای انواع کسب‌وکارهای خدماتی و تجاری مناسب است.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {content.suitableItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{content.onboardingPath}</CardTitle>
                <CardDescription>مسیر پیشنهادی برای شروع همکاری با بازارباز.</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  {content.onboardingSteps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{content.prepareInfo}</CardTitle>
                <CardDescription>برای سرعة در فرآیند راه‌اندازی، این اطلاعات را آماده داشته باشید.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {content.prepareItems.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mx-auto mt-12 max-w-3xl text-center">
            <Card>
              <CardHeader>
                <CardTitle>آماده شروع هستید؟</CardTitle>
                <CardDescription>{content.noContactInfo}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link href={`/${locale}/request-demo`}>
                    <Button size="lg" className="rounded-xl">{content.ctaRequestDemo}</Button>
                  </Link>
                  <Link href={`/${locale}/login`}>
                    <Button size="lg" variant="outline" className="rounded-xl bg-background/60">{content.ctaLogin}</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
