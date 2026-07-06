import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { conversionContent } from "@/lib/content/b2b-conversion-content"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export const metadata: Metadata = {
  title: {
    default: conversionContent.fa.pricing.title,
    template: "%s | بازارباز",
  },
  description: conversionContent.fa.pricing.subtitle,
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = conversionContent.fa.pricing

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
            <p className="text-sm text-muted-foreground">{content.note}</p>
          </div>
        </div>
      </section>

      <main className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {content.packages.map((pkg) => (
              <Card key={pkg.id} className="flex h-full flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-xl">{pkg.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{pkg.id}</Badge>
                  </div>
                  <CardDescription>{pkg.target}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{pkg.description}</p>
                  <ul className="space-y-2.5">
                    {pkg.capabilities.map((capability) => (
                      <li key={capability} className="flex items-start gap-2.5 text-sm text-foreground/80">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{capability}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-3xl text-center">
            <Card>
              <CardHeader>
                <CardTitle>نیازمند مشاوره هستید؟</CardTitle>
                <CardDescription>
                  برای دریافت بسته مناسب نیازهای کسب‌وکار خود با تیم بازارباز تماس بگیرید.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link href={`/${locale}/request-demo`}>
                    <Button size="lg" className="rounded-xl">{content.ctaRequestDemo}</Button>
                  </Link>
                  <Link href={`/${locale}/features`}>
                    <Button size="lg" variant="outline" className="rounded-xl bg-background/60">مشاهده امکانات</Button>
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
