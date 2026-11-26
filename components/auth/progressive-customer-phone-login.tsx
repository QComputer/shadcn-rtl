"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { appFetch, appPath } from "@/lib/app-base-path";
import { isProgressiveChallengeId, type AccountVerificationPurpose } from "@/lib/customer-auth/progressive-contract";
import { normalizeDigits, normalizeIranianMobile } from "@/lib/integrations/inoti-ussd/parser";

const copy = {
  fa: { title: "ورود یا ثبت‌نام مشتری", existing: "ورود به حساب موجود", newAccount: "ساخت حساب جدید", consent: "می‌خواهم یک حساب مشتری جدید ایجاد کنم.", separate: "ایجاد حساب به معنی عضویت باشگاه یا رضایت پیامک تبلیغاتی نیست و سوابق مهمان را منتقل نمی‌کند.", phone: "شماره تلفن همراه", request: "درخواست کد تأیید", pending: "درخواست ثبت شد. در صورت امکان کد ارسال می‌شود.", otp: "کد چهار رقمی", verify: "تأیید و ادامه", resend: "درخواست دوباره کد", change: "تغییر شماره یا نوع درخواست", fail: "انجام نشد. اطلاعات و کد را بررسی کنید و دوباره تلاش کنید.", unavailable: "این مسیر اکنون در دسترس نیست.", loading: "در حال بررسی…", remaining: "ثانیه تا انقضا", expired: "زمان کد به پایان رسیده است.", wait: "ثانیه تا درخواست مجدد" },
  en: { title: "Customer sign-in or registration", existing: "Sign in to an existing account", newAccount: "Create a new account", consent: "I want to create a new customer account.", separate: "An account does not join the club, opt in to marketing SMS, or transfer guest history.", phone: "Mobile number", request: "Request verification code", pending: "Request received. A code will be sent if available.", otp: "Four-digit code", verify: "Verify and continue", resend: "Request another code", change: "Change number or action", fail: "Could not continue. Check your details and code, then try again.", unavailable: "This option is currently unavailable.", loading: "Checking…", remaining: "seconds until expiry", expired: "The code has expired.", wait: "seconds until another request" },
  ar: { title: "دخول العميل أو التسجيل", existing: "الدخول إلى حساب موجود", newAccount: "إنشاء حساب جديد", consent: "أريد إنشاء حساب عميل جديد.", separate: "إنشاء الحساب لا يعني الانضمام إلى النادي أو قبول الرسائل التسويقية أو نقل سجل الضيف.", phone: "رقم الهاتف المحمول", request: "طلب رمز التحقق", pending: "تم استلام الطلب. سيُرسل الرمز إن أمكن.", otp: "الرمز المكون من أربعة أرقام", verify: "التحقق والمتابعة", resend: "طلب رمز آخر", change: "تغيير الرقم أو الإجراء", fail: "تعذرت المتابعة. تحقق من البيانات والرمز وأعد المحاولة.", unavailable: "هذا الخيار غير متاح الآن.", loading: "جارٍ التحقق…", remaining: "ثانية حتى انتهاء الصلاحية", expired: "انتهت صلاحية الرمز.", wait: "ثانية حتى الطلب التالي" },
};
type Context = { slug: string; name: string; homePath: string | null };
type Flow = { phone: string; purpose: AccountVerificationPurpose; challengeId: string; enrollmentConfirmed: boolean; expiresAt: number; resendAt: number };

