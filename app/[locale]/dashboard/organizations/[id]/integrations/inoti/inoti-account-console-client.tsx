"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, PlugZap, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupportedLocale } from "@/lib/i18n";
import type { InotiAccountReadModel, InotiServiceKey } from "@/lib/integrations/inoti-account-management";

type ResponseBody = { inoti: InotiAccountReadModel };

const serviceKeys: InotiServiceKey[] = ["iMenu", "iAM", "iCV", "EBC", "USSD"];

const copy = {
  fa: {
    title: "مدیریت iNoti",
    subtitle: "اتصال حساب موجود iNoti، شناسایی سرویس‌ها و آماده‌سازی نگاشت قابلیت‌ها.",
    back: "بازگشت به سازمان‌ها",
    status: "وضعیت",
    draft: "ساخت پیش‌نویس اتصال",
    connect: "ذخیره اتصال",
    health: "بررسی سلامت",
    disable: "غیرفعال",
    account: "حساب iNoti",
    services: "سرویس‌های شناسایی‌شده",
    mappings: "نگاشت به بازارباز",
    activation: "اثر روی فعال‌سازی",
    credentialProfileKey: "کلید پروفایل محرمانه",
    externalAccountId: "شناسه حساب خارجی",
    accountLabel: "نام نمایشی حساب",
    readinessOnly: "همه عملیات dry-run است؛ هیچ تماس خارجی انجام نمی‌شود و رمز مستقیم ذخیره نمی‌شود.",
  },
  en: {
    title: "iNoti management",
    subtitle: "Connect an existing iNoti account, discover services, and prepare capability mappings.",
    back: "Back to organizations",
    status: "Status",
    draft: "Create draft",
    connect: "Save connection",
    health: "Check health",
    disable: "Disable",
    account: "iNoti account",
    services: "Detected services",
    mappings: "BazarBaaz mapping",
    activation: "Activation impact",
    credentialProfileKey: "Secret profile key",
    externalAccountId: "External account ID",
    accountLabel: "Account label",
    readinessOnly: "All operations are dry-run; no external provider call is made and no raw secret is stored.",
  },
  ar: {
    title: "إدارة iNoti",
    subtitle: "ربط حساب iNoti موجود واكتشاف الخدمات وتحضير ربط القدرات.",
    back: "العودة إلى المؤسسات",
    status: "الحالة",
    draft: "إنشاء مسودة",
    connect: "حفظ الاتصال",
    health: "فحص الصحة",
    disable: "تعطيل",
    account: "حساب iNoti",
    services: "الخدمات المكتشفة",
    mappings: "الربط مع بازارباز",
    activation: "أثر التفعيل",
    credentialProfileKey: "مفتاح ملف الأسرار",
    externalAccountId: "معرف الحساب الخارجي",
    accountLabel: "اسم الحساب",
    readinessOnly: "كل العمليات dry-run ولا يتم أي اتصال خارجي أو تخزين أسرار مباشرة.",
  },
} satisfies Record<SupportedLocale, Record<string, string>>;

