import Link from "next/link";
import { unstable_cache } from "next/cache";
import { ArrowLeft, ArrowRight, Building2, Calendar, MapPin, ShoppingBag, Store } from "lucide-react";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { HomeHero } from "@/components/home/home-hero";

export const revalidate = 60;

type Locale = "fa" | "en" | "ar";

type OrganizationCard = {
  id: string;
  name: string;
  slug: string;
  type: "SHOP" | "APPOINTMENT";
  description: string | null;
  logo: string | null;
  coverImage: string | null;
  address: string | null;
  isOpen: boolean;
  rankScore: number;
  orderCount: number;
  appointmentCount: number;
  engagementCount: number;
  _count: {
    products: number;
    services: number;
    orders: number;
    followers: number;
    reviews: number;
  };
};

type HomeData = {
  organizations: OrganizationCard[];
  stats: {
    organizations: number;
    products: number;
    services: number;
  };
};

const copy = {
  fa: {
    platformName: "بازار باز",
    login: "ورود",
    shops: "فروشگاه‌های منتخب",
    appointments: "مراکز و خدمات قابل رزرو",
    allBusinesses: "مشاهده کسب‌وکارها",
    noOrganizations: "هنوز کسب‌وکار فعالی ثبت نشده است",
    noOrganizationsDesc: "بعد از ثبت اولین فروشگاه یا مرکز نوبت‌دهی، صفحه اصلی به‌صورت خودکار با داده‌های زنده تکمیل می‌شود.",
    createFirst: "ثبت اولین کسب‌وکار",
    open: "باز است",
    closed: "بسته است",
    products: "محصول",
    services: "خدمت",
    orders: "سفارش",
    appointmentsCount: "نوبت",
    activity: "فعالیت",
  },
  en: {
    platformName: "Bazar Baz",
    login: "Login",
    shops: "Featured shops",
    appointments: "Bookable services",
    allBusinesses: "Browse businesses",
    noOrganizations: "No active business is registered yet",
    noOrganizationsDesc: "Once the first shop or appointment business is registered, the home page will fill itself with live data.",
    createFirst: "Register first business",
    open: "Open",
    closed: "Closed",
    products: "products",
    services: "services",
    orders: "orders",
    appointmentsCount: "appointments",
    activity: "activity",
  },
  ar: {
    platformName: "بازار باز",
    login: "تسجيل الدخول",
    shops: "متاجر مميزة",
    appointments: "خدمات قابلة للحجز",
    allBusinesses: "استعراض الأنشطة",
    noOrganizations: "لا يوجد نشاط فعال بعد",
    noOrganizationsDesc: "بعد تسجيل أول متجر أو مركز حجز، ستُملأ الصفحة الرئيسية تلقائياً بالبيانات الحية.",
    createFirst: "تسجيل أول نشاط",
    open: "مفتوح",
    closed: "مغلق",
    products: "منتج",
    services: "خدمة",
    orders: "طلب",
    appointmentsCount: "حجز",
    activity: "نشاط",
  },
} satisfies Record<Locale, Record<string, string>>;

function getImageUrl(organization: { coverImage: string | null; logo: string | null }) {
  const image = organization.coverImage || organization.logo;
  return image && image.trim().length > 0 ? image : null;
}

function compareOrganizations(a: OrganizationCard, b: OrganizationCard) {
  if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
  if (Number(b.isOpen) !== Number(a.isOpen)) return Number(b.isOpen) - Number(a.isOpen);
  return a.name.localeCompare(b.name);
}

