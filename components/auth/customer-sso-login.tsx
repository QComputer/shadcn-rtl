"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { appFetch, appPath } from "@/lib/app-base-path";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CustomerSsoLogin({ target, challenge, organization }: { target: string; challenge: string; organization: string }) {
  const ticket = useRef("");
  const [ready, setReady] = useState(false);
  const [targetName, setTargetName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const callback = Boolean(organization);
  useEffect(() => {
    let active = true;
    if (callback) {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("ticket");
      if (value) {
        ticket.current = value;
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }
      queueMicrotask(() => { if (active) setReady(Boolean(ticket.current)); });
    } else {
      void appFetch(`/api/auth/customer/sso/issue?target=${encodeURIComponent(target)}`, { cache: "no-store" })
        .then(response => response.json()).then(value => { if (active) { setReady(Boolean(value.available)); setTargetName(value.target?.name ?? ""); } })
        .catch(() => { if (active) setError("دریافت اطلاعات ورود انجام نشد."); });
    }
    return () => { active = false; };
  }, [callback, target]);

  async function proceed() {
    setBusy(true); setError("");
    try {
      if (callback) {
        const configResponse = await appFetch(`/api/auth/customer/config?organization=${encodeURIComponent(organization)}`, { cache: "no-store" });
        const config = await configResponse.json();
        if (!configResponse.ok || !config.homePath) throw new Error("UNAVAILABLE");
        const result = await signIn("customer-sso", { ticket: ticket.current, organization, redirect: false });
        ticket.current = "";
        if (!result?.ok || result.error) throw new Error("UNAVAILABLE");
        // Cleanup is best effort; a successful login must not be shown as failed
        // because this expiring verifier cookie could not be removed immediately.
        await appFetch("/api/auth/customer/sso/start", { method: "DELETE" }).catch(() => undefined);
        window.location.assign(appPath(config.homePath));
      } else {
        const response = await appFetch("/api/auth/customer/sso/issue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, challenge }) });
        const value = await response.json();
        if (!response.ok || !value.next) throw new Error("UNAVAILABLE");
        window.location.assign(value.next);
      }
    } catch { setReady(false); setError("ورود یکپارچه انجام نشد یا مهلت آن تمام شده است. از سایت مقصد دوباره شروع کنید."); }
    finally { setBusy(false); }
  }
  return <main dir="rtl" className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
    <Card className="w-full"><CardHeader><CardTitle>ورود یکپارچه مشتری</CardTitle>
      <CardDescription>{callback ? "ورود امن به حساب مشتری این مجموعه را تأیید کنید." : `ادامهٔ ورود به ${targetName || "مجموعهٔ مقصد"} با حساب فعلی شما.`}</CardDescription>
    </CardHeader><CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">این روش برای مشتریانی است که از قبل در هر دو مجموعه عضو هستند.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" onClick={proceed} disabled={!ready || busy}>{busy ? "در حال بررسی…" : "تأیید و ادامهٔ ورود"}</Button>
      {!ready && !error && <p className="text-sm text-muted-foreground">نشست معتبر مشتری یا درخواست ورود در دسترس نیست. در سایت مبدأ وارد شوید و از مقصد دوباره شروع کنید.</p>}
    </CardContent></Card>
  </main>;
}
