import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { conversionContent } from "@/lib/content/b2b-conversion-content"
import { RequestDemoForm } from "./form"

type Locale = "fa" | "en" | "ar"

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale
  return "fa"
}

export const metadata: Metadata = {
  title: {
    default: conversionContent.fa.requestDemo.title,
    template: "%s | بازارباز",
  },
  description: conversionContent.fa.requestDemo.subtitle,
}

export default async function RequestDemoPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = normalizeLocale(resolvedParams.locale)
  const content = conversionContent.fa.requestDemo

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
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{content.title}</CardTitle>
                <CardDescription>{content.subtitle}</CardDescription>
              </CardHeader>
              <CardContent>
                <RequestDemoForm locale={locale} content={content} />
              </CardContent>
            </Card>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">امکانات پلتفرم</CardTitle>
                  <CardDescription>با قابلیت‌های بازارباز بیشتر آشنا شوید.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/${locale}/features`}>
                    <Button variant="outline" className="w-full">مشاهده امکانات</Button>
                  </Link>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">داشبورد مدیریتی</CardTitle>
                  <CardDescription>نحوه کار پنل مدیریت بازارباز را ببینید.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/${locale}/dashboard-showcase`}>
                    <Button variant="outline" className="w-full">مشاهده داشبورد</Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="sm:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">ویزارد راه‌اندازی</CardTitle>
                  <CardDescription>اگر هنوز مسیر دقیق شروع را نمی‌دانید، ابتدا نیازهای کسب‌وکار را مرحله‌به‌مرحله مشخص کنید.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/${locale}/onboarding`}>
                    <Button variant="outline" className="w-full">شروع ویزارد راه‌اندازی</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
