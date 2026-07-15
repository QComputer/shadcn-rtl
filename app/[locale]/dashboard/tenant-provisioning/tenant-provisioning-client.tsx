"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPersianDate } from "@/lib/persian";

type Locale = "fa" | "en" | "ar";

type Lead = {
  id: string;
  status: string;
  fullName: string;
  businessName: string;
  businessType: string;
  phone: string;
  needSummary?: string | null;
};

type Plan = {
  id: string;
  status: string;
  proposedName: string;
  proposedSlug: string;
  proposedOrganizationType: string;
  proposedOwnerName: string | null;
  proposedOwnerPhoneMasked: string | null;
  updatedAt: string;
  requestDemoLead: { businessName: string; status: string } | null;
};

export function TenantProvisioningClient({ locale }: { locale: Locale }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansResponse, leadsResponse] = await Promise.all([
        fetch("/api/dashboard/tenant-provisioning-plans", { cache: "no-store" }),
        fetch("/api/dashboard/request-demo-leads?limit=100", { cache: "no-store" }),
      ]);
      if (!plansResponse.ok || !leadsResponse.ok) {
        throw new Error("بارگذاری اطلاعات آماده‌سازی ناموفق بود");
      }
      const plansData = await plansResponse.json();
      const leadsData = await leadsResponse.json();
      setPlans(plansData.items || []);
      setLeads((leadsData.items || []).filter((lead: Lead) => !["REJECTED", "ARCHIVED"].includes(lead.status)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "خطا در بارگذاری");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createPlan() {
    if (!selectedLeadId) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/tenant-provisioning-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestDemoLeadId: selectedLeadId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "ایجاد طرح آماده‌سازی ناموفق بود");
      window.location.href = `/${locale}/dashboard/tenant-provisioning/${data.id}`;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "خطا در ایجاد طرح");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="space-y-6" dir={locale === "en" ? "ltr" : "rtl"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">آماده‌سازی ایجاد کسب‌وکار</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
            این مرحله فقط اطلاعات و پیش‌نیازهای ایجاد فضای کسب‌وکار را بررسی می‌کند و هنوز هیچ سازمان، حساب کاربری یا اشتراکی ایجاد نشده است.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          تازه‌سازی
        </Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>ایجاد طرح از درخواست دمو</CardTitle>
          <CardDescription>فقط درخواست‌های دارای رضایت و غیرردشده قابل انتخاب هستند. ایجاد طرح هیچ منبع tenant ایجاد نمی‌کند.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
            <SelectTrigger className="min-w-0 flex-1">
              <SelectValue placeholder="انتخاب درخواست دمو" />
            </SelectTrigger>
            <SelectContent>
              {leads.map((lead) => (
                <SelectItem key={lead.id} value={lead.id}>
                  {lead.businessName} - {lead.fullName} - {lead.businessType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={createPlan} disabled={!selectedLeadId || creating}>
            ایجاد طرح پیش‌نویس
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>طرح‌های آماده‌سازی</CardTitle>
          <CardDescription>طرح‌های READY یا APPROVED هنوز اجرا نشده‌اند و tenant واقعی ایجاد نکرده‌اند.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کسب‌وکار</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>اسلاگ</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>به‌روزرسانی</TableHead>
                  <TableHead>اقدام</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">{plan.proposedName}</TableCell>
                    <TableCell>{plan.proposedOrganizationType}</TableCell>
                    <TableCell dir="ltr">{plan.proposedSlug}</TableCell>
                    <TableCell>
                      <Badge variant={plan.status === "READY" ? "default" : plan.status === "APPROVED" ? "secondary" : "outline"}>{plan.status}</Badge>
                    </TableCell>
                    <TableCell>{formatPersianDate(new Date(plan.updatedAt))}</TableCell>
                    <TableCell>
                      <Link href={`/${locale}/dashboard/tenant-provisioning/${plan.id}`}>
                        <Button size="sm" variant="outline">بررسی</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && plans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      هنوز طرحی ایجاد نشده است.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