const getHomeData = unstable_cache(
  async (): Promise<HomeData> => {
    try {
      const [organizations, appointmentServices, organizationCount, productCount, serviceCount] = await Promise.all([
        prisma.organization.findMany({
          where: {
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            description: true,
            logo: true,
            coverImage: true,
            address: true,
            isOpen: true,
            _count: {
              select: {
                products: {
                  where: {
                    isActive: true,
                    deletedAt: null,
                  },
                },
                services: {
                  where: {
                    isActive: true,
                    deletedAt: null,
                  },
                },
                orders: {
                  where: {
                    deletedAt: null,
                  },
                },
                followers: true,
                reviews: true,
              },
            },
          },
          orderBy: [{ isOpen: "desc" }, { createdAt: "desc" }],
          take: 80,
        }),
        prisma.service.findMany({
          where: {
            isActive: true,
            deletedAt: null,
            organization: {
              isActive: true,
              deletedAt: null,
              type: "APPOINTMENT",
            },
          },
          select: {
            organizationId: true,
            _count: {
              select: {
                appointments: {
                  where: {
                    deletedAt: null,
                  },
                },
              },
            },
          },
          take: 1000,
        }),
        prisma.organization.count({
          where: {
            isActive: true,
            deletedAt: null,
          },
        }),
        prisma.product.count({
          where: {
            isActive: true,
            deletedAt: null,
            organization: {
              isActive: true,
              deletedAt: null,
            },
          },
        }),
        prisma.service.count({
          where: {
            isActive: true,
            deletedAt: null,
            organization: {
              isActive: true,
              deletedAt: null,
            },
          },
        }),
      ]);

      const appointmentCountByOrganization = new Map<string, number>();
      for (const service of appointmentServices) {
        appointmentCountByOrganization.set(
          service.organizationId,
          (appointmentCountByOrganization.get(service.organizationId) ?? 0) + service._count.appointments,
        );
      }

      const rankedOrganizations: OrganizationCard[] = organizations
        .map((organization) => {
          const appointmentCount = appointmentCountByOrganization.get(organization.id) ?? 0;
          const engagementCount = organization._count.followers + organization._count.reviews;
          const orderCount = organization._count.orders;
          const rankScore =
            organization.type === "SHOP"
              ? organization._count.products * 6 + orderCount * 8 + engagementCount * 3 + Number(organization.isOpen)
              : organization._count.services * 6 + appointmentCount * 8 + engagementCount * 3 + Number(organization.isOpen);

          return {
            ...organization,
            appointmentCount,
            orderCount,
            engagementCount,
            rankScore,
          };
        })
        .sort(compareOrganizations);

      return {
        organizations: rankedOrganizations,
        stats: {
          organizations: organizationCount,
          products: productCount,
          services: serviceCount,
        },
      };
    } catch (error) {
      console.error("Home page data load failed:", error);
      return {
        organizations: [],
        stats: {
          organizations: 0,
          products: 0,
          services: 0,
        },
      };
    }
  },
  ["home-page-ranked-v3"],
  {
    revalidate: 60,
    tags: ["home-page"],
  },
);

