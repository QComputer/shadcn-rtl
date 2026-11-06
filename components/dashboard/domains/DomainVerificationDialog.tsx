"use client";

import { useState } from "react";
import { appFetch } from "@/lib/app-base-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Props = {
  domainId: string;
  domain: string;
  organizationId: string;
  organizationName: string;
  providerVerified: boolean;
  dnsConfigured: boolean;
  sslReady: boolean;
  verifiedAt: string | null;
  isActive: boolean;
  onSuccess: () => void;
};

export function DomainVerificationDialog({ domainId, domain, organizationId, organizationName, providerVerified, dnsConfigured, sslReady, verifiedAt, isActive, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const [providerRef, setProviderRef] = useState("");
  const [dnsRef, setDnsRef] = useState("");
  const [tlsRef, setTlsRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refValid = (v: string) => v.trim().length >= 8 && v.trim().length <= 500;
  const refsValid = refValid(providerRef) && refValid(dnsRef) && refValid(tlsRef);

  async function submit() {
    if (!refsValid) { setError("شناسهٔ شواهد باید بین ۸ تا ۵۰۰ کاراکتر باشد."); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await appFetch(`/api/dashboard/organization-domains/${domainId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerVerified: !revoke,
          dnsConfigured: !revoke,
          sslReady: !revoke,
          providerEvidenceReference: providerRef.trim(),
          dnsEvidenceReference: dnsRef.trim(),
          tlsEvidenceReference: tlsRef.trim(),
          revoke,
        }),
      });
      if (!res.ok) throw new Error("FAILED");
      setSuccess(revoke ? "لغو ثبت شد." : "تأیید ثبت شد.");
      setOpen(false);
      onSuccess();
    } catch {
      setError("ثبت انجام نشد. دوباره تلاش کنید.");
    } finally { setBusy(false); }
  }

  const status = (v: boolean) => v ? "تأیید شده" : "تأیید نشده";
  const partial = [providerVerified, dnsConfigured, sslReady].filter(Boolean).length;
  const overall = partial === 3 ? "تأیید کامل" : partial === 0 ? "تأیید نشده" : "تأیید جزئی";

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!isActive}>
        تأیید دامنه
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأیید دستی دامنه</DialogTitle>
            <DialogDescription>
              این یک تأیید دستی توسط مدیر است، نه بررسی خودکار. شناسهٔ شواهد را وارد کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>دامنه: <strong>{domain}</strong></div>
            <div>سازمان: {organizationName} ({organizationId})</div>
            <div>شناسه دامنه: {domainId}</div>
            <div>وضعیت کلی: {overall}</div>
            <div>RunFlare/مالکیت: {status(providerVerified)}</div>
            <div>DNS: {status(dnsConfigured)}</div>
            <div>TLS: {status(sslReady)}</div>
            {verifiedAt && <div>آخرین تأیید: {verifiedAt}</div>}
            <div className="space-y-2">
              <Label htmlFor="prov">شناسهٔ شواهد RunFlare/مالکیت</Label>
              <Input id="prov" value={providerRef} onChange={(e) => setProviderRef(e.target.value)} minLength={8} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dns">شناسهٔ شواهد DNS</Label>
              <Input id="dns" value={dnsRef} onChange={(e) => setDnsRef(e.target.value)} minLength={8} maxLength={500} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tls">شناسهٔ شواهد TLS</Label>
              <Input id="tls" value={tlsRef} onChange={(e) => setTlsRef(e.target.value)} minLength={8} maxLength={500} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} /> لغو تأیید</label>
            {error && <p className="text-destructive">{error}</p>}
            {success && <p className="text-primary">{success}</p>}
          </div>
          <DialogFooter>
            <Button onClick={() => void submit()} disabled={busy || !refsValid}>{busy ? "در حال ثبت…" : "ثبت"}</Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>انصراف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