export function ProgressiveCustomerPhoneLogin({ locale, organizationHint }: { locale: string; organizationHint?: string }) {
  const language = locale === "en" || locale === "ar" ? locale : "fa";
  const t = copy[language];
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [contextPending, setContextPending] = useState(true);
  const [purpose, setPurpose] = useState<AccountVerificationPurpose | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    const query = organizationHint ? `?organization=${encodeURIComponent(organizationHint)}` : "";
    void (async () => {
      try {
        const response = await appFetch(`/api/auth/customer/config${query}`, { cache: "no-store", signal: controller.signal });
        const body = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setContext(body?.progressiveEnrollment === true && typeof body.organization?.slug === "string" && typeof body.organization?.name === "string"
          ? { slug: body.organization.slug, name: body.organization.name, homePath: typeof body.homePath === "string" ? body.homePath : null } : null);
      } catch { if (!controller.signal.aborted) setContext(null); }
      finally { if (!controller.signal.aborted) setContextPending(false); }
    })();
    return () => controller.abort();
  }, [organizationHint]);
  useEffect(() => {
    if (!flow) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [flow]);
  const expiry = flow ? Math.max(0, Math.ceil((flow.expiresAt - now) / 1000)) : 0;
  const resend = flow ? Math.max(0, Math.ceil((flow.resendAt - now) / 1000)) : 0;

  async function issue() {
    const normalized = normalizeIranianMobile(flow?.phone ?? phone);
    const intent = flow?.purpose ?? purpose;
    const consent = flow?.enrollmentConfirmed ?? confirmed;
    if (lock.current || !context || !normalized || !intent || (intent === "ACCOUNT_ENROLL" && !consent) || (flow && resend > 0)) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const response = await appFetch("/api/auth/customer/progressive/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalized, organization: context.slug, purpose: intent, ...(intent === "ACCOUNT_ENROLL" ? { enrollmentConfirmed: true } : {}) }),
        cache: "no-store",
      });
      const result = response.ok ? await response.json() : null;
      if (response.status !== 202 || result?.accepted !== true || !isProgressiveChallengeId(result.challengeId)) throw new Error("unavailable");
      const timestamp = Date.now();
      setNow(timestamp); setOtp("");
      setFlow({ phone: normalized, purpose: intent, challengeId: result.challengeId, enrollmentConfirmed: intent === "ACCOUNT_ENROLL" && consent, expiresAt: timestamp + 120000, resendAt: timestamp + 60000 });
    } catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || !flow || lock.current || Date.now() >= flow.expiresAt || !/^\d{4}$/.test(otp)) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const result = await signIn("customer-phone", { phone: flow.phone, otp, purpose: flow.purpose, challengeId: flow.challengeId, organization: context.slug,
        ...(flow.purpose === "ACCOUNT_ENROLL" ? { enrollmentConfirmed: "true" } : {}), redirect: false });
      if (!result?.ok || result.error) throw new Error("unavailable");
      const home = context.homePath;
      const target = home && home.startsWith("/") && !home.startsWith("//") && !home.includes("\\") ? home : `/${language}`;
      router.push(appPath(target)); router.refresh();
    } catch { setOtp(""); setError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  function change() { if (!lock.current) { setFlow(null); setOtp(""); setPurpose(null); setConfirmed(false); setError(false); } }
  function select(value: AccountVerificationPurpose) { setPurpose(value); setConfirmed(false); setError(false); }
  return <main className="mx-auto w-full max-w-sm space-y-5 p-4" dir={language === "en" ? "ltr" : "rtl"} data-testid="progressive-customer-login">
    <h1 className="text-center text-2xl font-semibold">{t.title}</h1>
    {context?.name && <p className="text-center text-sm text-muted-foreground">{context.name}</p>}
    {contextPending ? <p role="status">{t.loading}</p> : !context ? <p role="status">{t.unavailable}</p> : !flow ?
      <form onSubmit={event => { event.preventDefault(); void issue(); }} className="space-y-4">
        <fieldset disabled={busy} className="space-y-2">
          <legend className="sr-only">{t.title}</legend>
          <label className="flex items-center gap-2"><input data-testid="progressive-sign-in" type="radio" name="purpose" checked={purpose === "ACCOUNT_SIGN_IN"} onChange={() => select("ACCOUNT_SIGN_IN")} />{t.existing}</label>
          <label className="flex items-center gap-2"><input data-testid="progressive-enroll" type="radio" name="purpose" checked={purpose === "ACCOUNT_ENROLL"} onChange={() => select("ACCOUNT_ENROLL")} />{t.newAccount}</label>
          {purpose === "ACCOUNT_ENROLL" && <><p className="text-sm text-muted-foreground">{t.separate}</p><label className="flex items-start gap-2"><input data-testid="progressive-consent" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{t.consent}</label></>}
          <label htmlFor="progressive-phone" className="block text-sm">{t.phone}</label>
          <input id="progressive-phone" data-testid="progressive-phone" className="w-full rounded-md border px-3 py-2 text-center" type="tel" inputMode="tel" autoComplete="tel" maxLength={64} value={phone} onChange={event => setPhone(event.target.value)} required dir="ltr" />
        </fieldset>
        <button data-testid="progressive-request" type="submit" disabled={busy || !purpose || !normalizeIranianMobile(phone) || (purpose === "ACCOUNT_ENROLL" && !confirmed)} className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50">{t.request}</button>
      </form> : <form onSubmit={verify} className="space-y-4">
        <p role="status" className="text-sm text-muted-foreground">{t.pending}</p>
        <label htmlFor="progressive-otp">{t.otp}</label>
        <input id="progressive-otp" data-testid="progressive-otp" className="w-full rounded-md border px-3 py-2 text-center" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={otp} onChange={event => setOtp(normalizeDigits(event.target.value).replace(/[^0-9]/g, "").slice(0, 4))} disabled={busy || expiry === 0} dir="ltr" />
        <p className="text-sm">{expiry ? `${expiry} ${t.remaining}` : t.expired}</p>
        <button data-testid="progressive-verify" type="submit" disabled={busy || expiry === 0 || otp.length !== 4} className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-50">{t.verify}</button>
        <button type="button" onClick={() => void issue()} disabled={busy || resend > 0} className="w-full text-sm underline disabled:opacity-50">{resend ? `${resend} ${t.wait}` : t.resend}</button>
        <button type="button" disabled={busy} onClick={change} className="w-full text-sm underline">{t.change}</button>
      </form>}
    {error && <p role="alert" className="text-sm text-destructive">{t.fail}</p>}
  </main>;
}
