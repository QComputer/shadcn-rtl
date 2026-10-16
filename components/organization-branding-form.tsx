"use client";

import { useEffect, useState } from "react";
import { appFetch } from "@/lib/app-base-path";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BrandingField =
  | "displayName"
  | "shortName"
  | "logoUrl"
  | "faviconUrl"
  | "appleTouchIconUrl"
  | "pwaIcon192Url"
  | "pwaIcon512Url"
  | "pwaMaskable192Url"
  | "pwaMaskable512Url"
  | "ogImageUrl"
  | "themeColor"
  | "backgroundColor";

type BrandingValues = Record<BrandingField, string>;

const fields: ReadonlyArray<{ name: BrandingField; label: string; kind?: "color" }> = [
  { name: "displayName", label: "نام نمایشی عمومی" },
  { name: "shortName", label: "نام کوتاه برنامه" },
  { name: "logoUrl", label: "نشانی لوگو" },
  { name: "faviconUrl", label: "نشانی آیکن مرورگر" },
  { name: "appleTouchIconUrl", label: "نشانی آیکن دستگاه‌های اپل" },
  { name: "pwaIcon192Url", label: "نشانی آیکن برنامه، ۱۹۲ پیکسل" },
  { name: "pwaIcon512Url", label: "نشانی آیکن برنامه، ۵۱۲ پیکسل" },
  { name: "pwaMaskable192Url", label: "نشانی آیکن تطبیق‌پذیر، ۱۹۲ پیکسل" },
  { name: "pwaMaskable512Url", label: "نشانی آیکن تطبیق‌پذیر، ۵۱۲ پیکسل" },
  { name: "ogImageUrl", label: "نشانی تصویر اشتراک‌گذاری" },
  { name: "themeColor", label: "رنگ پوسته", kind: "color" },
  { name: "backgroundColor", label: "رنگ پس‌زمینه", kind: "color" },
];

const emptyValues = (): BrandingValues => Object.fromEntries(fields.map(({ name }) => [name, ""])) as BrandingValues;

export function OrganizationBrandingForm({ organizationId }: { organizationId: string }) {
  const [values, setValues] = useState<BrandingValues>(emptyValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    appFetch(`/api/organizations/${encodeURIComponent(organizationId)}/branding`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 403) {
          setForbidden(true);
          return null;
        }
        if (!response.ok) throw new Error("بارگذاری هویت بصری سازمان ناموفق بود");
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        setValues(Object.fromEntries(fields.map(({ name }) => [name, typeof data[name] === "string" ? data[name] : ""])) as BrandingValues);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "بارگذاری هویت بصری سازمان ناموفق بود");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [organizationId]);

  function update(name: BrandingField, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const payload = Object.fromEntries(fields.map(({ name }) => [name, values[name].trim() || null]));
      const response = await appFetch(`/api/organizations/${encodeURIComponent(organizationId)}/branding`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      if (!response.ok) throw new Error(data.error || "ذخیره هویت بصری سازمان ناموفق بود");
      setValues(Object.fromEntries(fields.map(({ name }) => [name, typeof data[name] === "string" ? data[name] : ""])) as BrandingValues);
      setMessage("هویت بصری سازمان ذخیره شد");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ذخیره هویت بصری سازمان ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>هویت بصری سازمان</CardTitle>
        <CardDescription>مسیر فایل در همین سایت یا نشانی امن HTTPS را وارد کنید. برای نصب برنامه، از آیکن‌های تأییدشده همین سازمان استفاده کنید.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <p role="status" className="text-sm text-muted-foreground">در حال بارگذاری…</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(({ name, label, kind }) => (
              <div className="space-y-2" key={name}>
                <Label htmlFor={`organization-branding-${name}`}>{label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`organization-branding-${name}`}
                    type="text"
                    dir={kind || name.endsWith("Url") ? "ltr" : "auto"}
                    value={values[name]}
                    onChange={(event) => update(name, event.target.value)}
                    disabled={saving}
                    placeholder={kind ? "#RRGGBB" : undefined}
                  />
                  {kind && <Button type="button" variant="outline" onClick={() => update(name, "")} disabled={saving}>پاک کردن</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={loading || saving || forbidden}>
            {saving ? "در حال ذخیره…" : "ذخیره هویت بصری"}
          </Button>
          {message && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
