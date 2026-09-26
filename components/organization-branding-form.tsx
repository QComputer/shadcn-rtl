"use client";

import { useEffect, useState } from "react";
import { appFetch } from "@/lib/app-base-path";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const fields = [
  ["applicationName", "Application name"], ["displayName", "Public display name"], ["shortName", "Short name"],
  ["logoUrl", "Logo path / URL"], ["faviconUrl", "Favicon path / URL"], ["appleTouchIconUrl", "Apple touch icon path / URL"],
  ["pwaIcon192Url", "PWA 192 path / URL"], ["pwaIcon512Url", "PWA 512 path / URL"], ["pwaMaskable192Url", "Maskable 192 path / URL"], ["pwaMaskable512Url", "Maskable 512 path / URL"],
  ["ogImageUrl", "OG image path / URL"], ["themeColor", "Theme color"], ["backgroundColor", "Background color"],
] as const;

export function OrganizationBrandingForm({ organizationId }: { organizationId: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { appFetch(`/api/organizations/${organizationId}/branding`).then((r) => r.ok ? r.json() : null).then((data) => data && setValues(data)); }, [organizationId]);
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  async function save() {
    setSaving(true); setStatus("");
    const response = await appFetch(`/api/organizations/${organizationId}/branding`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setStatus(response.ok ? "Branding saved." : ((await response.json()).error || "Unable to save branding."));
    setSaving(false);
  }
  return <Card>
    <CardHeader><CardTitle>هویت بصری کسب‌وکار</CardTitle><CardDescription>مسیر asset یا URL را تنظیم کنید؛ این فرم uploader نیست و برای هر Organization یکسان است.</CardDescription></CardHeader>
    <CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{fields.map(([key, label]) => <div className="space-y-2" key={key}><Label htmlFor={`branding-${key}`}>{label}</Label><Input id={`branding-${key}`} dir="ltr" value={values[key] || ""} onChange={(event) => set(key, event.target.value)} /></div>)}</div><div className="flex items-center gap-3"><Button type="button" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save branding"}</Button>{status && <span className="text-sm text-muted-foreground">{status}</span>}</div></CardContent>
  </Card>;
}
