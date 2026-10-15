"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { appPath } from "@/lib/app-base-path";

const copy = {
  fa: { title: "فعال‌سازی دسترسی سازمان", intro: "با همان حساب دعوت‌شده و ایمیل تأییدشده وارد شوید. کد دعوت را فقط از مسیر امن مورد تأیید دریافت کنید.", token: "کد دعوت", submit: "فعال‌سازی دسترسی", pending: "در حال بررسی…", success: "دسترسی سازمان فعال شد. برای بارگذاری دسترسی جدید، خارج شوید و دوباره وارد شوید.", again: "خروج و ورود دوباره", error: "دعوت قابل فعال‌سازی نیست. هویت حساب، اعتبار کد و دسترسی سازمان را با مسئول دعوت بررسی کنید.", network: "ارتباط برقرار نشد. دوباره تلاش کنید." },
  en: { title: "Activate organization access", intro: "Sign in with the invited account and its verified email. Receive the invitation code through an approved secure channel.", token: "Invitation code", submit: "Activate access", pending: "Checking…", success: "Organization access activated. Sign out and sign in again to load your new access.", again: "Sign out and sign in again", error: "This invitation cannot be activated. Check your identity, code validity and organization access with the inviter.", network: "Connection failed. Try again." },
  ar: { title: "تفعيل صلاحية المؤسسة", intro: "سجّل الدخول بالحساب المدعو وبريده الإلكتروني المؤكد. استلم رمز الدعوة عبر قناة آمنة معتمدة.", token: "رمز الدعوة", submit: "تفعيل الصلاحية", pending: "جارٍ التحقق…", success: "تم تفعيل صلاحية المؤسسة. سجّل الخروج ثم ادخل مجددًا لتحميل الصلاحيات الجديدة.", again: "الخروج والدخول مجددًا", error: "تعذر تفعيل الدعوة. راجع هوية الحساب وصلاحية الرمز والمؤسسة مع المُرسِل.", network: "تعذر الاتصال. حاول مجددًا." },
} as const;

export function InvitationActivation({ locale }: { locale: "fa" | "en" | "ar" }) {
  const text = copy[locale];
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"IDLE" | "PENDING" | "SUCCESS" | "ERROR">("IDLE");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "PENDING" || status === "SUCCESS") return;
    setStatus("PENDING");
    setMessage("");
    try {
      const response = await fetch(appPath("/api/organization-invitations/redeem"), { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      // Never render server payloads, account IDs, or token material.
      setToken("");
      if (!response.ok) { setStatus("ERROR"); setMessage(text.error); return; }
      setStatus("SUCCESS");
    } catch { setToken(""); setStatus("ERROR"); setMessage(text.network); }
  }
  return <section className="mx-auto w-full max-w-lg space-y-5 rounded-xl border bg-card p-5 sm:p-7" dir={locale === "en" ? "ltr" : "rtl"}>
    <h1 className="text-2xl font-semibold">{text.title}</h1>
    <p className="text-sm text-muted-foreground">{text.intro}</p>
    {status === "SUCCESS" ? <div className="space-y-4" role="status">
      <p>{text.success}</p>
      <button type="button" className="min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={() => void signOut({ callbackUrl: appPath(`/${locale}/login?callbackUrl=${encodeURIComponent(appPath(`/${locale}/dashboard/hotel-website`))}`) })}>{text.again}</button>
    </div> : <form onSubmit={submit} className="space-y-4">
      <label htmlFor="organization-invitation-token" className="block text-sm font-medium">{text.token}</label>
      <input id="organization-invitation-token" type="password" dir="ltr" autoComplete="off" spellCheck={false} autoCapitalize="none" minLength={43} maxLength={43} pattern="[A-Za-z0-9_-]{43}" required value={token} disabled={status === "PENDING"} onChange={(event) => setToken(event.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <button type="submit" disabled={status === "PENDING"} className="min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60">{status === "PENDING" ? text.pending : text.submit}</button>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </form>}
  </section>;
}
