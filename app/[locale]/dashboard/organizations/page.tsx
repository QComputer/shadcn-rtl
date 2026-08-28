import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, Globe2, Package, Plus, Search, ShoppingBag, Store, Users, Wrench } from "lucide-react";
import type { OrganizationType, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { supportedLocales, type SupportedLocale } from "@/lib/i18n";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { buildOrganizationRootPath } from "@/lib/custom-domain-routing";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string | string[];
  type?: string | string[];
  status?: string | string[];
  page?: string | string[];
};

type Copy = {
  title: string;
  subtitle: string;
  create: string;
  manageDomains: string;
  searchPlaceholder: string;
  allTypes: string;
  allStatuses: string;
  active: string;
  inactive: string;
  shop: string;
  appointment: string;
  organizations: string;
  activeOrganizations: string;
  shops: string;
  appointmentProviders: string;
  activeDomains: string;
  members: string;
  products: string;
  services: string;
  orders: string;
  domains: string;
  primaryDomain: string;
  noPrimaryDomain: string;
  publicPage: string;
  domainManager: string;
  inotiManager: string;
  emptyTitle: string;
  emptyDescription: string;
  showing: string;
  of: string;
  previous: string;
  next: string;
  createdAt: string;
  accessDenied: string;
  accessDeniedDescription: string;
};

const copyByLocale = {
  fa: {
    title: "سازمان‌ها",
    subtitle: "نمای منتشرشده مدیریت سازمان‌های پلتفرم؛ فقط مدیر کل می‌تواند این صفحه را ببیند.",
    create: "افزودن سازمان",
    manageDomains: "مدیریت دامنه‌ها",
    searchPlaceholder: "جستجوی نام، اسلاگ، ایمیل یا تلفن...",
    allTypes: "همه نوع‌ها",
    allStatuses: "همه وضعیت‌ها",
    active: "فعال",
    inactive: "غیرفعال",
    shop: "فروشگاه",
    appointment: "نوبت‌دهی",
    organizations: "سازمان",
    activeOrganizations: "سازمان فعال",
    shops: "فروشگاه",
    appointmentProviders: "ارائه‌دهنده خدمت",
    activeDomains: "دامنه فعال",
    members: "عضو",
    products: "محصول",
    services: "خدمت",
    orders: "سفارش",
    domains: "دامنه",
    primaryDomain: "دامنه اصلی",
    noPrimaryDomain: "دامنه اصلی تنظیم نشده",
    publicPage: "صفحه عمومی",
    domainManager: "دامنه‌ها",
    inotiManager: "iNoti",
    emptyTitle: "سازمانی پیدا نشد",
    emptyDescription: "فیلترها را تغییر دهید یا یک سازمان جدید بسازید.",
    showing: "نمایش",
    of: "از",
    previous: "قبلی",
    next: "بعدی",
    createdAt: "ایجاد شده در",
    accessDenied: "دسترسی محدود",
    accessDeniedDescription: "فقط SUPER_ADMIN می‌تواند سازمان‌های پلتفرم را مدیریت کند.",
  },
  en: {
    title: "Organizations",
    subtitle: "Published platform organization management view. Only super admins can access it.",
    create: "Add organization",
    manageDomains: "Manage domains",
    searchPlaceholder: "Search name, slug, email, or phone...",
    allTypes: "All types",
    allStatuses: "All statuses",
    active: "Active",
    inactive: "Inactive",
    shop: "Shop",
    appointment: "Booking",
    organizations: "organizations",
    activeOrganizations: "active organizations",
    shops: "shops",
    appointmentProviders: "service providers",
    activeDomains: "active domains",
    members: "members",
    products: "products",
    services: "services",
    orders: "orders",
    domains: "domains",
    primaryDomain: "Primary domain",
    noPrimaryDomain: "No primary domain configured",
    publicPage: "Public page",
    domainManager: "Domains",
    inotiManager: "iNoti",
    emptyTitle: "No organizations found",
    emptyDescription: "Change filters or create a new organization.",
    showing: "Showing",
    of: "of",
    previous: "Previous",
    next: "Next",
    createdAt: "Created at",
    accessDenied: "Access denied",
    accessDeniedDescription: "Only SUPER_ADMIN can manage platform organizations.",
  },
  ar: {
    title: "المؤسسات",
    subtitle: "صفحة إدارة مؤسسات المنصة المنشورة. الوصول متاح للمدير العام فقط.",
    create: "إضافة مؤسسة",
    manageDomains: "إدارة النطاقات",
    searchPlaceholder: "ابحث بالاسم أو الرابط أو البريد أو الهاتف...",
    allTypes: "كل الأنواع",
    allStatuses: "كل الحالات",
    active: "نشط",
    inactive: "غير نشط",
    shop: "متجر",
    appointment: "حجوزات",
    organizations: "مؤسسة",
    activeOrganizations: "مؤسسات نشطة",
    shops: "متاجر",
    appointmentProviders: "مزودو خدمات",
    activeDomains: "نطاقات نشطة",
    members: "أعضاء",
    products: "منتجات",
    services: "خدمات",
    orders: "طلبات",
    domains: "نطاقات",
    primaryDomain: "النطاق الأساسي",
    noPrimaryDomain: "لم يتم ضبط نطاق أساسي",
    publicPage: "الصفحة العامة",
    domainManager: "النطاقات",
    inotiManager: "iNoti",
    emptyTitle: "لم يتم العثور على مؤسسات",
    emptyDescription: "غيّر عوامل التصفية أو أنشئ مؤسسة جديدة.",
    showing: "عرض",
    of: "من",
    previous: "السابق",
    next: "التالي",
    createdAt: "تاريخ الإنشاء",
    accessDenied: "الوصول محدود",
    accessDeniedDescription: "يمكن للمدير العام فقط إدارة مؤسسات المنصة.",
  },
} satisfies Record<SupportedLocale, Copy>;

