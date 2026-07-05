import { Card } from "@/components/ui/card"

type Capability = {
  id: string
  title: string
  description: string
  bullets: string[]
}

export function B2BCapabilities({ capabilities }: { capabilities: Capability[] }) {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">قابلیت‌های پلتفرم</h2>
          <p className="mt-4 text-lg text-muted-foreground">همه ابزارهای مورد نیاز کسب‌وکار شما در یک داشبورد یکپارچه</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap) => (
            <Card key={cap.id} className="h-full">
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-bold">{cap.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{cap.description}</p>
                <ul className="space-y-2.5">
                  {cap.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
