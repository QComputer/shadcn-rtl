"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Loader2, PlayCircle, RefreshCw, Save, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SupportedLocale } from "@/lib/i18n";
import type { OwnerActivationDashboard } from "@/lib/business-acquisition/owner-activation.service";
import { cn } from "@/lib/utils";

type DashboardResponse = { dashboard: OwnerActivationDashboard };

const copy = {
  fa: {
    title: "فعال‌سازی کسب‌وکار",
    subtitle: "مراحل آماده‌سازی، رشد و اتصال‌های پیشنهادی کسب‌وکار شما در بازارباز.",
    loading: "در حال بارگذاری فعال‌سازی...",
    retry: "تلاش دوباره",
    profile: "پروفایل عمومی",
    readiness: "آمادگی فعال‌سازی",
    businessReadiness: "امتیاز آمادگی کسب‌وکار",
    next: "اقدام‌های بعدی",
    completedTasks: "تکمیل‌شده",
    allTasks: "همه مراحل",
    growth: "پیشنهادهای رشد",
    inoti: "آمادگی iNoti",
    integrations: "اتصال‌ها فقط پیشنهادی هستند و فعال‌سازی خارجی انجام نشده است.",
    save: "ذخیره پروفایل",
    saving: "در حال ذخیره",
    markComplete: "تکمیل شد",
    start: "شروع",
    view: "مشاهده",
    publicPage: "صفحه عمومی",
    description: "توضیح کسب‌وکار",
    address: "آدرس",
    phone: "تلفن",
    email: "ایمیل",
    completed: "تکمیل‌شده",
    missing: "نیازمند تکمیل",
    capabilities: "قابلیت‌های فعال",
    ownerRole: "نقش شما",
    noInoti: "در این قالب اتصال پیشنهادی ثبت نشده است.",
  },
  en: {
    title: "Business activation",
    subtitle: "Your BazarBaaz readiness, growth recommendations, and suggested integration setup.",
    loading: "Loading activation...",
    retry: "Retry",
    profile: "Public profile",
    readiness: "Activation readiness",
    businessReadiness: "Business readiness score",
    next: "Next actions",
    completedTasks: "Completed",
    allTasks: "All setup tasks",
    growth: "Growth recommendations",
    inoti: "iNoti readiness",
    integrations: "Integrations are recommendations only; no external activation has been performed.",
    save: "Save profile",
    saving: "Saving",
    markComplete: "Mark complete",
    start: "Start",
    view: "View",
    publicPage: "Public page",
    description: "Business description",
    address: "Address",
    phone: "Phone",
    email: "Email",
    completed: "Completed",
    missing: "Missing",
    capabilities: "Enabled capabilities",
    ownerRole: "Your role",
    noInoti: "No recommended integration is registered for this template.",
  },
  ar: {
    title: "تفعيل النشاط",
    subtitle: "جاهزية نشاطك على بازارباز وتوصيات النمو والتكاملات المقترحة.",
    loading: "جاري تحميل التفعيل...",
    retry: "إعادة المحاولة",
    profile: "الملف العام",
    readiness: "جاهزية التفعيل",
    businessReadiness: "درجة جاهزية النشاط",
    next: "الخطوات التالية",
    completedTasks: "مكتمل",
    allTasks: "كل خطوات الإعداد",
    growth: "توصيات النمو",
    inoti: "جاهزية iNoti",
    integrations: "التكاملات توصيات فقط ولم يتم أي تفعيل خارجي.",
    save: "حفظ الملف",
    saving: "جاري الحفظ",
    markComplete: "اكتمل",
    start: "ابدأ",
    view: "عرض",
    publicPage: "الصفحة العامة",
    description: "وصف النشاط",
    address: "العنوان",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    completed: "مكتمل",
    missing: "ناقص",
    capabilities: "القدرات المفعلة",
    ownerRole: "دورك",
    noInoti: "لا يوجد تكامل مقترح لهذا القالب.",
  },
} satisfies Record<SupportedLocale, Record<string, string>>;