function validateLocale(locale: string): SupportedLocale {
  return supportedLocales.includes(locale as SupportedLocale) ? (locale as SupportedLocale) : "fa";
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function normalizeType(value: string): OrganizationType | undefined {
  return value === "SHOP" || value === "APPOINTMENT" ? value : undefined;
}

function normalizeStatus(value: string): boolean | undefined {
  if (value === "active") return true;
  if (value === "inactive") return false;
  return undefined;
}

function formatNumber(value: number, locale: SupportedLocale): string {
  const text = value.toLocaleString(locale === "en" ? "en-US" : "fa-IR");
  return locale === "en" ? text : toPersianDigits(text);
}

function formatDate(value: Date, locale: SupportedLocale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(value);
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "undefined" || value === "" || value === "all") continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function publicOrganizationHref<T extends { slug: string }>(locale: SupportedLocale, organization: T) {
  return buildOrganizationRootPath({ locale, organizationSlug: organization.slug });
}

function statusBadgeClass(isActive: boolean) {
  return isActive
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function typeBadgeClass(type: OrganizationType) {
  return type === "SHOP"
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export default async function OrganizationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { locale: rawLocale } = await params;
  const resolvedSearchParams: SearchParams = searchParams ? await searchParams : {};
  const locale = validateLocale(rawLocale);
  const copy = copyByLocale[locale];
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard/organizations`)}`);
  }

  if (session.user.role !== "SUPER_ADMIN") {
    return (
      <section className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center px-4" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold">{copy.accessDenied}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy.accessDeniedDescription}</p>
        </div>
      </section>
    );
  }

  const q = firstParam(resolvedSearchParams.q).trim();
  const type = normalizeType(firstParam(resolvedSearchParams.type));
  const status = normalizeStatus(firstParam(resolvedSearchParams.status));
  const page = parsePage(firstParam(resolvedSearchParams.page));
  const pageSize = 18;

  const where: Prisma.OrganizationWhereInput = {
    deletedAt: null,
    ...(type ? { type } : {}),
    ...(typeof status === "boolean" ? { isActive: status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [organizations, total, activeTotal, shopTotal, appointmentTotal, activeDomainTotal] = await prisma.$transaction([
    prisma.organization.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        capabilitiesInitializedAt: true,
        capabilities: { select: { key: true, status: true } },
        description: true,
        address: true,
        phone: true,
        email: true,
        locale: true,
        timezone: true,
        isActive: true,
        isOpen: true,
        createdAt: true,
        domains: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          take: 3,
          select: {
            id: true,
            normalizedDomain: true,
            status: true,
            isPrimary: true,
          },
        },
        _count: {
          select: {
            members: true,
            products: true,
            services: true,
            orders: true,
            domains: true,
          },
        },
      },
    }),
    prisma.organization.count({ where }),
    prisma.organization.count({ where: { deletedAt: null, isActive: true } }),
    prisma.organization.count({ where: { deletedAt: null, type: "SHOP" } }),
    prisma.organization.count({ where: { deletedAt: null, type: "APPOINTMENT" } }),
    prisma.organizationDomain.count({ where: { status: "ACTIVE" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(clampedPage * pageSize, total);

  return (
    <section className="space-y-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>SUPER_ADMIN</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/dashboard/shop-domains`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Globe2 className="h-4 w-4" aria-hidden="true" />
            {copy.manageDomains}
          </Link>
          <Link
            href={`/${locale}/dashboard/organizations/new`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {copy.create}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Building2} label={copy.organizations} value={formatNumber(total, locale)} />
        <StatCard icon={Store} label={copy.shops} value={formatNumber(shopTotal, locale)} />
        <StatCard icon={CalendarDays} label={copy.appointmentProviders} value={formatNumber(appointmentTotal, locale)} />
        <StatCard icon={Users} label={copy.activeOrganizations} value={formatNumber(activeTotal, locale)} />
        <StatCard icon={Globe2} label={copy.activeDomains} value={formatNumber(activeDomainTotal, locale)} />
      </div>

      <form className="rounded-xl border bg-card p-3 shadow-sm" action={`/${locale}/dashboard/organizations`}>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              name="q"
              defaultValue={q}
              placeholder={copy.searchPlaceholder}
              className="h-10 w-full rounded-lg border bg-background px-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </label>
          <select
            name="type"
            defaultValue={type ?? "all"}
            className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="all">{copy.allTypes}</option>
            <option value="SHOP">{copy.shop}</option>
            <option value="APPOINTMENT">{copy.appointment}</option>
          </select>
          <select
            name="status"
            defaultValue={typeof status === "boolean" ? (status ? "active" : "inactive") : "all"}
            className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="all">{copy.allStatuses}</option>
            <option value="active">{copy.active}</option>
            <option value="inactive">{copy.inactive}</option>
          </select>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.showing}
          </button>
        </div>
      </form>

      {organizations.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold">{copy.emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.emptyDescription}</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {organizations.map((organization) => {
            const primaryDomain = organization.domains.find((domain) => domain.isPrimary) ?? organization.domains[0] ?? null;
            const publicHref = publicOrganizationHref(locale, organization);

            return (
              <article key={organization.id} className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {organization.type === "SHOP" ? <Store className="h-5 w-5" aria-hidden="true" /> : <CalendarDays className="h-5 w-5" aria-hidden="true" />}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold">{organization.name}</h2>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">/{organization.slug}</p>
                      </div>
                    </div>
                    {organization.description ? (
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{organization.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", typeBadgeClass(organization.type))}>
                      {organization.type === "SHOP" ? copy.shop : copy.appointment}
                    </span>
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", statusBadgeClass(organization.isActive))}>
                      {organization.isActive ? copy.active : copy.inactive}
                    </span>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{copy.members}</dt>
                    <dd className="mt-1 font-semibold">{formatNumber(organization._count.members, locale)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" />{copy.products}</dt>
                    <dd className="mt-1 font-semibold">{formatNumber(organization._count.products, locale)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wrench className="h-3.5 w-3.5" />{copy.services}</dt>
                    <dd className="mt-1 font-semibold">{formatNumber(organization._count.services, locale)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShoppingBag className="h-3.5 w-3.5" />{copy.orders}</dt>
                    <dd className="mt-1 font-semibold">{formatNumber(organization._count.orders, locale)}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <div className="space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">{copy.primaryDomain}</p>
                    {primaryDomain ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs" dir="ltr">{primaryDomain.normalizedDomain}</span>
                        <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{primaryDomain.status}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{copy.noPrimaryDomain}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {copy.createdAt}: {formatDate(organization.createdAt, locale)} · {formatNumber(organization._count.domains, locale)} {copy.domains}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Link
                      href={publicHref}
                      className="inline-flex h-8 items-center justify-center rounded-lg border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {copy.publicPage}
                    </Link>
                    <Link
                      href={`/${locale}/dashboard/shop-domains`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {copy.domainManager}
                    </Link>
                    <Link
                      href={`/${locale}/dashboard/organizations/${organization.id}/integrations/inoti`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {copy.inotiManager}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          {copy.showing} {formatNumber(rangeStart, locale)} - {formatNumber(rangeEnd, locale)} {copy.of} {formatNumber(total, locale)}
        </p>
        <div className="flex items-center gap-2">
          <Link
            aria-disabled={clampedPage <= 1}
            href={`/${locale}/dashboard/organizations${buildQuery({ q, type, status: typeof status === "boolean" ? (status ? "active" : "inactive") : undefined, page: Math.max(1, clampedPage - 1) })}`}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-lg border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted",
              clampedPage <= 1 && "pointer-events-none opacity-50",
            )}
          >
            {copy.previous}
          </Link>
          <Link
            aria-disabled={clampedPage >= totalPages}
            href={`/${locale}/dashboard/organizations${buildQuery({ q, type, status: typeof status === "boolean" ? (status ? "active" : "inactive") : undefined, page: Math.min(totalPages, clampedPage + 1) })}`}
            className={cn(
              "inline-flex h-8 items-center justify-center rounded-lg border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted",
              clampedPage >= totalPages && "pointer-events-none opacity-50",
            )}
          >
            {copy.next}
          </Link>
        </div>
      </div>
    </section>
  );
}
