import Link from "next/link"
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

type Locale = "fa" | "en" | "ar"

type HeroContent = {
  title: string
  subtitle: string
  primaryCta: string
  secondaryCta: string
}

export function B2BHero({ content, isRTL, locale, demoHref = `/${locale}/demo`, primaryHref = `/${locale}/request-demo` }: { content: HeroContent; isRTL: boolean; locale: Locale; demoHref?: string; primaryHref?: string }) {
  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-secondary/20">
      <div className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_top_left,hsl(var(--primary)/.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/.12),transparent_32%)]" />
      <div className="container mx-auto px-4 py-16 lg:py-24">
        <div className="mx-auto max-w-3xl text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>پلتفرم خدماتی کسب‌وکار ایرانی</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {content.title}
          </h1>
          <p className="text-lg leading-8 text-muted-foreground sm:text-xl">
            {content.subtitle}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={primaryHref}>
              <Button size="lg" className="rounded-xl">{content.primaryCta}</Button>
            </Link>
            <Link href={demoHref}>
              <Button size="lg" variant="outline" className="rounded-xl bg-background/60">{content.secondaryCta}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
