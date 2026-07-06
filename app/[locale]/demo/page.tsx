import Link from "next/link"
import { Metadata } from "next"
import { b2bHomepageContent } from "@/lib/content/b2b-homepage-content"
import { demoBusinesses, demoIndustries, demoCapabilitySummary } from "@/lib/content/b2b-demo-businesses"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export const metadata: Metadata = {
  title: {
    default: "نمونه کاربرد بازارباز — دموی کسب‌وکارهای ایرانی",
    template: "%s | بازارباز",
  },
  description:
    "نمونه‌های نمایشی بازارباز برای آشنایی صاحبان کسب‌وکار با امکانات پلتفرم: فروشگاه، رستوران، داروخانه، مطب، سالن زیبایی، مرکز آموزشی و خدمات فنی.",
}

export default async function DemoPage({
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
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-secondary/20">
        <div className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_top_left,hsl(var(--primary)/.22),transparent_34%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/.12),transparent_32%)]" />
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <Badge variant="secondary" className="mx-auto">نمونه‌های نمایشی</Badge>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              نمونه کاربرد بازارباز برای کسب‌وکارهای مختلف
            </h1>
            <p className="text-lg leading-8 text-muted-foreground sm:text-xl">
              این نمونه‌ها فقط برای آشنایی صاحبان کسب‌وکار با پلتفرم بازارباز ساخته شده‌اند و با کسب‌وکارهای واقعی یا مشتریان عمومی مرتبط نیستند.
            </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href={`/${locale}/request-demo`}>
                  <Button size="lg" className="rounded-xl">درخواست دمو</Button>
                </Link>
                <Link href={`/${locale}/login`}>
                  <Button size="lg" variant="outline" className="rounded-xl bg-background/60">ورود به داشبورد</Button>
                </Link>
              </div>
          </div>
        </div>
      </section>

      <main className="space-y-16">
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {demoCapabilitySummary.map((capability) => (
                <Card key={capability} className="p-5">
                  <p className="text-sm font-medium leading-relaxed">{capability}</p>
                </Card>
              ))}
            </div>

            <div className="mx-auto max-w-3xl text-center mb-12">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">نمونه‌های کسب‌وکاری</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                هر نمونه نشان می‌دهد یک کسب‌وکار واقعی چگونه می‌تواند از بازارباز برای مدیریت فروش، خدمات، مشتریان و اطلاع‌رسانی استفاده کند.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {demoBusinesses.map((demo) => (
                <Card key={demo.id} className="flex h-full flex-col">
                  <div className="p-6 space-y-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold leading-tight">{demo.name}</h3>
                        <Badge variant="outline" className="mt-2 text-[10px]">{demo.label}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{demo.description}</p>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-foreground/70">جریان‌های اصلی:</p>
                      <ul className="space-y-1.5">
                        {demo.primaryWorkflows.map((workflow) => (
                          <li key={workflow} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{workflow}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="border-t px-6 py-4">
                    <p className="text-xs text-muted-foreground">این صفحه به دلیل معماری فعلی به صورت پیش‌نمایش است.</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">امکانات قابل مشاهده در نمونه‌ها</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                هر نمونه کسب‌وکار بخش‌هایی از پلتفرم بازارباز را به صورت متمرکز نشان می‌دهد.
              </p>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {demoBusinesses.map((demo) => (
                  <Card key={demo.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <span className="text-sm font-black">{demo.label}</span>
                      </div>
                      <div>
                        <h3 className="font-bold leading-tight">{demo.name}</h3>
                        <p className="text-xs text-muted-foreground">{demo.industry}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {demo.dashboardCapabilities.slice(0, 3).map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-[10px]">{cap}</Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-secondary/20 p-8 text-center sm:p-12">
              <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">آماده راه‌اندازی مشابه هستید؟</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                این نمونه‌ها فقط برای آشنایی هستند. با ثبت‌نام در بازارباز می‌توانید پنل مدیریت مخصوص کسب‌وکار خود را داشته باشید.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link href={`/${locale}/register/organization`}>
                  <Button size="lg" className="rounded-xl">درخواست دمو</Button>
                </Link>
                <Link href={`/${locale}/login`}>
                  <Button size="lg" variant="outline" className="rounded-xl bg-background/60">ورود به داشبورد</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
