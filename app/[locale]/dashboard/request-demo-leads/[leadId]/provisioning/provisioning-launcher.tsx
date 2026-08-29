"use client";
import { appFetch } from "@/lib/app-base-path";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LeadProvisioningLauncher({ locale, leadId }: { locale: string; leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createPlan() {
    setLoading(true);
    setError(null);
    try {
      const response = await appFetch("/api/dashboard/tenant-provisioning-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestDemoLeadId: leadId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ایجاد طرح ناموفق بود");
      window.location.href = `/${locale}/dashboard/tenant-provisioning/${data.id}`;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "خطا در ایجاد طرح");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl" dir={locale === "en" ? "ltr" : "rtl"}>
      <Card>
        <CardHeader>
          <CardTitle>آماده‌سازی ایجاد کسب‌وکار</CardTitle>
          <CardDescription>
            این اقدام فقط یک طرح قابل بررسی از روی درخواست دمو می‌سازد. هیچ سازمان، حساب کاربری، عضویت، دامنه، پیامک، ایمیل یا پرداختی ایجاد نمی‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <Button onClick={createPlan} disabled={loading}>
            ایجاد یا بازکردن طرح آماده‌سازی
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
