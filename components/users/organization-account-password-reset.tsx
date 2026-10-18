"use client";

import { useState } from "react";
import { appFetch } from "@/lib/app-base-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OrganizationAccountPasswordReset({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password.length < 6 || password !== confirm) {
      setMessage("رمز عبور باید حداقل ۶ نویسه باشد و دو ورودی یکسان باشند.");
      return;
    }
    setBusy(true);
    try {
      const response = await appFetch(`/api/organizations/${encodeURIComponent(organizationId)}/users/${encodeURIComponent(userId)}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "بازنشانی رمز عبور انجام نشد");
      setPassword("");
      setConfirm("");
      setMessage("رمز عبور با موفقیت تغییر کرد.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "بازنشانی رمز عبور انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return <form className="mt-4 space-y-2 border-t pt-4" onSubmit={submit}>
    <p className="text-sm font-medium">تغییر رمز حساب سازمانی</p>
    <Input aria-label="رمز عبور جدید" type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} dir="ltr" />
    <Input aria-label="تکرار رمز عبور جدید" type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} dir="ltr" />
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    <Button type="submit" variant="outline" disabled={busy}>{busy ? "در حال ذخیره..." : "ثبت رمز جدید"}</Button>
  </form>;
}
