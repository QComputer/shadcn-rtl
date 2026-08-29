"use client";
import { appFetch } from "@/lib/app-base-path";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy as CopyIcon,
  ExternalLink,
  Globe2,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SupportedLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const domainStatuses = ["PENDING", "DNS_REQUIRED", "VERIFYING", "ACTIVE", "FAILED", "DISABLED"] as const;
type DomainStatus = (typeof domainStatuses)[number];

type ShopSummary = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  locale: string;
  domains: Array<{
    id: string;
    normalizedDomain: string;
    status: DomainStatus;
    isPrimary: boolean;
  }>;
};

type ShopDomain = {
  id: string;
  organizationId: string;
  domain: string;
  normalizedDomain: string;
  status: DomainStatus;
  isPrimary: boolean;
  vercelProjectDomainId: string | null;
  verificationToken: string | null;
  failureReason: string | null;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    type: "SHOP" | "APPOINTMENT";
    isActive: boolean;
  };
};

type ShopDomainPayload = {
  shops: ShopSummary[];
  domains: ShopDomain[];
  vercelAutomation: {
    configured: boolean;
    dryRun: boolean;
    projectConfigured: boolean;
    teamConfigured: boolean;
  };
};

type VercelDnsRecord = {
  type: string;
  name: string;
  value: string;
  purpose: string;
};

type VercelAutomationResult = {
  ok: boolean;
  dryRun: boolean;
  action: "add" | "check" | "remove";
  domain: string;
  verified: boolean;
  status: DomainStatus;
  message: string;
  dnsRecords: VercelDnsRecord[];
};

type Copy = {
  title: string;
  subtitle: string;
  reload: string;
  addTitle: string;
  domainLabel: string;
  shopLabel: string;
  statusLabel: string;
  primaryLabel: string;
  addButton: string;
  searchPlaceholder: string;
  allShops: string;
  allStatuses: string;
  empty: string;
  domains: string;
  shops: string;
  domain: string;
  shop: string;
  status: string;
  primary: string;
  active: string;
  inactive: string;
  setPrimary: string;
  remove: string;
  save: string;
  dnsHint: string;
  automationHint: string;
  automationDisabled: string;
  automationDryRun: string;
  automationConfigured: string;
  automationMissing: string;
  provisionOnVercel: string;
  addToVercel: string;
  checkVercel: string;
  removeFromVercel: string;
  dnsRecords: string;
  copied: string;
  copy: string;
  copyRecord: string;
  copiedDns: string;
  lastChecked: string;
  neverChecked: string;
  failureReason: string;
  securityNote: string;
  links: string;
  openStore: string;
  robots: string;
  sitemap: string;
  dnsRecommendation: string;
  apexWwwWarning: string;
  counterpartMissing: string;
  smokeTitle: string;
  smokeDescription: string;
  smokeCommand: string;
  confirmRemoveVercel: string;
  confirmDelete: string;
  failedToLoad: string;
  failedToSave: string;
  saved: string;
  statusLabels: Record<DomainStatus, string>;
};

