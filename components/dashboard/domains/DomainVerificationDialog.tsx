"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  domainId: string;
  domain: string;
  organizationId: string;
  organizationName: string;
  providerVerified: boolean;
  dnsConfigured: boolean;
  sslReady: boolean;
  verifiedAt: string | null;
};

export function DomainVerificationDialog({ domainId, domain, organizationId, organizationName, providerVerified, dnsConfigured, sslReady, verifiedAt }: Props) {
  const [open, setOpen] = useState(false);
  const [providerRef, setProviderRef] = useState("");
  const [dnsRef, setDnsRef] = useState("");
  const [tlsRef, setTlsRef] = useState("");
  const [revoke, setRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/dashboard/organization-domains/${domainId}/verify`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerVerified: !revoke,
          dnsConfigured: !revoke,
          sslReady: !revoke,
          providerEvidenceReference: providerRef,
          dnsEvidenceReference: dnsRef,
          tlsEvidenceReference: tlsRef,
          revoke,
        }),
      });
      if (!res.ok) throw new Error("FAILED");
      setSuccess(revoke ? "لغو ثبت شد." : "تأیید ثبت شد.");
      setOpen(false);
    } catch {
      setError("ثبت انجام نشد. دوباره تلاش کنید.");
    } finally { setBusy(false); }
  }

  const status = (v: boolean) => v ? "تأیید شده" : "تأیید نشده";
  const partial = [providerVerified, dnsConfigured, sslReady].filter(Boolean).length;
  const overall = partial === 3 ? "تأیید کامل" : partial === 0 ? "تأیید نشده" : "تأیید جزئی";

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-base">تأیید دامنه برای ورود مشتری</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>دامنه: <strong>{domain}</strong></div>
        <div>سازمان: {organizationName} ({organizationId})</div>
        <div>شناسه دامنه: {domainId}</div>
        <div>وضعیت کلی: {overall}</div>
        <div>RunFlare/مالکیت: {status(providerVerified)}</div>
        <div>DNS: {status(dnsConfigured)}</div>
        <div>TLS: {status(sslReady)}</div>
        {verifiedAt && <div>آخرین تأیید: {verifiedAt}</div>}
        {error && <p className="text-destructive">{error}</p>}
        {success && <p className="text-primary">{success}</p>}
        <Button size="sm" onClick={() => setOpen(true)}>تأیید یا لغو دستی</Button>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg space-y-4 rounded-xl bg-background p-6 shadow-xl">
              <h2 className="text-lg font-bold">تأیید دستی دامنه</h2>
              <p className="text-sm text-muted-foreground">این یک تأیید دستی توسط مدیر است، نه بررسی خودکار. شناسهٔ شواهد را وارد کنید.</p>
              <div className="space-y-2">
                <Label htmlFor="prov">شناسهٔ شواهد RunFlare/مالکیت</Label>
                <Input id="prov" value={providerRef} onChange={(e) => setProviderRef(e.target.value)} minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dns">شناسهٔ شواهد DNS</Label>
                <Input id="dns" value={dnsRef} onChange={(e) => setDnsRef(e.target.value)} minLength={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tls">شناسهٔ شواهد TLS</Label>
                <Input id="tls" value={tlsRef} onChange={(e) => setTlsRef(e.target.value)} minLength={8} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} /> لغو تأیید</label>
              <div className="flex gap-2">
                <Button onClick={() => void submit()} disabled={busy}>{busy ? "در حال ثبت…" : "ثبت"}</Button>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>انصراف</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
