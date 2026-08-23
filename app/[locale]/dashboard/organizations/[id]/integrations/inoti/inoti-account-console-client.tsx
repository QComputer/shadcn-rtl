"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Loader2, PlugZap, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
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

const serviceKeys: InotiServiceKey[] = ["iMenu", "iAM", "iCV", "EBC", "USSD", "SMS"];

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
    publicIntegrationId: "شناسه عمومی اتصال",
    callbackUrl: "مسیر وب‌سرویس USSD",
    copyCallbackUrl: "کپی مسیر وب‌سرویس",
    idEnvironment: "محیط شناسه",
    localId: "LOCAL",
    providerRegistration: "ثبت در پنل ارائه‌دهنده",
    providerRegistrationStatus: "NOT CONFIRMED",
    readinessOnly: "بررسی‌ها فقط خواندنی/ایمن است؛ ارسال پیامک و پرداخت واقعی غیرفعال است و رمز مستقیم ذخیره نمی‌شود.",
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
    publicIntegrationId: "Public Integration ID",
    callbackUrl: "USSD Web Service URL",
    copyCallbackUrl: "Copy callback URL",
    idEnvironment: "ID environment",
    localId: "LOCAL",
    providerRegistration: "Provider-side callback registration",
    providerRegistrationStatus: "NOT CONFIRMED",
    readinessOnly: "Verification is read-only/safe; real SMS and real payments are disabled and raw secrets are never stored.",
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
    publicIntegrationId: "معرف الاتصال العام",
    callbackUrl: "رابط خدمة USSD",
    copyCallbackUrl: "نسخ رابط الخدمة",
    idEnvironment: "بيئة المعرّف",
    localId: "LOCAL",
    providerRegistration: "تسجيل الرابط لدى المزود",
    providerRegistrationStatus: "NOT CONFIRMED",
    readinessOnly: "التحقق قراءة فقط وآمن؛ إرسال SMS والدفع الحقيقي معطلان ولا يتم تخزين الأسرار مباشرة.",
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
  const [copied, setCopied] = useState<string | null>(null);
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

  async function copyCallbackUrl(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
    window.setTimeout(() => setCopied((current) => current === value ? null : current), 1800);
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
            {model?.organization.isPlatformOwner && <Badge variant="secondary">PLATFORM OWNER</Badge>}
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
                  <p>Credentials: {service.credentialState}</p>
                  <p>Username/password: {service.credentialState === "CREDENTIALS_AVAILABLE" ? "configured" : "missing"}</p>
                  <p>Read-only: {service.readOnlyVerification}</p>
                  {service.key === "USSD" && <p>USSD CodeName: {service.ussdCodeNameConfigured ? "configured" : "missing"}</p>}
                  {service.key === "USSD" && <p>USSD dial code: {service.ussdDialStringConfigured ? "configured" : "not configured"}</p>}
                  {service.key === "USSD" && service.publicIntegrationId && (
                    <div className="space-y-1 rounded-md bg-muted/50 p-2 text-foreground">
                      <p className="break-all text-xs"><span className="font-medium">{t.publicIntegrationId}:</span> {service.publicIntegrationId}</p>
                      <p className="text-xs"><span className="font-medium">{t.idEnvironment}:</span> {t.localId}</p>
                      <p className="break-all text-xs"><span className="font-medium">{t.callbackUrl}:</span> {service.callbackUrl}</p>
                      <p className="text-xs"><span className="font-medium">{t.providerRegistration}:</span> {t.providerRegistrationStatus}</p>
                    </div>
                  )}
                  {service.key === "SMS" && <p>SMS token: {service.smsTokenConfigured ? "configured" : "missing"}</p>}
                  <p>Health: {service.healthStatus}</p>
                  <p>Real execution: {service.realExecution}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {service.key === "USSD" && service.callbackUrl && (
                    <Button size="sm" variant="outline" onClick={() => void copyCallbackUrl(service.callbackUrl!)} title={t.copyCallbackUrl}>
                      {copied === service.callbackUrl ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {t.copyCallbackUrl}
                    </Button>
                  )}
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
          <CardDescription>{model?.safeMetadata.serviceDiscoveryMode} · Real SMS: {String(model?.safeMetadata.realSmsEnabled)} · Real payments: {String(model?.safeMetadata.realPaymentsEnabled)}</CardDescription>
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
