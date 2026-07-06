import Link from "next/link"
import { Button } from "@/components/ui/button"

type Locale = "fa" | "en" | "ar"

export function B2BFinalCta({ isRTL, locale, primaryHref = `/${locale}/request-demo` }: { isRTL: boolean; locale: Locale; primaryHref?: string }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-secondary/20 p-8 text-center sm:p-12">
          <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">آماده شروع هستید؟</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            همین حالا کسب‌وکار خود را به بازارباز اضافه کنید و از امکانات پلتفرم بهره‌مند شوید.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href={primaryHref}>
              <Button size="lg" className="rounded-xl">درخواست دمو</Button>
            </Link>
            <Link href={`/${locale}/login`}>
              <Button size="lg" variant="outline" className="rounded-xl bg-background/60">ورود به داشبورد</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
