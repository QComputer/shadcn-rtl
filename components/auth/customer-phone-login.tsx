"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { appPath } from "@/lib/app-base-path";

type Props = {
  organization: { slug: string; name: string; logo: string | null } | null;
  locale: string;
};

export function CustomerPhoneLogin({ organization, locale }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [expiryCountdown, setExpiryCountdown] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (expiryCountdown <= 0) return;
    const timer = setTimeout(() => setExpiryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [expiryCountdown]);

  const orgName = organization?.name ?? "";
  const orgSlug = organization?.slug ?? "";

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/customer/request", {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ phone, organization: orgSlug }),
      });
      if (!res.ok) throw new Error("error");
      setStep("otp");
      setResendCountdown(60);
      setExpiryCountdown(120);
      setOtp(["", "", "", ""]);
      inputs.current[0]?.focus();
    } catch {
      setError("درخواست انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    if (loading) return;
    if (expiryCountdown <= 0) {
      setError("کد تأیید منقضی شده است.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await signIn("customer-phone", { otp: code, phone, organization: orgSlug, redirect: false });
    if (result?.error) {
      setError("کد تأیید نامعتبر است. دوباره تلاش کنید.");
      setOtp(["", "", "", ""]);
      inputs.current[0]?.focus();
    } else {
      router.push(appPath(`/${locale}`));
      router.refresh();
    }
    setLoading(false);
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 3) {
      inputs.current[index + 1]?.focus();
    }
    const code = next.join("");
    if (code.length === 4 && next.every((d) => d) && expiryCountdown > 0) {
      void verifyOtp(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (expiryCountdown <= 0) {
      setError("کد تأیید منقضی شده است.");
      return;
    }
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    const next = paste.split("");
    while (next.length < 4) next.push("");
    setOtp(next);
    if (next.every((d) => d)) {
      void verifyOtp(next.join(""));
    } else {
      const focusIndex = next.findIndex((d) => !d);
      if (focusIndex >= 0) inputs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 p-4" dir="rtl">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">ورود یا ثبت‌نام با شماره تلفن</h1>
        {orgName && <p className="text-muted-foreground text-sm">{orgName}</p>}
      </div>
      {step === "phone" ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="phone">
              شماره تلفن همراه
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="09123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-center"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading || !phone}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {loading ? "..." : "ارسال کد تأیید"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">کد تأیید ۴ رقمی به شماره {phone} ارسال شد.</p>
          <div className="flex justify-center gap-2" dir="ltr" onPaste={handlePaste}>
            {otp.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                className="h-12 w-12 rounded-md border text-center text-lg"
                disabled={loading || expiryCountdown <= 0}
              />
            ))}
          </div>
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <div className="space-y-1 text-center text-sm">
            <div>
              {expiryCountdown > 0 ? (
                <span>زمان انقضای کد: {expiryCountdown} ثانیه</span>
              ) : (
                <span className="text-destructive">کد تأیید منقضی شده است</span>
              )}
            </div>
            <div>
              {resendCountdown > 0 ? (
                <span>امکان ارسال مجدد پس از {resendCountdown} ثانیه</span>
              ) : (
                <button onClick={requestOtp} disabled={loading} className="text-primary underline">
                  ارسال مجدد کد تأیید
                </button>
              )}
            </div>
          </div>
          <button onClick={() => setStep("phone")} className="w-full text-sm text-muted-foreground">
            تغییر شماره موبایل
          </button>
        </div>
      )}
    </div>
  );
}