export function InotiAccountConsoleClient({
  locale,
  organizationId,
}: {
  locale: SupportedLocale;
  organizationId: string;
}) {
  const t = copy[locale] ?? copy.fa;
  const isRtl = locale === "fa" || locale === "ar";
  const [model, setModel] = useState<InotiAccountReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<InotiServiceKey[]>(["iMenu", "iAM", "iCV", "EBC", "USSD"]);
  const [form, setForm] = useState({
    credentialProfileKey: "INOTI_DEFAULT",
    externalAccountId: "",
    accountLabel: "",
  });

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/platform/inoti/organizations/${organizationId}`, { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as ResponseBody;
      setModel(data.inoti);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [organizationId]);

  async function submit(action: "draft" | "connect") {
    setBusy(action);
    const response = await fetch(`/api/platform/inoti/organizations/${organizationId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, services: selected, ...form }),
    });
    if (response.ok) {
      const data = (await response.json()) as ResponseBody;
      setModel(data.inoti);
    }
    setBusy(null);
  }

  async function health(serviceKey?: string) {
    setBusy(`health-${serviceKey ?? "all"}`);
    const response = await fetch(`/api/platform/inoti/organizations/${organizationId}/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceKey }),
    });
    if (response.ok) {
      const data = (await response.json()) as ResponseBody;
      setModel(data.inoti);
    }
    setBusy(null);
  }

  async function disable(serviceKey: string) {
    setBusy(`disable-${serviceKey}`);
    const response = await fetch(`/api/platform/inoti/organizations/${organizationId}/services/${serviceKey}`, { method: "DELETE" });
    if (response.ok) {
      const data = (await response.json()) as ResponseBody;
      setModel(data.inoti);
    }
    setBusy(null);
  }

  function toggle(serviceKey: InotiServiceKey, checked: boolean) {
    setSelected((current) => checked ? Array.from(new Set([...current, serviceKey])) : current.filter((item) => item !== serviceKey));
  }

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6" dir={isRtl ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Link href={`/${locale}/dashboard/organizations`} className="text-sm text-muted-foreground hover:text-foreground">{t.back}</Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">SUPER_ADMIN</Badge>
            <Badge variant="outline">{model?.account.status ?? "NOT_CONNECTED"}</Badge>
          </div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{model?.organization.name} · {t.subtitle}</p>
        </div>
        <Button variant="outline" onClick={() => void health()} disabled={busy === "health-all"}>
          {busy === "health-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t.health}
        </Button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t.account}</CardTitle>
            <CardDescription>{t.readinessOnly}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t.credentialProfileKey}>
              <Input value={form.credentialProfileKey} onChange={(event) => setForm((current) => ({ ...current, credentialProfileKey: event.target.value }))} />
            </Field>
            <Field label={t.externalAccountId}>
              <Input value={form.externalAccountId} onChange={(event) => setForm((current) => ({ ...current, externalAccountId: event.target.value }))} />
            </Field>
            <Field label={t.accountLabel}>
              <Input value={form.accountLabel} onChange={(event) => setForm((current) => ({ ...current, accountLabel: event.target.value }))} />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              {serviceKeys.map((serviceKey) => (
                <label key={serviceKey} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <Checkbox checked={selected.includes(serviceKey)} onCheckedChange={(checked) => toggle(serviceKey, checked === true)} />
                  {serviceKey}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void submit("draft")} disabled={busy === "draft"}>
                {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {t.draft}
              </Button>
              <Button onClick={() => void submit("connect")} disabled={busy === "connect"}>
                {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {t.connect}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.services}</CardTitle>
            <CardDescription>{t.status}: {model?.account.status}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {model?.services.map((service) => (
              <div key={service.key} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{service.label}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{service.description}</p>
                  </div>
                  <Badge variant={service.status === "ACTIVE" ? "default" : "outline"}>{service.status}</Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>{t.mappings}: {service.featureMappings.join(", ")}</p>
                  <p>{service.growthFeatureMappings.join(", ")}</p>
                  <p>{service.capabilityAvailable ? "Capability ready" : "Capability not enabled"}</p>
                  <p>Health: {service.healthStatus}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void health(service.key)} disabled={!service.integrationId || busy === `health-${service.key}`}>
                    {busy === `health-${service.key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {t.health}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void disable(service.key)} disabled={!service.integrationId || busy === `disable-${service.key}`}>
                    {busy === `disable-${service.key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    {t.disable}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t.activation}</CardTitle>
          <CardDescription>{model?.safeMetadata.serviceDiscoveryMode} · External calls: {String(model?.safeMetadata.externalProviderCalls)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {model?.activationImpact.length ? model.activationImpact.map((task) => (
            <div key={task.taskKey} className="flex items-start gap-2 rounded-lg border p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.readinessStatus} · Waiting: {String(task.waitingForInotiConnection)}</p>
              </div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No integration activation tasks generated yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
