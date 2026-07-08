"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, Plus, RefreshCw, Trash2, XCircle, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-toastify";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import type { SupportedLocale } from "@/lib/i18n";

type OrganizationDomain = {
  id: string;
  organizationId: string;
  domain: string;
  normalizedDomain: string;
  kind: "APEX" | "SUBDOMAIN";
  provider: "VERCEL";
  status: string;
  isPrimary: boolean;
  providerVerified: boolean;
  dnsConfigured: boolean;
  sslReady: boolean;
  vercelProjectDomainId: string | null;
  failureReason: string | null;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  removedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    type: string;
    isActive: boolean;
  } | null;
  apexInfo: {
    isApex: boolean;
    primaryLabel: string;
    recommendedAlias: string;
  };
};

type VerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason?: string;
};

type DnsRecord = {
  type: string;
  name: string;
  value: string;
  purpose: string;
};

type VercelState = {
  configured: boolean;
  dryRun: boolean;
  projectConfigured: boolean;
  teamConfigured: boolean;
  realMutationsEnabled: boolean;
};

const statusCopy: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline" }> = {
  REQUESTED: { label: "درخواست شده", color: "secondary" },
  PROVIDER_PENDING: { label: "در حال ثبت", color: "secondary" },
  DNS_REQUIRED: { label: "نیاز به کانفیگ DNS", color: "outline" },
  VERIFYING: { label: "در حال بررسی", color: "secondary" },
  ACTIVE: { label: "فعال", color: "default" },
  ERROR: { label: "خطا", color: "destructive" },
  DISABLED: { label: "غیرفعال", color: "outline" },
  REMOVAL_PENDING: { label: "در حال حذف", color: "outline" },
  REMOVED: { label: "حذف شده", color: "outline" },
};

const kindCopy: Record<string, string> = {
  APEX: "آپیکس",
  SUBDOMAIN: "زیردامنه",
};

function resolveOrganizationId(domains: OrganizationDomain[]): string | null {
  const byOrg = new Map<string, number>();
  for (const domain of domains) {
    if (domain.organizationId) {
      byOrg.set(domain.organizationId, (byOrg.get(domain.organizationId) || 0) + 1);
    }
  }
  if (byOrg.size === 1) return Array.from(byOrg.keys())[0] ?? null;
  return domains[0]?.organizationId ?? null;
}