const copyByLocale = {
  fa: {
    title: "دامنه‌های فروشگاه‌ها",
    subtitle: "مدیریت اتصال دامنه‌های اختصاصی به فروشگاه‌ها فقط توسط مدیر کل انجام می‌شود.",
    reload: "بارگذاری دوباره",
    addTitle: "اتصال دامنه جدید",
    domainLabel: "دامنه",
    shopLabel: "فروشگاه مقصد",
    statusLabel: "وضعیت اولیه",
    primaryLabel: "دامنه اصلی این فروشگاه باشد",
    addButton: "اتصال دامنه",
    searchPlaceholder: "جستجوی دامنه، فروشگاه یا اسلاگ...",
    allShops: "همه فروشگاه‌ها",
    allStatuses: "همه وضعیت‌ها",
    empty: "دامنه‌ای پیدا نشد.",
    domains: "دامنه",
    shops: "فروشگاه",
    domain: "دامنه",
    shop: "فروشگاه",
    status: "وضعیت",
    primary: "اصلی",
    active: "فعال",
    inactive: "غیرفعال",
    setPrimary: "اصلی شود",
    remove: "حذف",
    save: "ذخیره",
    dnsHint: "دامنه‌های فعال فقط وقتی مسیر سفارشی را سرو می‌کنند که وضعیت آن‌ها ACTIVE باشد.",
    automationHint: "اتوماسیون Vercel می‌تواند دامنه را به پروژه اضافه کند، وضعیت را بررسی کند و رکوردهای DNS پیشنهادی را نمایش دهد.",
    automationDisabled: "اتوماسیون Vercel هنوز پیکربندی نشده است. VERCEL_ACCESS_TOKEN و VERCEL_PROJECT_ID را تنظیم کنید.",
    automationDryRun: "حالت Dry-run فعال است؛ عملیات روی Vercel واقعی انجام نمی‌شود.",
    automationConfigured: "اتوماسیون Vercel آماده است.",
    automationMissing: "پیکربندی ناقص",
    provisionOnVercel: "هم‌زمان در Vercel هم اضافه شود",
    addToVercel: "افزودن به Vercel",
    checkVercel: "بررسی Vercel",
    removeFromVercel: "حذف از Vercel",
    dnsRecords: "رکوردهای DNS",
    copied: "کپی شد.",
    copy: "کپی",
    copyRecord: "کپی رکورد",
    copiedDns: "رکوردهای DNS در خروجی عملیات برگشت داده شد.",
    lastChecked: "آخرین بررسی",
    neverChecked: "هنوز بررسی نشده",
    failureReason: "خطا",
    securityNote: "این ابزار عمداً سازمانی نیست؛ فقط SUPER_ADMIN می‌تواند دامنه را به فروشگاه متصل یا از آن جدا کند.",
    links: "لینک‌های سریع",
    openStore: "باز کردن فروشگاه",
    robots: "robots.txt",
    sitemap: "sitemap.xml",
    dnsRecommendation: "پیشنهاد: برای دامنه‌های اصلی، هم نسخه بدون www و هم نسخه www را به همین فروشگاه وصل کنید؛ یکی را Primary بگذارید و دیگری را هم در Vercel فعال نگه دارید.",
    apexWwwWarning: "نسخه مکمل apex/www برای این فروشگاه پیدا نشد.",
    counterpartMissing: "دامنه مکمل وصل نشده است",
    smokeTitle: "تست سریع دامنه انتخابی",
    smokeDescription: "بعد از فعال‌سازی دامنه، این دستورها را از PowerShell اجرا کنید تا مسیرهای حیاتی بررسی شوند.",
    smokeCommand: "کپی دستور تست",
    confirmRemoveVercel: "این دامنه از پروژه Vercel حذف شود؟ نگاشت داخلی بازارباز حذف نمی‌شود.",
    confirmDelete: "این نگاشت دامنه از بازارباز حذف شود؟",
    failedToLoad: "بارگذاری دامنه‌ها ناموفق بود.",
    failedToSave: "ذخیره تغییرات ناموفق بود.",
    saved: "تغییرات ذخیره شد.",
    statusLabels: {
      PENDING: "در انتظار",
      DNS_REQUIRED: "نیازمند DNS",
      VERIFYING: "در حال بررسی",
      ACTIVE: "فعال",
      FAILED: "ناموفق",
      DISABLED: "غیرفعال",
    },
  },
  en: {
    title: "Shop domains",
    subtitle: "Custom-domain connections are managed centrally by the super admin only.",
    reload: "Reload",
    addTitle: "Connect a new domain",
    domainLabel: "Domain",
    shopLabel: "Target shop",
    statusLabel: "Initial status",
    primaryLabel: "Make this the shop primary domain",
    addButton: "Connect domain",
    searchPlaceholder: "Search domain, shop, or slug...",
    allShops: "All shops",
    allStatuses: "All statuses",
    empty: "No domains found.",
    domains: "Domains",
    shops: "Shops",
    domain: "Domain",
    shop: "Shop",
    status: "Status",
    primary: "Primary",
    active: "Active",
    inactive: "Inactive",
    setPrimary: "Set primary",
    remove: "Remove",
    save: "Save",
    dnsHint: "Custom domains are only served publicly after their status becomes ACTIVE.",
    automationHint: "Vercel automation can add the domain to the project, check verification status, and return suggested DNS records.",
    automationDisabled: "Vercel automation is not configured yet. Set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID.",
    automationDryRun: "Dry-run mode is active; no real Vercel mutation will be sent.",
    automationConfigured: "Vercel automation is ready.",
    automationMissing: "Configuration incomplete",
    provisionOnVercel: "Also provision on Vercel",
    addToVercel: "Add to Vercel",
    checkVercel: "Check Vercel",
    removeFromVercel: "Remove from Vercel",
    dnsRecords: "DNS records",
    copied: "Copied.",
    copy: "Copy",
    copyRecord: "Copy record",
    copiedDns: "DNS records were returned by the Vercel operation.",
    lastChecked: "Last checked",
    neverChecked: "Not checked yet",
    failureReason: "Failure",
    securityNote: "This is intentionally not an organization-admin tool; only SUPER_ADMIN can connect or disconnect shop domains.",
    links: "Quick links",
    openStore: "Open store",
    robots: "robots.txt",
    sitemap: "sitemap.xml",
    dnsRecommendation: "Recommendation: for apex domains, connect both apex and www to the same shop. Set one as Primary and keep the other active in Vercel too.",
    apexWwwWarning: "The matching apex/www domain was not found for this shop.",
    counterpartMissing: "Matching domain is missing",
    smokeTitle: "Selected domain smoke test",
    smokeDescription: "After the domain becomes active, run these PowerShell commands to verify the critical paths.",
    smokeCommand: "Copy smoke command",
    confirmRemoveVercel: "Remove this domain from the Vercel project? The local Bazar Baz mapping will remain.",
    confirmDelete: "Delete this domain mapping from Bazar Baz?",
    failedToLoad: "Failed to load domains.",
    failedToSave: "Failed to save changes.",
    saved: "Changes saved.",
    statusLabels: {
      PENDING: "Pending",
      DNS_REQUIRED: "DNS required",
      VERIFYING: "Verifying",
      ACTIVE: "Active",
      FAILED: "Failed",
      DISABLED: "Disabled",
    },
  },
  ar: {
    title: "نطاقات المتاجر",
    subtitle: "إدارة ربط النطاقات المخصصة تتم مركزياً من المدير العام فقط.",
    reload: "إعادة التحميل",
    addTitle: "ربط نطاق جديد",
    domainLabel: "النطاق",
    shopLabel: "المتجر الهدف",
    statusLabel: "الحالة الأولية",
    primaryLabel: "اجعل هذا النطاق الرئيسي للمتجر",
    addButton: "ربط النطاق",
    searchPlaceholder: "ابحث عن النطاق أو المتجر أو slug...",
    allShops: "كل المتاجر",
    allStatuses: "كل الحالات",
    empty: "لم يتم العثور على نطاقات.",
    domains: "النطاقات",
    shops: "المتجر",
    domain: "النطاق",
    shop: "المتجر",
    status: "الحالة",
    primary: "رئيسي",
    active: "نشط",
    inactive: "غير نشط",
    setPrimary: "اجعله رئيسياً",
    remove: "حذف",
    save: "حفظ",
    dnsHint: "النطاقات المخصصة لا تعمل علناً إلا بعد أن تصبح حالتها ACTIVE.",
    automationHint: "يمكن لأتمتة Vercel إضافة النطاق للمشروع، فحص التحقق، وإرجاع سجلات DNS المقترحة.",
    automationDisabled: "أتمتة Vercel غير مهيأة بعد. اضبط VERCEL_ACCESS_TOKEN و VERCEL_PROJECT_ID.",
    automationDryRun: "وضع Dry-run مفعّل؛ لن يتم إرسال تغيير حقيقي إلى Vercel.",
    automationConfigured: "أتمتة Vercel جاهزة.",
    automationMissing: "الإعداد غير مكتمل",
    provisionOnVercel: "أضفه أيضاً في Vercel",
    addToVercel: "إضافة إلى Vercel",
    checkVercel: "فحص Vercel",
    removeFromVercel: "حذف من Vercel",
    dnsRecords: "سجلات DNS",
    copied: "تم النسخ.",
    copy: "نسخ",
    copyRecord: "نسخ السجل",
    copiedDns: "تم إرجاع سجلات DNS من عملية Vercel.",
    lastChecked: "آخر فحص",
    neverChecked: "لم يتم الفحص بعد",
    failureReason: "الخطأ",
    securityNote: "هذه الأداة ليست لإدارة المؤسسة؛ فقط SUPER_ADMIN يمكنه ربط أو فصل نطاقات المتاجر.",
    links: "روابط سريعة",
    openStore: "فتح المتجر",
    robots: "robots.txt",
    sitemap: "sitemap.xml",
    dnsRecommendation: "التوصية: للنطاقات الرئيسية، اربط النسختين بدون www ومع www بنفس المتجر. اجعل واحدة Primary وأبق الأخرى نشطة في Vercel أيضاً.",
    apexWwwWarning: "لم يتم العثور على نطاق apex/www المكمل لهذا المتجر.",
    counterpartMissing: "النطاق المكمل غير مربوط",
    smokeTitle: "اختبار سريع للنطاق المحدد",
    smokeDescription: "بعد تفعيل النطاق، نفّذ أوامر PowerShell هذه للتحقق من المسارات المهمة.",
    smokeCommand: "نسخ أمر الاختبار",
    confirmRemoveVercel: "هل تريد حذف هذا النطاق من مشروع Vercel؟ سيبقى الربط المحلي في بازارباز.",
    confirmDelete: "هل تريد حذف ربط هذا النطاق من بازارباز؟",
    failedToLoad: "فشل تحميل النطاقات.",
    failedToSave: "فشل حفظ التغييرات.",
    saved: "تم حفظ التغييرات.",
    statusLabels: {
      PENDING: "بانتظار",
      DNS_REQUIRED: "يتطلب DNS",
      VERIFYING: "جار التحقق",
      ACTIVE: "نشط",
      FAILED: "فشل",
      DISABLED: "معطل",
    },
  },
} satisfies Record<SupportedLocale, Copy>;

