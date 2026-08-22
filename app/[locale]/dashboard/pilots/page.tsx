import { redirect } from "next/navigation";
import { Activity, CheckCircle2, Circle, ClipboardList, Search, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { listPilotWorkspaces } from "@/lib/pilot-operations/pilot-workspace.service";

export const dynamic = "force-dynamic";

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DISCOVERY: "کشف",
    ONBOARDING: "ورود",
    CONFIGURATION: "پیکربندی",
    READY_FOR_LAUNCH: "آماده لانچ",
    LIVE: "زنده",
    PAUSED: "متوقف",
  };
  return labels[status] ?? status;
}

export default async function PilotOperationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale);
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/pilots`)}`);
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect(`/${locale}/dashboard`);
  }

  const overview = await listPilotWorkspaces();

  return (
    <main className="space-y-6 p-4 sm:p-6" dir={locale === "en" ? "ltr" : "rtl"}>
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-emerald-700">فضای داخلی تیم بازارباز</p>
            <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">مرکز عملیات پایلوت‌ها</h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              وضعیت آماده‌سازی کسب‌وکارهای پایلوت، چک‌لیست عملیاتی، آمادگی رشد، اعتماد، سئو و اتصال‌های dry-run را در یک نمای داخلی نشان می‌دهد.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
            <div className="border border-slate-200 bg-white p-3">
              <div className="text-2xl font-bold text-slate-950">{overview.counts.total}</div>
              <div className="text-xs text-slate-500">کل پایلوت‌ها</div>
            </div>
            <div className="border border-slate-200 bg-white p-3">
              <div className="text-2xl font-bold text-emerald-700">{overview.counts.readyForLaunch}</div>
              <div className="text-xs text-slate-500">آماده لانچ</div>
            </div>
            <div className="border border-slate-200 bg-white p-3">
              <div className="text-2xl font-bold text-slate-700">{overview.counts.live}</div>
              <div className="text-xs text-slate-500">زنده</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {overview.pilots.map((pilot) => (
          <article key={pilot.id} className="border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">{pilot.organization.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {pilot.organization.industry} · {pilot.organization.capabilities.join(", ")}
                </p>
              </div>
              <span className="w-fit border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                {statusLabel(pilot.status)}
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">پیشرفت</span>
                <span className="font-bold text-slate-950">{pilot.readinessSummary.progressPercent}%</span>
              </div>
              <div className="h-2 bg-slate-100">
                <div className="h-2 bg-emerald-600" style={{ width: `${pilot.readinessSummary.progressPercent}%` }} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-2 border border-slate-100 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ClipboardList className="h-4 w-4" />
                  موارد ناقص
                </div>
                <ul className="space-y-1 text-sm text-slate-600">
                  {pilot.readinessSummary.missingItems.slice(0, 5).map((item) => (
                    <li key={item.key} className="flex items-center gap-2">
                      <Circle className="h-3 w-3 text-slate-400" />
                      {item.title}
                    </li>
                  ))}
                  {pilot.readinessSummary.missingItems.length === 0 && (
                    <li className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      چک‌لیست اصلی کامل است
                    </li>
                  )}
                </ul>
              </div>

              <div className="space-y-2 border border-slate-100 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Activity className="h-4 w-4" />
                  اقدام پیشنهادی
                </div>
                <p className="text-sm leading-6 text-slate-600">{pilot.readinessSummary.recommendedNextAction ?? "بازبینی نهایی پایلوت"}</p>
                <p className="text-xs text-slate-500">{pilot.setupFlow.sourceLabel}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
              <div className="border border-slate-100 p-3">
                <div className="text-slate-500">SEO Score</div>
                <div className="font-semibold text-slate-900">{pilot.readinessSummary.seo.seoScore}/100</div>
              </div>
              <div className="border border-slate-100 p-3">
                <div className="text-slate-500">کلمات کلیدی</div>
                <div className="font-semibold text-slate-900">{pilot.readinessSummary.seo.keywordPlanCount}</div>
              </div>
              <div className="border border-slate-100 p-3">
                <div className="text-slate-500">iAM</div>
                <div className="font-semibold text-slate-900">{pilot.readinessSummary.seo.iamRecommendationCount}</div>
              </div>
              <div className="border border-slate-100 p-3">
                <div className="text-slate-500">محتوا</div>
                <div className="font-semibold text-slate-900">{pilot.readinessSummary.seo.contentOpportunityCount}</div>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Search className="h-4 w-4" />
                  آماده‌سازی رشد
                </div>
                <span className="w-fit border border-slate-200 px-2 py-1 text-xs text-slate-600">
                  {pilot.readinessSummary.seo.seoStrategyStatus}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                {pilot.growthPlanner.futureHooks.map((hook) => (
                  <span key={hook} className="border border-slate-200 px-2 py-1">{hook}</span>
                ))}
                {pilot.readinessSummary.seo.nextGrowthAction && (
                  <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
                    {pilot.readinessSummary.seo.nextGrowthAction}
                  </span>
                )}
                <span className="border border-slate-200 px-2 py-1">بدون تماس خارجی</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      {overview.pilots.length === 0 && (
        <section className="border border-dashed border-slate-300 bg-white p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">هنوز پایلوتی ثبت نشده است</h2>
          <p className="mt-2 text-sm text-slate-500">از API داخلی پایلوت یا seed محلی برای ایجاد workspace استفاده کنید.</p>
        </section>
      )}
    </main>
  );
}
