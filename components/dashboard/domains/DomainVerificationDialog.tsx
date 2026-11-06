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
  const [mode, setMode] = useState<"approve" | "revoke">("approve");
  const [confirming, setConfirming] = useState(false);
  const [providerRef, setProviderRef] = useState("");
  const [dnsRef, setDnsRef] = useState("");
  const [tlsRef, setTlsRef] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refValid = (v: string) => v.trim().length >= 8 && v.trim().length <= 500;
  const refsValid = refValid(providerRef) && refValid(dnsRef) && refValid(tlsRef);
  const revokeReasonValid = revokeReason.trim().length >= 8 && revokeReason.trim().length <= 500;

  function openApprove() { setMode("approve"); setConfirming(false); setError(""); setSuccess(""); setOpen(true); }
  function openRevoke() { setMode("revoke"); setConfirming(false); setError(""); setSuccess(""); setOpen(true); }

  async function submit() {
    if (mode === "approve" && !refsValid) { setError("شناسهٔ شواهد باید بین ۸ تا ۵۰۰ کاراکتر باشد."); return; }
    if (mode === "revoke" && !revokeReasonValid) { setError("دلیل لغو باید بین ۸ تا ۵۰۰ کاراکتر باشد."); return; }
    if (!confirming) { setConfirming(true); return; }
    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await appFetch(`/api/dashboard/organization-domains/${domainId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerVerified: mode === "approve",
          dnsConfigured: mode === "approve",
          sslReady: mode === "approve",
          providerEvidenceReference: mode === "approve" ? providerRef.trim() : revokeReason.trim(),
          dnsEvidenceReference: mode === "approve" ? dnsRef.trim() : revokeReason.trim(),
          tlsEvidenceReference: mode === "approve" ? tlsRef.trim() : revokeReason.trim(),
          revoke: mode === "revoke",
          revocationReason: mode === "revoke" ? revokeReason.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error("FAILED");
      setSuccess(mode === "revoke" ? "لغو ثبت شد." : "تأیید ثبت شد.");
      setOpen(false);
      setConfirming(false);
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
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={openApprove} disabled={!isActive}>
          تأیید
        </Button>
        <Button size="sm" variant="destructive" onClick={openRevoke}>
          لغو
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) setConfirming(false); } }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{mode === "revoke" ? "لغو تأیید دامنه" : "تأیید دستی دامنه"}</DialogTitle>
            <DialogDescription>
              {mode === "revoke"
                ? "این یک لغو تأیید دستی توسط مدیر است. لغو باعث غیرمجاز شدن دامنه برای ورود مشتری می‌شود."
                : "این یک تأیید دستی توسط مدیر است، نه بررسی خودکار. شناسهٔ شواهد را وارد کنید."}
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
            {mode === "approve" ? (
              <>
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
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="reason">دلیل لغو</Label>
                <Input id="reason" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} minLength={8} maxLength={500} />
              </div>
            )}
            {confirming && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                تأیید نهایی: {mode === "revoke" ? "لغو تأیید" : "تأیید"} دامنهٔ <strong>{domain}</strong> برای سازمان <strong>{organizationName}</strong>. ادامه می‌دهید؟
              </div>
            )}
            {error && <p className="text-destructive">{error}</p>}
            {success && <p className="text-primary">{success}</p>}
          </div>
          <DialogFooter>
            <Button onClick={() => void submit()} disabled={busy || (mode === "approve" ? !refsValid : !revokeReasonValid)}>{busy ? "در حال ثبت…" : confirming ? "تأیید نهایی" : "ثبت"}</Button>
            <Button variant="outline" onClick={() => { setOpen(false); setConfirming(false); }} disabled={busy}>انصراف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
