"use client";
import { appFetch } from "@/lib/app-base-path";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Locale = "fa" | "en" | "ar";

type ValidationCheck = {
  code: string;
  ok: boolean;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
};

type AuditEvent = {
  id: string;
  action: string;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

type Plan = {
  id: string;
  status: string;
  proposedOrganizationType: "SHOP" | "APPOINTMENT";
  proposedName: string;
  proposedSlug: string;
  proposedDefaultLocale: string;
  proposedTimezone: string;
  proposedCurrency: string | null;
  proposedOwnerName: string | null;
  proposedOwnerPhoneMasked: string | null;
  proposedOwnerEmail: string | null;
  proposedPackageId: string | null;
  proposedModules: unknown;
  proposedFeatureFlags: unknown;
  proposedSettings: unknown;
  proposedDemoContent: boolean;
  proposedCustomDomain: string | null;
  validationResult: { checks?: ValidationCheck[] } | null;
  auditEvents?: AuditEvent[];
  requestDemoLead: {
    id: string;
    status: string;
    fullName: string;
    businessName: string;
    businessType: string;
    phoneMasked: string;
    city: string | null;
    needSummary: string | null;
    consentAccepted: boolean;
  } | null;
};

function modulesToText(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").join(", ") : "";
}

export function TenantProvisioningPlanEditor({ locale, planId }: { locale: Locale; planId: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    proposedOrganizationType: "SHOP" as "SHOP" | "APPOINTMENT",
    proposedName: "",
    proposedSlug: "",
    proposedDefaultLocale: "fa",
    proposedTimezone: "Asia/Tehran",
    proposedCurrency: "IRR",
    proposedOwnerName: "",
    proposedOwnerEmail: "",
    proposedPackageId: "",
    proposedModules: "",
    proposedCustomDomain: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await appFetch(`/api/dashboard/tenant-provisioning-plans/${planId}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "بارگذاری طرح ناموفق بود");
      setPlan(data);
      setForm({
        proposedOrganizationType: data.proposedOrganizationType,
        proposedName: data.proposedName,
        proposedSlug: data.proposedSlug,
        proposedDefaultLocale: data.proposedDefaultLocale,
        proposedTimezone: data.proposedTimezone,
        proposedCurrency: data.proposedCurrency || "IRR",
        proposedOwnerName: data.proposedOwnerName || "",
        proposedOwnerEmail: data.proposedOwnerEmail || "",
        proposedPackageId: data.proposedPackageId || "",
        proposedModules: modulesToText(data.proposedModules),
        proposedCustomDomain: data.proposedCustomDomain || "",
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "خطا در بارگذاری");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  async function request(path: string, init?: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const response = await appFetch(path, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "اقدام انجام نشد");
      setPlan(data);
      return data;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "خطا در انجام اقدام");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const data = await request(`/api/dashboard/tenant-provisioning-plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        proposedPackageId: form.proposedPackageId || null,
        proposedCurrency: form.proposedCurrency || null,
        proposedOwnerEmail: form.proposedOwnerEmail || null,
        proposedModules: form.proposedModules.split(",").map((item) => item.trim()).filter(Boolean),
        proposedCustomDomain: form.proposedCustomDomain || null,
      }),
    });
    if (data) await load();
  }

  const checks = plan?.validationResult?.checks || [];

  return (
    <main className="space-y-6" dir={locale === "en" ? "ltr" : "rtl"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/${locale}/dashboard/tenant-provisioning`} className="text-sm text-muted-foreground hover:text-foreground">
            بازگشت به طرح‌ها
          </Link>
          <h1 className="mt-2 text-2xl font-black">آماده‌سازی ایجاد کسب‌وکار</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            این مرحله فقط اطلاعات و پیش‌نیازهای ایجاد فضای کسب‌وکار را بررسی می‌کند و هنوز هیچ سازمان، حساب کاربری یا اشتراکی ایجاد نشده است.
          </p>
        </div>
        {plan && <Badge variant={plan.status === "READY" ? "default" : plan.status === "APPROVED" ? "secondary" : "outline"}>{plan.status}</Badge>}
      </div>

      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="rounded-lg border p-4 text-sm text-muted-foreground">در حال بارگذاری...</div>}

      {plan && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>پیشنهاد سازمان</CardTitle>
                <CardDescription>ویرایش این بخش اعتبارسنجی قبلی را باطل می‌کند و tenant واقعی نمی‌سازد.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>نام کسب‌وکار</Label>
                  <Input value={form.proposedName} onChange={(event) => setForm({ ...form, proposedName: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>اسلاگ</Label>
                  <Input dir="ltr" value={form.proposedSlug} onChange={(event) => setForm({ ...form, proposedSlug: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>نوع سازمان</Label>
                  <Select value={form.proposedOrganizationType} onValueChange={(value: "SHOP" | "APPOINTMENT") => setForm({ ...form, proposedOrganizationType: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHOP">SHOP</SelectItem>
                      <SelectItem value="APPOINTMENT">APPOINTMENT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>زبان پیش‌فرض</Label>
                  <Select value={form.proposedDefaultLocale} onValueChange={(value) => setForm({ ...form, proposedDefaultLocale: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fa">fa</SelectItem>
                      <SelectItem value="en">en</SelectItem>
                      <SelectItem value="ar">ar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input dir="ltr" value={form.proposedTimezone} onChange={(event) => setForm({ ...form, proposedTimezone: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Package intent</Label>
                  <Select value={form.proposedPackageId || "none"} onValueChange={(value) => setForm({ ...form, proposedPackageId: value === "none" ? "" : value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون انتخاب</SelectItem>
                      <SelectItem value="starter">starter</SelectItem>
                      <SelectItem value="growth">growth</SelectItem>
                      <SelectItem value="pro">pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>ماژول‌ها</Label>
                  <Textarea value={form.proposedModules} onChange={(event) => setForm({ ...form, proposedModules: event.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مالک پیشنهادی و دامنه</CardTitle>
                <CardDescription>شماره تماس در خروجی عمومی ماسک می‌شود. دامنه فقط intent است و هیچ provider mutation انجام نمی‌شود.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>نام مالک</Label>
                  <Input value={form.proposedOwnerName} onChange={(event) => setForm({ ...form, proposedOwnerName: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>ایمیل مالک</Label>
                  <Input dir="ltr" value={form.proposedOwnerEmail} onChange={(event) => setForm({ ...form, proposedOwnerEmail: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>تلفن ذخیره‌شده</Label>
                  <Input value={plan.proposedOwnerPhoneMasked || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>دامنه پیشنهادی</Label>
                  <Input dir="ltr" value={form.proposedCustomDomain} onChange={(event) => setForm({ ...form, proposedCustomDomain: event.target.value })} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>چک‌لیست اعتبارسنجی</CardTitle>
                <CardDescription>Dry run فقط metadata طرح و audit را به‌روزرسانی می‌کند و هیچ tenant resource نمی‌سازد.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {checks.map((check) => (
                  <div key={check.code} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div>
                      <div className="font-mono text-xs">{check.code}</div>
                      <div className="mt-1 text-muted-foreground">{check.message}</div>
                    </div>
                    <Badge variant={check.ok ? "default" : check.severity === "WARNING" ? "secondary" : "destructive"}>
                      {check.ok ? "OK" : check.severity}
                    </Badge>
                  </div>
                ))}
                {checks.length === 0 && <p className="text-sm text-muted-foreground">هنوز dry run اجرا نشده است.</p>}
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>درخواست منبع</CardTitle>
                <CardDescription>منبع immutable است و با ویرایش طرح تغییر نمی‌کند.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>کسب‌وکار: {plan.requestDemoLead?.businessName || "-"}</div>
                <div>تماس: {plan.requestDemoLead?.fullName || "-"} / {plan.requestDemoLead?.phoneMasked || "-"}</div>
                <div>نوع اولیه: {plan.requestDemoLead?.businessType || "-"}</div>
                <div>وضعیت lead: {plan.requestDemoLead?.status || "-"}</div>
                <div className="rounded-lg bg-muted p-3 leading-7">{plan.requestDemoLead?.needSummary || "خلاصه‌ای ثبت نشده است."}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>اقدام‌ها</CardTitle>
                <CardDescription>تأیید فقط برای فاز اجرای بعدی است و اجرا انجام نمی‌دهد.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button onClick={saveDraft} disabled={busy}>ذخیره پیش‌نویس</Button>
                <Button variant="outline" onClick={() => request(`/api/dashboard/tenant-provisioning-plans/${planId}/validate`, { method: "POST" }).then(load)} disabled={busy}>اجرای dry run</Button>
                <Button variant="outline" onClick={() => request(`/api/dashboard/tenant-provisioning-plans/${planId}/mark-ready`, { method: "POST" }).then(load)} disabled={busy || plan.status !== "READY"}>ثبت READY</Button>
                <Button variant="outline" onClick={() => request(`/api/dashboard/tenant-provisioning-plans/${planId}/approve`, { method: "POST" }).then(load)} disabled={busy || plan.status !== "READY"}>تأیید بدون اجرا</Button>
                <Button variant="outline" onClick={() => request(`/api/dashboard/tenant-provisioning-plans/${planId}/return-for-review`, { method: "POST" }).then(load)} disabled={busy || !["READY", "APPROVED"].includes(plan.status)}>بازگشت برای بررسی</Button>
                <Button variant="destructive" onClick={() => request(`/api/dashboard/tenant-provisioning-plans/${planId}/cancel`, { method: "POST" }).then(load)} disabled={busy || !["DRAFT", "NEEDS_REVIEW", "READY"].includes(plan.status)}>لغو طرح</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>تاریخچه audit</CardTitle>
                <CardDescription>رویدادهای ثبت‌شده برای این طرح، فقط برای بازبینی مدیریتی نمایش داده می‌شود.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {(plan.auditEvents || []).map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline">{event.action}</Badge>
                      <span className="text-xs text-muted-foreground" dir="ltr">
                        {new Date(event.createdAt).toLocaleString("fa-IR")}
                      </span>
                    </div>
                    <div className="mt-2 text-muted-foreground">{event.description || "-"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{event.user?.name || event.user?.email || "system"}</div>
                  </div>
                ))}
                {(plan.auditEvents || []).length === 0 && <p className="text-sm text-muted-foreground">هنوز رویداد audit برای این طرح ثبت نشده است.</p>}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </main>
  );
}