function getCopy(locale: SupportedLocale) {
  return copyByLocale[locale] ?? copyByLocale.fa;
}

function statusBadgeVariant(status: DomainStatus) {
  if (status === "ACTIVE") return "default";
  if (status === "FAILED" || status === "DISABLED") return "destructive";
  return "secondary";
}

function getJsonError(responseBody: unknown, fallback: string) {
  if (responseBody && typeof responseBody === "object" && "error" in responseBody) {
    const error = (responseBody as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return fallback;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function getDomainUrl(domain: string, path = "") {
  return `https://${domain}${path}`;
}

function getMatchingApexWwwDomain(domain: string) {
  if (domain.startsWith("www.")) return domain.slice(4);
  if (domain.split(".").length === 2) return `www.${domain}`;
  return null;
}

function formatDate(value: string | null, locale: SupportedLocale, fallback: string) {
  if (!value) return fallback;
  return new Date(value).toLocaleString(locale === "fa" ? "fa-IR" : locale);
}

function buildRecordText(record: VercelDnsRecord) {
  return `${record.type}\t${record.name}\t${record.value}`;
}

function buildSmokeCommand(domain: ShopDomain, platformUrl: string) {
  return [
    `$env:CUSTOM_DOMAIN_SMOKE_BASE_URL="https://${domain.normalizedDomain}"`,
    `$env:CUSTOM_DOMAIN_SMOKE_PLATFORM_URL="${platformUrl}"`,
    `$env:CUSTOM_DOMAIN_SMOKE_SHOP_SLUG="${domain.organization.slug}"`,
    "pnpm run e2e:custom-domain-smoke",
  ].join("\n");
}

function quickLinkClass() {
  return "inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-xs font-medium text-foreground transition hover:bg-muted";
}

export function ShopDomainManager({ locale }: { locale: SupportedLocale }) {
  const copy = getCopy(locale);
  const isRtl = locale === "fa" || locale === "ar";
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [domains, setDomains] = useState<ShopDomain[]>([]);
  const [vercelAutomation, setVercelAutomation] = useState<ShopDomainPayload["vercelAutomation"] | null>(null);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<DomainStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newShopId, setNewShopId] = useState("");
  const [newStatus, setNewStatus] = useState<DomainStatus>("DNS_REQUIRED");
  const [newPrimary, setNewPrimary] = useState(false);
  const [newProvisionOnVercel, setNewProvisionOnVercel] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<VercelDnsRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platformUrl = typeof window === "undefined" ? "https://www.bazar-baz.ir" : window.location.origin;

  const copyText = async (text: string, successMessage = copy.copied) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(successMessage);
    } catch {
      setError(copy.failedToSave);
    }
  };

  const loadDomains = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await appFetch("/api/dashboard/shop-domains", { cache: "no-store" });
      const payload = await readJson<ShopDomainPayload | { error?: string }>(response);
      if (!response.ok) throw new Error(getJsonError(payload, copy.failedToLoad));
      const data = payload as ShopDomainPayload;
      setShops(data.shops);
      setDomains(data.domains);
      setVercelAutomation(data.vercelAutomation);
      if (!newShopId && data.shops[0]) setNewShopId(data.shops[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedToLoad);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shopById = useMemo(() => new Map(shops.map((shop) => [shop.id, shop])), [shops]);
  const domainKeySet = useMemo(() => new Set(domains.map((domain) => `${domain.organizationId}:${domain.normalizedDomain}`)), [domains]);

  const filteredDomains = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return domains.filter((domain) => {
      if (selectedShopId && domain.organizationId !== selectedShopId) return false;
      if (selectedStatus !== "ALL" && domain.status !== selectedStatus) return false;
      if (!normalizedQuery) return true;

      return (
        domain.normalizedDomain.toLowerCase().includes(normalizedQuery) ||
        domain.organization.name.toLowerCase().includes(normalizedQuery) ||
        domain.organization.slug.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [domains, query, selectedShopId, selectedStatus]);

  const selectedSmokeDomain = useMemo(() => {
    return (
      filteredDomains.find((domain) => domain.isPrimary && domain.status === "ACTIVE") ||
      filteredDomains.find((domain) => domain.status === "ACTIVE") ||
      filteredDomains[0] ||
      null
    );
  }, [filteredDomains]);

  const handleCreate = async () => {
    if (!newDomain.trim() || !newShopId) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await appFetch("/api/dashboard/shop-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain,
          organizationId: newShopId,
          status: newStatus,
          isPrimary: newPrimary,
          provisionOnVercel: newProvisionOnVercel,
        }),
      });
      const payload = await readJson<{ domain?: ShopDomain; vercel?: VercelAutomationResult | null; error?: string }>(response);
      if (!response.ok || !payload.domain) throw new Error(getJsonError(payload, copy.failedToSave));
      setDomains((current) => [payload.domain as ShopDomain, ...current.filter((domain) => domain.id !== payload.domain?.id)]);
      setNewDomain("");
      setNewPrimary(false);
      if (payload.vercel?.dnsRecords?.length) setDnsRecords(payload.vercel.dnsRecords);
      setMessage(payload.vercel ? `${copy.saved} ${payload.vercel.message}` : copy.saved);
      await loadDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedToSave);
    } finally {
      setSaving(false);
    }
  };

  const patchDomain = async (body: { id: string; organizationId?: string; status?: DomainStatus; isPrimary?: boolean }) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await appFetch("/api/dashboard/shop-domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await readJson<{ domain?: ShopDomain; error?: string }>(response);
      if (!response.ok || !payload.domain) throw new Error(getJsonError(payload, copy.failedToSave));
      setMessage(copy.saved);
      await loadDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedToSave);
    } finally {
      setSaving(false);
    }
  };

  const runVercelAction = async (domainId: string, action: "add" | "check" | "remove") => {
    if (action === "remove" && !window.confirm(copy.confirmRemoveVercel)) return;

    setActionBusyId(`${domainId}:${action}`);
    setError(null);
    setMessage(null);
    setDnsRecords([]);
    try {
      const response = await appFetch(`/api/dashboard/shop-domains/${domainId}/vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await readJson<{ domain?: ShopDomain; vercel?: VercelAutomationResult; error?: string }>(response);
      if (!response.ok || !payload.domain || !payload.vercel) throw new Error(getJsonError(payload, copy.failedToSave));
      if (payload.vercel.dnsRecords?.length) setDnsRecords(payload.vercel.dnsRecords);
      setMessage(`${copy.saved} ${payload.vercel.message}`);
      await loadDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedToSave);
    } finally {
      setActionBusyId(null);
    }
  };

  const deleteDomain = async (id: string) => {
    if (!window.confirm(copy.confirmDelete)) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await appFetch("/api/dashboard/shop-domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await readJson<{ ok?: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(getJsonError(payload, copy.failedToSave));
      setDomains((current) => current.filter((domain) => domain.id !== id));
      setMessage(copy.saved);
      await loadDomains();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedToSave);
    } finally {
      setSaving(false);
    }
  };

  const automationTone = vercelAutomation?.configured ? "border-primary/20 bg-primary/10 text-primary" : "border-destructive/20 bg-destructive/10 text-destructive";

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            SUPER_ADMIN only
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{copy.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadDomains()} disabled={loading || saving}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {copy.reload}
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>{copy.securityNote}</p>
          <p className="mt-2">{copy.dnsHint}</p>
          <p className="mt-2">{copy.automationHint}</p>
          <p className="mt-2">{copy.dnsRecommendation}</p>
          {vercelAutomation?.dryRun && <p className="mt-2 font-medium text-amber-600">{copy.automationDryRun}</p>}
        </div>
        <div className={cn("rounded-xl border p-4 text-sm", automationTone)}>
          <div className="flex items-center gap-2 font-medium">
            {vercelAutomation?.configured ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
            {vercelAutomation?.configured ? copy.automationConfigured : copy.automationMissing}
          </div>
          <p className="mt-2 text-xs opacity-90">
            {vercelAutomation?.configured ? copy.automationHint : copy.automationDisabled}
          </p>
        </div>
      </div>

      {(error || message) && (
        <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm", error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary")}>
          {error ? <XCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          <span>{error || message}</span>
        </div>
      )}

      {dnsRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{copy.dnsRecords}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[80px_minmax(100px,1fr)_minmax(160px,1.4fr)_80px] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>Type</span>
                <span>Name</span>
                <span>Value</span>
                <span>{copy.copy}</span>
              </div>
              <div className="divide-y">
                {dnsRecords.map((record, index) => (
                  <div key={`${record.type}-${record.name}-${index}`} className="grid grid-cols-[80px_minmax(100px,1fr)_minmax(160px,1.4fr)_80px] gap-3 px-4 py-3 text-sm">
                    <Badge variant="outline">{record.type}</Badge>
                    <span className="truncate" dir="ltr">{record.name}</span>
                    <span className="truncate font-mono text-xs" dir="ltr">{record.value}</span>
                    <Button type="button" variant="outline" size="xs" onClick={() => void copyText(buildRecordText(record), copy.copied)}>
                      <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                      {copy.copy}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.addTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_160px]">
              <label className="space-y-1.5 text-sm font-medium">
                <span>{copy.domainLabel}</span>
                <Input value={newDomain} onChange={(event) => setNewDomain(event.target.value)} placeholder="example.ir" dir="ltr" />
              </label>

              <label className="space-y-1.5 text-sm font-medium">
                <span>{copy.shopLabel}</span>
                <select
                  value={newShopId}
                  onChange={(event) => setNewShopId(event.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} — {shop.slug}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium">
                <span>{copy.statusLabel}</span>
                <select
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value as DomainStatus)}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {domainStatuses.map((status) => (
                    <option key={status} value={status}>{copy.statusLabels[status]}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newPrimary}
                    onChange={(event) => setNewPrimary(event.target.checked)}
                    className="h-4 w-4 rounded border-input accent-current"
                  />
                  {copy.primaryLabel}
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={newProvisionOnVercel}
                    onChange={(event) => setNewProvisionOnVercel(event.target.checked)}
                    disabled={vercelAutomation ? !vercelAutomation.configured : false}
                    className="h-4 w-4 rounded border-input accent-current"
                  />
                  {copy.provisionOnVercel}
                </label>
              </div>
              <Button type="button" onClick={() => void handleCreate()} disabled={saving || !newDomain.trim() || !newShopId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
                {copy.addButton}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.shops}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{copy.shops}</p>
                <p className="mt-1 text-2xl font-semibold">{shops.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{copy.domains}</p>
                <p className="mt-1 text-2xl font-semibold">{domains.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedSmokeDomain && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-4 w-4" aria-hidden="true" />
              {copy.smokeTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{copy.smokeDescription}</p>
            <div className="mt-3 rounded-xl border bg-muted/30 p-3" dir="ltr">
              <pre className="whitespace-pre-wrap text-xs"><code>{buildSmokeCommand(selectedSmokeDomain, platformUrl)}</code></pre>
            </div>
            <Button className="mt-3" type="button" variant="outline" size="sm" onClick={() => void copyText(buildSmokeCommand(selectedSmokeDomain, platformUrl), copy.copied)}>
              <CopyIcon className="h-4 w-4" aria-hidden="true" />
              {copy.smokeCommand}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{copy.domains}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(160px,240px)_180px]">
            <div className="relative">
              <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground", isRtl ? "right-3" : "left-3")} aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className={isRtl ? "pr-9" : "pl-9"}
              />
            </div>
            <select
              value={selectedShopId}
              onChange={(event) => setSelectedShopId(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{copy.allShops}</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as DomainStatus | "ALL")}
              className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="ALL">{copy.allStatuses}</option>
              {domainStatuses.map((status) => (
                <option key={status} value={status}>{copy.statusLabels[status]}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[minmax(220px,1.1fr)_minmax(180px,1fr)_170px_170px_260px] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
              <span>{copy.domain}</span>
              <span>{copy.shop}</span>
              <span>{copy.status}</span>
              <span>{copy.links}</span>
              <span>{copy.save}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {copy.reload}
              </div>
            ) : filteredDomains.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">{copy.empty}</div>
            ) : (
              <div className="divide-y">
                {filteredDomains.map((domain) => {
                  const shop = shopById.get(domain.organizationId);
                  const matchingDomain = getMatchingApexWwwDomain(domain.normalizedDomain);
                  const counterpartMissing = Boolean(matchingDomain && !domainKeySet.has(`${domain.organizationId}:${matchingDomain}`));
                  return (
                    <div key={domain.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(220px,1.1fr)_minmax(180px,1fr)_170px_170px_300px] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <a className="truncate font-medium underline-offset-4 hover:underline" href={getDomainUrl(domain.normalizedDomain)} target="_blank" rel="noreferrer" dir="ltr">
                            {domain.normalizedDomain}
                          </a>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant={domain.isPrimary ? "default" : "outline"}>{domain.isPrimary ? copy.primary : "Secondary"}</Badge>
                          {shop && !shop.isActive && <Badge variant="destructive">{copy.inactive}</Badge>}
                          {domain.vercelProjectDomainId && <Badge variant="secondary">Vercel</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">/{domain.organization.slug}</p>
                        {counterpartMissing && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{copy.apexWwwWarning} <span dir="ltr">{matchingDomain}</span></span>
                          </div>
                        )}
                      </div>

                      <select
                        value={domain.organizationId}
                        onChange={(event) => void patchDomain({ id: domain.id, organizationId: event.target.value })}
                        disabled={saving}
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        aria-label={copy.shop}
                      >
                        {shops.map((item) => (
                          <option key={item.id} value={item.id}>{item.name} — {item.slug}</option>
                        ))}
                      </select>

                      <div>
                        <Badge variant={statusBadgeVariant(domain.status)}>{copy.statusLabels[domain.status]}</Badge>
                        <select
                          value={domain.status}
                          onChange={(event) => void patchDomain({ id: domain.id, status: event.target.value as DomainStatus })}
                          disabled={saving}
                          className="mt-2 h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          aria-label={copy.status}
                        >
                          {domainStatuses.map((status) => (
                            <option key={status} value={status}>{copy.statusLabels[status]}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {copy.lastChecked}: {formatDate(domain.lastCheckedAt, locale, copy.neverChecked)}
                        </p>
                        {domain.failureReason && <p className="mt-1 text-xs text-destructive">{copy.failureReason}: {domain.failureReason}</p>}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <a className={quickLinkClass()} href={getDomainUrl(domain.normalizedDomain)} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          {copy.openStore}
                        </a>
                        <a className={quickLinkClass()} href={getDomainUrl(domain.normalizedDomain, "/robots.txt")} target="_blank" rel="noreferrer">
                          {copy.robots}
                        </a>
                        <a className={quickLinkClass()} href={getDomainUrl(domain.normalizedDomain, "/sitemap.xml")} target="_blank" rel="noreferrer">
                          {copy.sitemap}
                        </a>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void patchDomain({ id: domain.id, isPrimary: true })}
                          disabled={saving || domain.isPrimary}
                        >
                          {copy.setPrimary}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void runVercelAction(domain.id, "add")}
                          disabled={saving || Boolean(actionBusyId) || Boolean(vercelAutomation && !vercelAutomation.configured)}
                        >
                          {actionBusyId === `${domain.id}:add` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
                          {copy.addToVercel}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void runVercelAction(domain.id, "check")}
                          disabled={saving || Boolean(actionBusyId) || Boolean(vercelAutomation && !vercelAutomation.configured)}
                        >
                          {actionBusyId === `${domain.id}:check` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                          {copy.checkVercel}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void runVercelAction(domain.id, "remove")}
                          disabled={saving || Boolean(actionBusyId) || Boolean(vercelAutomation && !vercelAutomation.configured)}
                        >
                          {actionBusyId === `${domain.id}:remove` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                          {copy.removeFromVercel}
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => void deleteDomain(domain.id)} disabled={saving}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          {copy.remove}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
