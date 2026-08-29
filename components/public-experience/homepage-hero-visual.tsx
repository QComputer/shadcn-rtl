import { ArrowDown, Building2, DatabaseZap, LineChart, Sparkles } from "lucide-react";

const transformationSteps = [
  { label: "کسب‌وکار", detail: "منو، خدمات، مشتری", icon: Building2 },
  { label: "ساختار داده", detail: "گراف، CRM، SEO", icon: DatabaseZap },
  { label: "رشد دیجیتال", detail: "حضور عمومی و تبدیل", icon: LineChart },
];

export function HomepageHeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-label="مسیر تبدیل کسب‌وکار سنتی به حضور دیجیتال">
      <div className="grid gap-3 sm:grid-cols-3">
        {transformationSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className="relative overflow-hidden rounded-lg border bg-card p-4 shadow-sm motion-safe:animate-[bazar-rise_900ms_ease-out_both]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold">{step.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </div>
              {index < transformationSteps.length - 1 ? (
                <ArrowDown className="absolute end-4 top-4 hidden h-4 w-4 rotate-90 text-muted-foreground sm:block" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Bazarbaaz operating layer</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Public site, catalog, CRM, SEO, content workflow, dry-run integrations</p>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-primary motion-safe:animate-pulse" aria-hidden="true" />
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden="true">
          {[62, 74, 48, 86, 68].map((height, index) => (
            <span
              key={index}
              className="block rounded-sm bg-primary/70 motion-safe:animate-[bazar-bars_1.8s_ease-in-out_infinite]"
              style={{ height, animationDelay: `${index * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
