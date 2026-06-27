"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Globe2, Link2, Loader2, RefreshCw, Search, ShieldCheck, Trash2, XCircle } from "lucide-react";
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
  securityNote: string;
  failedToLoad: string;
  failedToSave: string;
  saved: string;
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
    dnsHint: "بعد از اتصال دامنه در این صفحه، دامنه را در Vercel هم اضافه کنید و DNS مشتری را طبق رکوردهای Vercel تنظیم کنید. اتوماسیون Vercel در فاز بعدی اضافه می‌شود.",
    securityNote: "این ابزار عمداً سازمانی نیست؛ فقط SUPER_ADMIN می‌تواند دامنه را به فروشگاه متصل یا از آن جدا کند.",
    failedToLoad: "بارگذاری دامنه‌ها ناموفق بود.",
    failedToSave: "ذخیره تغییرات ناموفق بود.",
    saved: "تغییرات ذخیره شد.",
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
    dnsHint: "After connecting the domain here, also add it to Vercel and configure the customer's DNS using Vercel records. Vercel automation comes in the next phase.",
    securityNote: "This is intentionally not an organization-admin tool; only SUPER_ADMIN can connect or disconnect shop domains.",
    failedToLoad: "Failed to load domains.",
    failedToSave: "Failed to save changes.",
    saved: "Changes saved.",
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
    dnsHint: "بعد ربط النطاق هنا، أضفه أيضاً في Vercel واضبط DNS العميل حسب سجلات Vercel. أتمتة Vercel ستأتي في المرحلة التالية.",
    securityNote: "هذه الأداة ليست لإدارة المؤسسة؛ فقط SUPER_ADMIN يمكنه ربط أو فصل نطاقات المتاجر.",
    failedToLoad: "فشل تحميل النطاقات.",
    failedToSave: "فشل حفظ التغييرات.",
    saved: "تم حفظ التغييرات.",
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

export function ShopDomainManager({ locale }: { locale: SupportedLocale }) {
  const copy = getCopy(locale);
  const isRtl = locale === "fa" || locale === "ar";
  const [shops, setShops] = useState<ShopSummary[]>([]);
  const [domains, setDomains] = useState<ShopDomain[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<DomainStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newShopId, setNewShopId] = useState("");
  const [newStatus, setNewStatus] = useState<DomainStatus>("DNS_REQUIRED");
  const [newPrimary, setNewPrimary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDomains = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard/shop-domains", { cache: "no-store" });
      const payload = await readJson<ShopDomainPayload | { error?: string }>(response);
      if (!response.ok) throw new Error(getJsonError(payload, copy.failedToLoad));
      const data = payload as ShopDomainPayload;
      setShops(data.shops);
      setDomains(data.domains);
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

  const handleCreate = async () => {
    if (!newDomain.trim() || !newShopId) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/dashboard/shop-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain,
          organizationId: newShopId,
          status: newStatus,
          isPrimary: newPrimary,
        }),
      });
      const payload = await readJson<{ domain?: ShopDomain; error?: string }>(response);
      if (!response.ok || !payload.domain) throw new Error(getJsonError(payload, copy.failedToSave));
      setDomains((current) => [payload.domain as ShopDomain, ...current.filter((domain) => domain.id !== payload.domain?.id)]);
      setNewDomain("");
      setNewPrimary(false);
      setMessage(copy.saved);
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
      const response = await fetch("/api/dashboard/shop-domains", {
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

  const deleteDomain = async (id: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/dashboard/shop-domains", {
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

      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>{copy.securityNote}</p>
        <p className="mt-2">{copy.dnsHint}</p>
      </div>

      {(error || message) && (
        <div className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm", error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary")}>
          {error ? <XCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          <span>{error || message}</span>
        </div>
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
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={newPrimary}
                  onChange={(event) => setNewPrimary(event.target.checked)}
                  className="h-4 w-4 rounded border-input accent-current"
                />
                {copy.primaryLabel}
              </label>
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
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_150px_130px_220px] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid">
              <span>{copy.domain}</span>
              <span>{copy.shop}</span>
              <span>{copy.status}</span>
              <span>{copy.primary}</span>
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
                  return (
                    <div key={domain.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1fr)_150px_130px_220px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Globe2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <p className="truncate font-medium" dir="ltr">{domain.normalizedDomain}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">/{domain.organization.slug}</p>
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

                      <select
                        value={domain.status}
                        onChange={(event) => void patchDomain({ id: domain.id, status: event.target.value as DomainStatus })}
                        disabled={saving}
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        aria-label={copy.status}
                      >
                        {domainStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>

                      <div>
                        <Badge variant={domain.isPrimary ? "default" : "outline"}>
                          {domain.isPrimary ? copy.primary : "—"}
                        </Badge>
                        {shop && !shop.isActive && (
                          <Badge variant="destructive" className="ms-2">{copy.inactive}</Badge>
                        )}
                        <Badge variant={statusBadgeVariant(domain.status)} className="ms-2 lg:hidden">{domain.status}</Badge>
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
                          variant="destructive"
                          size="sm"
                          onClick={() => void deleteDomain(domain.id)}
                          disabled={saving}
                        >
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