export default function OrganizationDomainsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params);
  const locale = (resolvedParams.locale || "fa") as SupportedLocale;
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null);
  const [domains, setDomains] = useState<OrganizationDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vercelState, setVercelState] = useState<VercelState | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [verificationRecords, setVerificationRecords] = useState<VerificationRecord[]>([]);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const t = useMemo(() => (key: string) => (dict ? getDictValue(dict, key) : key), [dict]);

  useEffect(() => {
    setDict(getDictionary(locale));

    async function load() {
      setLoading(true);
      try {
        const [domainsRes, vercelRes] = await Promise.all([
          fetch("/api/dashboard/organization-domains", { cache: "no-store" }),
          fetch("/api/dashboard/organization-domains/vercel-automation", { cache: "no-store" }),
        ]);

        if (domainsRes.ok) {
          const data = await domainsRes.json();
          setDomains(Array.isArray(data.domains) ? data.domains : []);
        }

        if (vercelRes.ok) {
          const data = await vercelRes.json();
          setVercelState(data.state ?? null);
        }
      } catch (loadError) {
        console.error("Failed to load organization domains", loadError);
        toast.error(t("dashboard.domains.loadError") || "خطا در بارگذاری دامنه‌ها");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [locale, t]);

  async function handleAddDomain(event: React.FormEvent) {
    event.preventDefault();
    if (!domainInput.trim()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { domain: domainInput.trim(), isPrimary };
      const organizationId = resolveOrganizationId(domains);
      if (organizationId) payload.organizationId = organizationId;

      const response = await fetch("/api/dashboard/organization-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to add domain");
      }

      toast.success(t("dashboard.domains.addSuccess") || "دامنه با موفقیت اضافه شد");
      setDomainInput("");
      setIsPrimary(false);

      setDomains((current) => {
        const newDomain = result.domain as OrganizationDomain;
        return [newDomain, ...current];
      });
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "خطا در افزودن دامنه");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyDomain(domain: OrganizationDomain) {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/dashboard/organization-domains/${domain.id}/vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check" }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to verify domain");
      }

      const vercelData = result.vercel as { verification?: VerificationRecord[]; dnsRecords?: DnsRecord[] } | undefined;
      setVerificationRecords(Array.isArray(vercelData?.verification) ? vercelData.verification : []);
      setDnsRecords(Array.isArray(vercelData?.dnsRecords) ? vercelData.dnsRecords : []);
      setSelectedDomainId(domain.id);
      toast.success(t("dashboard.domains.verifySuccess") || "بررسی دامنه با موفقیت انجام شد");
    } catch (verifyError) {
      toast.error(verifyError instanceof Error ? verifyError.message : "خطا در بررسی دامنه");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveDomain(domain: OrganizationDomain) {
    if (!confirm(t("dashboard.domains.confirmRemove") || "آیا از حذف این دامنه اطمینان دارید؟")) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/dashboard/organization-domains/${domain.id}/vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to remove domain");
      }

      toast.success(t("dashboard.domains.removeSuccess") || "دامنه حذف شد");
      setDomains((current) => current.filter((item) => item.id !== domain.id));
      if (selectedDomainId === domain.id) {
        setSelectedDomainId(null);
        setVerificationRecords([]);
        setDnsRecords([]);
      }
    } catch (removeError) {
      toast.error(removeError instanceof Error ? removeError.message : "خطا در حذف دامنه");
    } finally {
      setSubmitting(false);
    }
  }

  function copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
    setCopiedToken(value);
    setTimeout(() => setCopiedToken((current) => (current === value ? null : current)), 2000);
  }

  const automationBlocksMutations = !vercelState?.configured || !vercelState?.realMutationsEnabled;

  if (loading) {
    return (
      <div className="p-6 space-y-4" dir={locale === "en" ? "ltr" : "rtl"}>
        <div className="h-10 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-96 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6" dir={locale === "en" ? "ltr" : "rtl"}>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold">{t("dashboard.domains.title") || "دامنه‌های سفارشی"}</h2>
        <p className="text-muted-foreground">{t("dashboard.domains.description") || "دامنه‌های دلخواه خود را به سازمان متصل کنید."}</p>
      </div>

      {vercelState && !vercelState.configured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /> {t("dashboard.domains.automationMissing") || "اتوماسیون Vercel پیکربندی نشده"}</CardTitle>
            <CardDescription>{t("dashboard.domains.automationMissingDescription") || "برای ثبت خودکار دامنه، متغیرهای VERCEL_ACCESS_TOKEN و VERCEL_PROJECT_ID را تنظیم کنید."}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {vercelState && vercelState.configured && !vercelState.realMutationsEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600"><AlertTriangle className="h-5 w-5" /> {t("dashboard.domains.automationDryRun") || "اتوماسیون در حالت پیش‌نمایش است"}</CardTitle>
            <CardDescription>{t("dashboard.domains.automationDryRunDescription") || "برای ثبت واقعی دامنه، متغیر CUSTOM_DOMAIN_REAL_MUTATION_ENABLED=true را تنظیم کنید."}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.domains.addTitle") || "افزودن دامنه جدید"}</CardTitle>
          <CardDescription>{t("dashboard.domains.addDescription") || "دامنه مورد نظر خود را وارد کنید. پس از افزودن باید رکوردهای DNS را تنظیم کنید."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddDomain} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="domain">{t("dashboard.domains.domainLabel") || "دامنه"}</Label>
              <Input
                id="domain"
                placeholder="example.ir"
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                disabled={submitting || automationBlocksMutations}
                required
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(event) => setIsPrimary(event.target.checked)}
                  disabled={submitting || automationBlocksMutations}
                />
                {t("dashboard.domains.primaryLabel") || "دامنه اصلی"}
              </label>
              <Button type="submit" disabled={submitting || automationBlocksMutations}>
                {submitting ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Plus className="h-4 w-4 ml-2" />}
                {t("dashboard.domains.addButton") || "افزودن"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.domains.listTitle") || "دامنه‌های فعال"}</CardTitle>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.domains.empty") || "هنوز دامنه‌ای ثبت نشده است."}</p>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div key={domain.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{domain.domain}</p>
                      <p className="text-xs text-muted-foreground">
                        {domain.kind ? kindCopy[domain.kind] || domain.kind : "—"}{domain.organization ? ` · ${domain.organization.name}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={domain.isPrimary ? "default" : "outline"}>{domain.isPrimary ? "اصلی" : "فرعی"}</Badge>
                      <Badge variant={statusCopy[domain.status]?.color || "outline"}>{statusCopy[domain.status]?.label || domain.status}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyDomain(domain)}
                        disabled={submitting || automationBlocksMutations}
                      >
                        <RefreshCw className="h-4 w-4 ml-1" />
                        بررسی
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveDomain(domain)}
                        disabled={submitting || automationBlocksMutations}
                      >
                        <Trash2 className="h-4 w-4 ml-1" />
                        حذف
                      </Button>
                    </div>
                  </div>

                  {domain.reviewedAt && (
                    <p className="text-xs text-muted-foreground">بررسی شده در {new Date(domain.reviewedAt).toLocaleString(locale)}</p>
                  )}

                  {selectedDomainId === domain.id && (
                    <div className="space-y-3">
                      {verificationRecords.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{t("dashboard.domains.verificationRecords") || "رکوردهای تأیید Vercel"}</p>
                          <div className="space-y-2">
                            {verificationRecords.map((record, index) => (
                              <div key={`${record.type}-${index}`} className="rounded-md border bg-muted/40 p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-mono">{record.type}</span>
                                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(record.value)}>
                                    {copiedToken === record.value ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                                    {copiedToken === record.value ? (t("dashboard.domains.copied") || "کپی شد") : (t("dashboard.domains.copy") || "کپی")}
                                  </Button>
                                </div>
                                <p className="text-xs break-all">{record.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {dnsRecords.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{t("dashboard.domains.dnsRecords") || "رکوردهای DNS پیشنهادی"}</p>
                          <div className="space-y-2">
                            {dnsRecords.map((record, index) => (
                              <div key={`${record.type}-${index}`} className="rounded-md border bg-muted/40 p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-mono">{record.type} {record.name}</span>
                                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(record.value)}>
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <p className="text-xs break-all">{record.value}</p>
                                <p className="text-xs text-muted-foreground">{record.purpose}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {domain.apexInfo && domain.kind === "APEX" && domain.apexInfo.recommendedAlias && (
                        <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
                          {t("dashboard.domains.apexWwwWarning") || "برای دامنه آپیکس، توصیه می‌شود بلافاصله زیردامنه www"} {domain.apexInfo.recommendedAlias} {t("dashboard.domains.counterpartMissing") || "را هم ثبت کنید تا پایداری سئو حفظ شود."}
                        </div>
                      )}
                    </div>
                  )}

                  {domain.kind && domain.kind === "APEX" && selectedDomainId !== domain.id && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
                      {t("dashboard.domains.apexRecommendation") || "دامنه آپیکس شناسایی شد. توصیه می‌شود www"} {domain.apexInfo?.recommendedAlias} {t("dashboard.domains.counterpartMissing") || "را هم ثبت کنید."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
