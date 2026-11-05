"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { appFetch, appPath, appResourceUrl } from "@/lib/app-base-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type Config = {
  available: boolean;
  ssoAvailable?: boolean;
  organization: { id: string; slug: string; name: string; logo: string | null } | null;
  homePath: string | null;
};

export function CustomerPhoneLogin({ locale, organizationHint, callbackUrl }: { locale: string; organizationHint?: string; callbackUrl?: string }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [activationReady, setActivationReady] = useState(false);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tokenRef = useRef("");
  const configUrl = `/api/auth/customer/config${organizationHint ? `?organization=${encodeURIComponent(organizationHint)}` : ""}`;

  useEffect(() => {
    let active = true;
    void appFetch(configUrl, { cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => response.ok ? await response.json() as Config : { available: false, organization: null, homePath: null })
      .then((value) => { if (active) setConfig(value); })
      .catch(() => { if (active) setConfig({ available: false, organization: null, homePath: null }); });
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const activationToken = fragment.get("token");
    if (activationToken) {
      tokenRef.current = activationToken;
      // Consume the secret from the address bar immediately. It stays in React
      // memory until the user explicitly activates the link.
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    // A development Strict Mode replay must retain the already-cleared fragment.
    if (tokenRef.current) queueMicrotask(() => { if (active) setActivationReady(true); });
    return () => { active = false; };
  }, [configUrl]);

  async function requestLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await appFetch("/api/auth/customer/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ phone, ...(config?.organization?.slug ? { organization: config.organization.slug } : {}) }),
      });
      if (!response.ok) throw new Error("REQUEST_FAILED");
      setRequested(true);
    } catch {
      setError("درخواست انجام نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
    } finally { setBusy(false); }
  }

  async function activate() {
    if (!tokenRef.current || !config?.organization?.slug || !config.homePath) return;
    setBusy(true);
    setError("");
    try {
      const result = await signIn("customer-phone", { token: tokenRef.current, organization: config.organization.slug, redirect: false });
      if (result?.ok && !result.error) {
        tokenRef.current = "";
        setActivationReady(false);
        window.location.assign(appPath(config.homePath));
        return;
      }
      tokenRef.current = "";
      setActivationReady(false);
      setError("این لینک دیگر معتبر نیست. شماره تلفن را وارد کنید تا راهنمای تازه‌ای درخواست شود.");
    } catch {
      tokenRef.current = "";
      setActivationReady(false);
      setError("ورود انجام نشد. لینک ممکن است منقضی شده باشد؛ می‌توانید درخواست تازه‌ای بفرستید.");
    } finally { setBusy(false); }
  }

  async function startSso(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await appFetch("/api/auth/customer/sso/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: source.trim() }) });
      const value = await response.json();
      if (!response.ok || !value.next) throw new Error("UNAVAILABLE");
      window.location.assign(value.next);
    } catch { setError("ورود از این مجموعه در دسترس نیست. نشانی سایت و عضویت خود را بررسی کنید."); }
    finally { setBusy(false); }
  }

  const pageParams = new URLSearchParams();
  if (organizationHint) pageParams.set("organization", organizationHint);
  if (callbackUrl) pageParams.set("callbackUrl", callbackUrl);
  const pageQuery = pageParams.size ? `?${pageParams.toString()}` : "";
  const switchAccount = () => void signOut({ callbackUrl: appPath(`/${locale}/login/phone${pageQuery}`) });
  const passwordHref = `/${locale}/login${pageQuery}`;

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-10 text-foreground">
      <Card className="w-full max-w-md border-border/70 bg-card/95 shadow-xl shadow-primary/5">
        <CardHeader className="space-y-3 text-center">
          {config?.organization?.logo ? <Image src={appResourceUrl(config.organization.logo)} alt={config.organization.name} width={56} height={56} unoptimized referrerPolicy="no-referrer" className="mx-auto size-14 rounded-2xl border bg-background object-contain p-1" /> : <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary" aria-hidden="true">ب</div>}
          <CardTitle className="text-2xl">ورود یا ثبت‌نام با شماره تلفن</CardTitle>
          <CardDescription className="text-sm leading-7">
            {config?.organization?.name ? `برای ${config.organization.name} ادامه دهید.` : "برای حساب مشتری، شماره تلفن همراه خود را وارد کنید."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {config === null ? <div className="h-12 animate-pulse rounded-lg bg-muted" aria-label="در حال بارگذاری" /> : activationReady && config.organization && config.homePath ? (
            <div className="space-y-4">
              <p className="rounded-xl border bg-muted/40 p-4 text-sm leading-7">برای ادامه، فعال‌سازی لینک را انتخاب کنید. لینک پس از استفاده دیگر قابل استفاده نیست.</p>
              <Button className="min-h-12 w-full" onClick={() => void activate()} disabled={busy}>{busy ? "در حال بررسی لینک…" : "فعال‌سازی و ورود"}</Button>
            </div>
          ) : !config.available ? (
            <div className="rounded-xl border bg-muted/40 p-4 text-center text-sm leading-7 text-muted-foreground" role="status">ورود با شماره تلفن در حال حاضر در دسترس نیست.</div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void requestLink(event)}>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">شماره تلفن همراه</Label>
                <Input autoFocus type="tel" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={64} value={phone} onChange={(event) => setPhone(event.target.value)} id="customer-phone" name="phone" placeholder="۰۹۱۲۱۲۳۴۵۶۷" required className="h-12 text-left text-lg tracking-wide" />
              </div>
              <Button className="min-h-12 w-full" type="submit" disabled={busy || phone.trim().length < 8}>{busy ? "در حال ارسال درخواست…" : requested ? "درخواست راهنمای تازه" : "ادامه با شماره تلفن"}</Button>
              {requested && <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-muted-foreground" role="status">اگر این شماره واجد شرایط باشد، راهنمای ورود برایتان ارسال می‌شود. در صورت نیاز می‌توانید درخواست دیگری بفرستید.</p>}
            </form>
          )}
          {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7 text-destructive">{error}</p>}
          {config?.ssoAvailable && <details className="rounded-xl border p-4 text-sm">
            <summary className="cursor-pointer font-medium">ورود با حساب مجموعهٔ دیگر</summary>
            <form onSubmit={startSso} className="mt-4 space-y-3">
              <p className="leading-6 text-muted-foreground">اگر در هر دو مجموعه عضو هستید، نشانی سایت مجموعه‌ای را وارد کنید که اکنون در آن وارد حساب شده‌اید.</p>
              <Label htmlFor="customer-sso-source">نشانی سایت مجموعهٔ مبدأ</Label>
              <Input id="customer-sso-source" dir="ltr" placeholder="example.ir" maxLength={128} value={source} onChange={event => setSource(event.target.value)} autoComplete="off" required />
              <Button variant="outline" className="w-full" disabled={busy || !source.trim()}>ادامهٔ ورود یکپارچه</Button>
            </form>
          </details>}
          <div className="flex flex-col gap-3 border-t pt-4 text-center text-sm">
            <Link href={passwordHref} className="font-medium text-primary underline-offset-4 hover:underline">ورود با رمز عبور</Link>
            {error && <Button type="button" variant="outline" className="min-h-11" onClick={switchAccount}>خروج از حساب فعلی و تلاش دوباره</Button>}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