export function BusinessActivationClient({ locale }: { locale: SupportedLocale }) {
  const t = copy[locale] ?? copy.fa;
  const isRtl = locale === "fa" || locale === "ar";
  const [dashboard, setDashboard] = useState<OwnerActivationDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [completingKey, setCompletingKey] = useState<string | null>(null);
  const [form, setForm] = useState({ description: "", address: "", phone: "", email: "" });

  async function load() {
    setIsLoading(true);
    setError(null);
    const response = await fetch(`/api/dashboard/business-activation?locale=${locale}`, { cache: "no-store" });
    if (!response.ok) {
      setError(await response.text());
      setIsLoading(false);
      return;
    }
    const data = (await response.json()) as DashboardResponse;
    setDashboard(data.dashboard);
    setForm({
      description: data.dashboard.organization.description ?? "",
      address: data.dashboard.organization.address ?? "",
      phone: data.dashboard.organization.phone ?? "",
      email: data.dashboard.organization.email ?? "",
    });
    setIsLoading(false);
  }

  useEffect(() => {
    void load();
  }, [locale]);

  async function saveProfile() {
    if (!dashboard) return;
    setIsSaving(true);
    const response = await fetch("/api/dashboard/business-activation/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: dashboard.organization.id, ...form }),
    });
    if (response.ok) {
      const data = (await response.json()) as DashboardResponse;
      setDashboard(data.dashboard);
    }
    setIsSaving(false);
  }

  async function completeStep(taskKey: string) {
    if (!dashboard) return;
    setCompletingKey(taskKey);
    const response = await fetch("/api/dashboard/business-activation/steps/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: dashboard.organization.id, taskKey }),
    });
    if (response.ok) {
      const data = (await response.json()) as DashboardResponse;
      setDashboard(data.dashboard);
    }
    setCompletingKey(null);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t.loading}
        </div>
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8" dir={isRtl ? "rtl" : "ltr"}>
        <Card id="integrations">
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{error ?? t.loading}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{dashboard.organization.industryKey}</Badge>
            <Badge variant="outline">{t.ownerRole}: {dashboard.membership.role}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">{t.title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{dashboard.guidedSetup.greeting}</p>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{t.subtitle}</p>
        </div>
        <Link
          href={dashboard.organization.publicPaths.shell}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm font-medium",
            "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t.publicPage}
        </Link>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t.readiness}</CardTitle>
            <CardDescription>{dashboard.organization.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{dashboard.guidedSetup.progress.completed}/{dashboard.guidedSetup.progress.total}</span>
                <span className="font-medium">{dashboard.guidedSetup.progress.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${dashboard.guidedSetup.progress.percent}%` }} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {dashboard.guidedSetup.tasks.slice(0, 8).map((task) => (
                <div key={task.taskKey} className="flex min-w-0 items-start gap-2 rounded-lg border p-3">
                  {task.status === "COMPLETED" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-5">{task.title}</p>
                    <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{task.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.profile}</CardTitle>
            <CardDescription>{dashboard.profileCompletion.score}%</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label={t.description}>
              <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </Field>
            <Field label={t.address}>
              <Input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.phone}>
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label={t.email}>
                <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
            </div>
            <Button onClick={() => void saveProfile()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {isSaving ? t.saving : t.save}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t.next}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.guidedSetup.nextRecommendedTasks.map((task) => (
              <div key={task.taskKey} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium leading-5">{task.title}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{task.description}</p>
                  </div>
                  <Badge variant="outline">{task.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.targetRoute ? (
                    <LinkButton href={dashboardHref(locale, task.targetRoute)}>
                      <PlayCircle className="h-4 w-4" aria-hidden="true" />
                      {task.actionLabel || t.start}
                    </LinkButton>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => void completeStep(task.taskKey)} disabled={completingKey === task.taskKey}>
                    {completingKey === task.taskKey ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {t.markComplete}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.businessReadiness}</CardTitle>
            <CardDescription>{dashboard.readinessScore.percent}%</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.readinessScore.dimensions.map((dimension) => (
              <div key={dimension.key} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{dimension.label}</span>
                  <span>{dimension.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${dimension.percent}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.inoti}</CardTitle>
            <CardDescription>{t.integrations}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.inotiReadiness.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noInoti}</p>
            ) : dashboard.inotiReadiness.map((item) => (
              <div key={item.service} className="flex items-start gap-2 rounded-lg border p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{item.service}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{item.reason}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" id="growth">
        <Card>
          <CardHeader>
            <CardTitle>{t.growth}</CardTitle>
            <CardDescription>{t.capabilities}: {dashboard.enabledCapabilities.join(", ")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.growthRecommendations.seo.map((item) => (
              <div key={item.key} className="rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  <p className="text-sm font-medium">{item.title}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.allTasks}</CardTitle>
            <CardDescription>{t.completedTasks}: {dashboard.guidedSetup.completedTasks.length}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {dashboard.guidedSetup.tasks.map((task) => (
              <div key={task.taskKey} className="flex min-w-0 items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-5">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.category} · {task.status}</p>
                </div>
                {task.targetRoute ? (
                  <Link href={dashboardHref(locale, task.targetRoute)} className="shrink-0 text-primary" aria-label={task.actionLabel || t.view}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function dashboardHref(locale: SupportedLocale, route: string) {
  if (route.startsWith(`/${locale}/`)) return route;
  if (route.startsWith("/dashboard")) return `/${locale}${route}`;
  return route;
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-input bg-background px-2.5 text-[0.8rem] font-medium",
        "hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {children}
    </Link>
  );
}
