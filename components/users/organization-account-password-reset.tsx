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
    if (password.length < 8 || new TextEncoder().encode(password).length > 72 || password !== confirm) {
      setMessage("رمز باید حداقل ۸ نویسه و حداکثر ۷۲ بایت باشد و دو ورودی یکسان باشند.");
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
      setMessage("رمز تغییر کرد؛ تمام نشست‌های قبلی این حساب در همه سازمان‌ها پایان یافتند.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "بازنشانی رمز عبور انجام نشد");
    } finally {
      setBusy(false);
    }
  }

  return <form className="mt-4 space-y-2 border-t pt-4" onSubmit={submit}>
    <p className="text-sm font-medium">تغییر رمز حساب سازمانی</p>
    <p className="text-xs leading-6 text-muted-foreground">این تغییر برای کل حساب است و نشست‌های کاربر در همه سازمان‌ها و دستگاه‌ها را پایان می‌دهد.</p>
    <Input aria-label="رمز عبور جدید" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} dir="ltr" />
    <Input aria-label="تکرار رمز عبور جدید" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={(event) => setConfirm(event.target.value)} dir="ltr" />
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    <Button type="submit" variant="outline" disabled={busy}>{busy ? "در حال ذخیره..." : "ثبت رمز جدید"}</Button>
  </form>;
}
