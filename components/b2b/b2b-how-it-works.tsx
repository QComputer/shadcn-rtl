import { ArrowRight } from "lucide-react"

type Step = {
  step: number
  title: string
  description: string
}

export function B2BHowItWorks({ steps }: { steps: Step[] }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">نحوه کار</h2>
          <p className="mt-4 text-lg text-muted-foreground">شروع کار با بازارباز تنها در چند دقیقه است</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s) => (
            <div key={s.step} className="relative rounded-2xl border bg-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-black text-primary">
                {s.step}
              </div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
