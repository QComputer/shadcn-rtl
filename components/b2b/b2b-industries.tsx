import { Card } from "@/components/ui/card"

type Industry = {
  id: string
  name: string
  description: string
}

export function B2BIndustries({ industries }: { industries: Industry[] }) {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center mb-12">
          <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">صنایع مناسب</h2>
          <p className="mt-4 text-lg text-muted-foreground">بازارباز برای انواع کسب‌وکارها طراحی شده است</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => (
            <Card key={industry.id} className="p-5">
              <h3 className="font-bold">{industry.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{industry.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
