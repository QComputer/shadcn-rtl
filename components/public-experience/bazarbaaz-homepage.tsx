import Link from "next/link";
import {
  ArrowLeft,
  Blocks,
  CalendarClock,
  CheckCircle2,
  FileText,
  Hash,
  LineChart,
  Megaphone,
  SearchCheck,
  Share2,
  Store,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DemoLauncherClient } from "@/components/public-experience/demo-launcher-client";
import { HomepageHeroVisual } from "@/components/public-experience/homepage-hero-visual";
import { BazarbaazLogo } from "@/components/brand/BazarbaazLogo";
import type { HomepageViewModel } from "@/lib/public-experience/homepage-view-model";

const featureIcons = {
  Store,
  CalendarClock,
  UsersRound,
  BadgePercent: UsersRound,
  SearchCheck,
  FileText,
  Share2,
  Megaphone,
  Hash,
  ChartNoAxesCombined: LineChart,
  Blocks,
} as const;

export function BazarBaazHomepage({ model, locale }: { model: HomepageViewModel; locale: string }) {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b bg-background">
        <div className="container mx-auto grid gap-10 px-4 py-12 md:py-16 lg:grid-cols-[1fr_.9fr] lg:items-center lg:py-20">
          <div className="max-w-3xl">
            <Link href={`/${locale}`} aria-label={locale === "fa" ? "بازارباز" : "Bazarbaaz"} className="mb-6 inline-flex">
              <BazarbaazLogo
                language={locale === "fa" ? "fa" : "en"}
                className="h-10 w-auto sm:h-12"
              />
            </Link>
            <Badge variant="secondary" className="mb-5">{model.hero.eyebrow}</Badge>
            <h1 className="text-4xl font-black leading-tight text-foreground sm:text-5xl lg:text-6xl">
              {model.hero.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              {model.hero.subtitle}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#demo-universe">
                <Button size="lg" className="rounded-md">
                  {model.hero.primaryCta}
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
              <Link href={`/${locale}/request-demo`}>
                <Button size="lg" variant="outline" className="rounded-md bg-background">
                  {model.hero.secondaryCta}
                </Button>
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              {model.metrics.map((metric) => (
                <div key={metric.label} className="rounded-md border bg-card p-3">
                  <p className="text-2xl font-black">{metric.value}</p>
                  <p className="mt-1 text-xs font-medium">{metric.label}</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{metric.description}</p>
                </div>
              ))}
            </div>
          </div>
          <HomepageHeroVisual />
        </div>
      </section>

      <main>
        <section className="py-14 md:py-20">
          <div className="container mx-auto grid gap-8 px-4 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div>
              <Badge variant="outline" className="mb-4">The problem</Badge>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{model.problem.title}</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">{model.problem.subtitle}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {model.problem.points.map((point) => (
                <Card key={point} className="p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                    <p className="text-sm leading-6 text-muted-foreground">{point}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4">The solution</Badge>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{model.solution.title}</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">{model.solution.subtitle}</p>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-4">
              {model.solution.stages.map((stage, index) => (
                <Card key={stage.title} className="relative p-5">
                  <span className="text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-black">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-4">Interactive product journey</Badge>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">مسیر محصول از اتصال داده تا رشد</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                این تایم‌لاین از قرارداد Demo Universe و Public Experience می‌آید و فقط سناریوهای dry-run را نمایش می‌دهد.
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-7">
              {model.storytelling.map((step) => (
                <Card key={step.key} className="p-4">
                  <p className="text-xs font-bold text-primary">{step.ordering}</p>
                  <h3 className="mt-3 text-sm font-black leading-6">{step.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
              <div>
                <Badge variant="secondary" className="mb-4">iNoti ecosystem</Badge>
                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">بازارباز به‌عنوان لایه عملیاتی اکوسیستم</h2>
                <p className="mt-4 text-base leading-8 text-muted-foreground">
                  این بخش فقط قراردادها و آداپترهای آماده یا dry-run را نمایش می‌دهد؛ هیچ اتصال واقعی یا ادعای عملیاتی خارج از وضعیت فعلی پروژه اضافه نشده است.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {model.ecosystem.map((item) => (
                  <Card key={item.key} className="p-4">
                    <Badge variant={item.key === "BazarBaaz" ? "default" : "outline"}>{item.key}</Badge>
                    <h3 className="mt-3 text-base font-black">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="outline" className="mb-4">Platform features</Badge>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">ویژگی‌هایی که تجربه عمومی را پشتیبانی می‌کنند</h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {model.platformFeatures.map((feature) => {
                const Icon = featureIcons[feature.icon as keyof typeof featureIcons] ?? Blocks;
                return (
                  <Card key={feature.key} className="p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-black">{feature.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {feature.relatedCapabilities.map((capability) => (
                        <Badge key={capability} variant="outline" className="text-[10px]">{capability}</Badge>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <Badge variant="secondary" className="mb-4">Business examples</Badge>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">برای چند نوع کسب‌وکار قابل توضیح است</h2>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {model.industries.map((industry) => (
                <Card key={industry.key} className="p-5">
                  <h3 className="text-lg font-black">{industry.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{industry.description}</p>
                  <Badge variant="outline" className="mt-4">{industry.capabilityHint}</Badge>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="demo-universe" className="py-14 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4">Demo Universe</Badge>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{model.demo.title}</h2>
              <p className="mt-4 text-base leading-8 text-muted-foreground">{model.demo.subtitle}</p>
            </div>
            <div className="mt-10">
              <DemoLauncherClient locale={locale} organizations={model.demo.organizations} journeys={model.demo.journeys} />
            </div>
          </div>
        </section>

        <section className="pb-16 md:pb-24">
          <div className="container mx-auto px-4">
            <div className="rounded-lg border bg-card p-6 text-center md:p-8">
              <h2 className="text-2xl font-black">برای دیدن جریان کامل، وارد دمو شوید</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                تجربه دمو از داده‌های نمایشی، نقش‌های ایزوله و آداپترهای dry-run استفاده می‌کند؛ هیچ ارائه‌دهنده واقعی فراخوانی نمی‌شود.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="#demo-universe">
                  <Button className="rounded-md">انتخاب دمو</Button>
                </Link>
                <Link href={`/${locale}/onboarding`}>
                  <Button variant="outline" className="rounded-md bg-background">ویزارد راه‌اندازی</Button>
                </Link>
                <Link href={`/${locale}/dashboard-showcase`}>
                  <Button variant="outline" className="rounded-md bg-background">نمای داشبورد</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
