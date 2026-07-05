import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Store } from "lucide-react"

type DemoBusiness = {
  id: string
  name: string
  label: string
  description: string
}

export function B2BDemoPreview({ demos, isRTL, locale }: { demos: DemoBusiness[]; isRTL: boolean; locale: string }) {
  return (
    <section id="demo" className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <Badge variant="secondary" className="mb-4">نمونه‌های نمایشی</Badge>
          <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">مشاهده نمونه کسب‌وکارها</h2>
          <p className="mt-4 text-lg text-muted-foreground">این نمونه‌ها شبیه‌سازی‌هایی از نحوه استفاده کسب‌وکارها از بازارباز هستند و با کسب‌وکارهای واقعی مرتبط نیستند.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((demo) => (
            <Card key={demo.id} className="overflow-hidden">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold leading-tight">{demo.name}</h3>
                    <Badge variant="outline" className="mt-1 text-[10px]">{demo.label}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{demo.description}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href={`/${locale}/register/organization`}>
            <Button size="lg" className="rounded-xl">درخواست دمو</Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
