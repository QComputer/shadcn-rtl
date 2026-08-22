import { Metadata } from "next";
import Link from "next/link";
import { DemoEntryClient } from "@/components/demo-universe/demo-entry-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Locale = "fa" | "en" | "ar";

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale;
  return "fa";
}

export const metadata: Metadata = {
  title: "دموی تعاملی بازارباز | تجربه کامل پلتفرم کسب‌وکار",
  description: "دموی تعاملی بازارباز برای تجربه نقش‌های مدیر پلتفرم، مالک سازمان، مدیر، کارمند، راننده و مشتری.",
};

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary/10 via-background to-secondary/20">
        <div className="absolute inset-0 -z-10 opacity-70 [background:radial-gradient(circle_at_top_left,hsl(var(--primary)/.20),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--secondary)/.36),transparent_34%)]" />
        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary">BazarBaaz Interactive Demo Universe</Badge>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              بازارباز را مثل یک کسب‌وکار واقعی تجربه کنید
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              وارد نقش‌های مدیر پلتفرم، مالک کسب‌وکار، مدیر، کارمند، راننده یا مشتری شوید و جریان کامل سفارش، عملیات، CRM و یکپارچه‌سازی‌ها را ببینید.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={`/${locale}`}>
                <Button variant="outline" className="rounded-xl bg-background/70">بازگشت به صفحه اصلی</Button>
              </Link>
              <Link href={`/${locale}/dashboard-showcase`}>
                <Button variant="outline" className="rounded-xl bg-background/70">نمای داشبورد</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        <DemoEntryClient locale={locale} />
      </main>
    </div>
  );
}