function normalizeLocale(locale: string | undefined): Locale {
  if (locale === "en" || locale === "ar" || locale === "fa") return locale;
  return "fa";
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = await params;
  const locale = normalizeLocale(resolvedParams.locale);
  const text = copy[locale];
  const isRTL = locale === "fa" || locale === "ar";
  const { organizations, stats } = await getHomeData();

  const shopOrganizations = organizations.filter((org) => org.type === "SHOP").slice(0, 8);
  const appointmentOrganizations = organizations.filter((org) => org.type === "APPOINTMENT").slice(0, 8);
  const heroSlides = organizations
    .filter((organization) => getImageUrl(organization) !== null)
    .slice(0, 5)
    .map((organization) => ({
      id: organization.id,
      title: organization.name,
      subtitle: organization.description || organization.address,
      href:
        organization.type === "SHOP"
          ? `/${locale}/shop/${organization.slug}`
          : `/${locale}/organizations/${organization.slug}`,
      image: getImageUrl(organization),
      type: organization.type,
      badge: organization.type === "SHOP" ? text.shops : text.appointments,
    }));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href={`/${locale}`} className="flex items-center gap-2 text-primary transition-colors hover:text-primary/80">
              <Building2 className="h-6 w-6" />
              <span className="text-lg font-bold">{text.platformName}</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <LocaleSwitcher />
              <ThemeSwitcher />
              <Link href={`/${locale}/login`}>
                <Button variant="default" size="sm">
                  {text.login}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <HomeHero locale={locale} slides={heroSlides} stats={stats} />

      {organizations.length > 0 ? (
        <main className="space-y-16 py-16">
          {shopOrganizations.length > 0 && (
            <OrganizationSection
              locale={locale}
              title={text.shops}
              organizations={shopOrganizations}
              icon="shop"
              isRTL={isRTL}
              text={text}
            />
          )}

          {appointmentOrganizations.length > 0 && (
            <OrganizationSection
              locale={locale}
              title={text.appointments}
              organizations={appointmentOrganizations}
              icon="appointment"
              isRTL={isRTL}
              text={text}
            />
          )}
        </main>
      ) : (
        <section className="py-24">
          <div className="container mx-auto px-4 text-center">
            <Building2 className="mx-auto mb-6 h-20 w-20 text-muted-foreground/30" />
            <h2 className="mb-4 text-2xl font-bold">{text.noOrganizations}</h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">{text.noOrganizationsDesc}</p>
            <Link href={`/${locale}/register/organization`}>
              <Button>{text.createFirst}</Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function OrganizationSection({
  locale,
  title,
  organizations,
  icon,
  isRTL,
  text,
}: {
  locale: Locale;
  title: string;
  organizations: OrganizationCard[];
  icon: "shop" | "appointment";
  isRTL: boolean;
  text: Record<string, string>;
}) {
  const Icon = icon === "shop" ? ShoppingBag : Calendar;

  return (
    <section>
      <div className="container mx-auto px-4">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
          </div>
          <Link href={`/${locale}`} className="hidden text-sm font-medium text-primary sm:inline-flex">
            {text.allBusinesses}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {organizations.map((organization) => (
            <OrganizationCardItem
              key={organization.id}
              organization={organization}
              locale={locale}
              isRTL={isRTL}
              text={text}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function OrganizationCardItem({
  organization,
  locale,
  isRTL,
  text,
}: {
  organization: OrganizationCard;
  locale: Locale;
  isRTL: boolean;
  text: Record<string, string>;
}) {
  const href = organization.type === "SHOP" ? `/${locale}/shop/${organization.slug}` : `/${locale}/organizations/${organization.slug}`;
  const primaryCount = organization.type === "SHOP" ? organization._count.products : organization._count.services;
  const primaryCountLabel = organization.type === "SHOP" ? text.products : text.services;
  const secondaryCount = organization.type === "SHOP" ? organization.orderCount : organization.appointmentCount;
  const secondaryCountLabel = organization.type === "SHOP" ? text.orders : text.appointmentsCount;

  return (
    <Link href={href} className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
      <div className="aspect-video overflow-hidden bg-muted">
        {organization.coverImage || organization.logo ? (
          <img
            src={organization.coverImage || organization.logo || ""}
            alt={organization.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted">
            {organization.type === "SHOP" ? (
              <Store className="h-14 w-14 text-primary/40" />
            ) : (
              <Calendar className="h-14 w-14 text-primary/40" />
            )}
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 text-lg font-bold transition-colors group-hover:text-primary">{organization.name}</h3>
          <Badge variant={organization.isOpen ? "default" : "outline"}>{organization.isOpen ? text.open : text.closed}</Badge>
        </div>
        {organization.description && <p className="line-clamp-2 min-h-[40px] text-sm text-muted-foreground">{organization.description}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <IconByType type={organization.type} />
            {primaryCount} {primaryCountLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShoppingBag className="h-3.5 w-3.5" />
            {secondaryCount} {secondaryCountLabel}
          </span>
          {organization.engagementCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Store className="h-3.5 w-3.5" />
              {organization.engagementCount} {text.activity}
            </span>
          )}
          {organization.address && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{organization.address}</span>
            </span>
          )}
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          {text.allBusinesses}
          {isRTL ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </div>
      </div>
    </Link>
  );
}

function IconByType({ type }: { type: "SHOP" | "APPOINTMENT" }) {
  return type === "SHOP" ? <ShoppingBag className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />;
}
