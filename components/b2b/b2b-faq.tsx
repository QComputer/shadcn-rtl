import { ChevronDown } from "lucide-react"

type FaqItem = {
  question: string
  answer: string
}

export function B2BFaq({ items }: { items: FaqItem[] }) {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">سوالات متداول</h2>
        </div>
        <div className="mx-auto max-w-2xl space-y-4">
          {items.map((item, i) => (
            <details key={i} className="group rounded-2xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-medium">
                <span>{item.question}</span>
                <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="border-t px-5 py-4 text-sm text-muted-foreground leading-relaxed">
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
