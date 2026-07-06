import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { b2bLegalContent } from "@/lib/content/b2b-legal-content"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = b2bLegalContent.fa.privacy
  return {
    title: {
      default: content.seo.title,
      template: "%s | بازارباز",
    },
    description: content.seo.description,
  }
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = b2bLegalContent.fa.privacy

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
              <Link href={`/${locale}/contact`}>
                <Button size="lg" className="rounded-xl">{content.cta.primary}</Button>
              </Link>
              <Link href={`/${locale}/terms`}>
                <Button size="lg" variant="outline" className="rounded-xl bg-background/60">{content.cta.secondary}</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="space-y-16 md:space-y-24">
        {content.sections.map((section, index) => (
          <section key={index} className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <div className="mx-auto max-w-3xl">
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">{section.title}</h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                  {section.body}
                </p>
              </div>
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
