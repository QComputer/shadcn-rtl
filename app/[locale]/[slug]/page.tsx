import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { CalendarDays, ShoppingBag, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";
import { activePublicBusinessCapabilities, resolveOrganizationPublicHome } from "@/lib/organization-public-home";
import { getPublicOrganizationReadModel } from "@/lib/public-experience/organization-public-read-model.service";
import { resolveOrganizationBranding } from "@/lib/organization-branding";
import { getOrganizationRootSeoContext } from "@/lib/custom-domain-seo";
import { buildPublicMetadata } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ShopPage from "./shop/page";
import ShopLayout from "./shop/layout";
import AppointmentServicesPage from "./appointment/services/page";
import AppointmentLayout from "./appointment/layout";
import { OrganizationBrandHome } from "@/components/public/organization-brand-home";
import { OrganizationVisitorChoice } from "@/components/public/organization-visitor-choice";
import { appResourceUrl } from "@/lib/app-base-path";
import { resolveOrganizationHomeContent } from "@/lib/organization-home-content";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;

  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logo: true,
      coverImage: true,
      capabilities: { select: { key: true, status: true } },
      settings: { select: { settings: true } },
      branding: {
        select: {
          organizationId: true,
          displayName: true,
          shortName: true,
          logoUrl: true,
          faviconUrl: true,
          appleTouchIconUrl: true,
          pwaIcon192Url: true,
          pwaIcon512Url: true,
          ogImageUrl: true,
          source: true,
        },
      },
    },
  });

  if (!organization) {
    return { title: "Organization Not Found" };
  }

  const branding = resolveOrganizationBranding({
    organizationId: organization.id,
    name: organization.name,
    logo: organization.logo,
    coverImage: organization.coverImage,
    branding: organization.branding,
  });
  const homeContent = resolveOrganizationHomeContent({ organizationSlug: slug, locale });
  const seoContext = await getOrganizationRootSeoContext({ locale, slug });

  return buildPublicMetadata({
    locale,
    baseUrl: seoContext.baseUrl,
    path: seoContext.path,
    title: homeContent?.seo.title || branding.displayName || organization.name || "Bazarbaaz",
    description: homeContent?.seo.description || organization.description || `${organization.name} on Bazarbaaz.`,
    image: branding.ogImage,
    alternatePath: seoContext.alternatePath,
    icons: {
      icon: [{ url: appResourceUrl(branding.favicon) }],
      apple: [{ url: appResourceUrl(branding.appleTouchIcon) }],
    },
  });
}

export default async function OrganizationHomePage({ params }: Props) {
  const { locale, slug } = await params;
  const requestHeaders = await headers();
  const isCustomDomain = requestHeaders.get("x-bazar-custom-domain") === "true";
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: {
      name: true,
      slug: true,
      description: true,
      address: true,
      phone: true,
      email: true,
      capabilities: { select: { key: true, status: true } },
      settings: { select: { settings: true, publicHomeMode: true, brandLandingProvider: true } },
    },
  });

  if (!organization) notFound();
  const publicHome = resolveOrganizationPublicHome({
    capabilities: organization.capabilities,
    settings: organization.settings?.settings,
    publicHomeMode: organization.settings?.publicHomeMode,
    brandLandingProvider: organization.settings?.brandLandingProvider,
  });
  const organizationRootPath = buildOrganizationRootPath({
    locale,
    organizationSlug: organization.slug,
    isCustomDomain,
  });

  if (publicHome.kind === "capability" && publicHome.capability === "SHOP") {
    return (
      <ShopLayout params={params} organizationRootPath={organizationRootPath}>
        <ShopPage params={params} />
      </ShopLayout>
    );
  }

  if (publicHome.kind === "capability" && publicHome.capability === "APPOINTMENT") {
    return (
      <AppointmentLayout params={params} organizationRootPath={organizationRootPath}>
        <AppointmentServicesPage params={params} />
      </AppointmentLayout>
    );
  }

  if (publicHome.kind === "brand" || publicHome.kind === "external") {
    return <OrganizationBrandHome params={params} />;
  }

  if (publicHome.kind === "visitor-choice") {
    return <OrganizationVisitorChoice params={params} />;
  }

  const publicModel = await getPublicOrganizationReadModel(slug);
  const reputation = publicModel.reputation;

  const publicCapabilities = activePublicBusinessCapabilities(organization.capabilities);
  const hasShop = publicCapabilities.includes("SHOP");
  const hasAppointments = publicCapabilities.includes("APPOINTMENT");
  const href = (path: "/shop" | "/services") => {
    if (isCustomDomain) return buildOrganizationPublicPath({
      locale,
      organizationSlug: organization.slug,
      surface: path === "/shop" ? "shop" : "appointment",
      subPath: path === "/shop" ? "/" : "/services",
      isCustomDomain: true,
    });
    return buildOrganizationPublicPath({
      locale,
      organizationSlug: organization.slug,
      surface: path === "/shop" ? "shop" : "appointment",
      subPath: path === "/shop" ? "/" : "/services",
    });
  };

  return (
    <main className="container mx-auto min-h-screen px-4 py-12">
      <section className="mx-auto max-w-3xl text-center">
        <p className="text-sm text-muted-foreground">بازارباز</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{organization.name}</h1>
        {organization.description && <p className="mt-4 text-muted-foreground">{organization.description}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
          {organization.address && <span>{organization.address}</span>}
          {organization.phone && <a href={`tel:${organization.phone}`}>{organization.phone}</a>}
          {organization.email && <a href={`mailto:${organization.email}`}>{organization.email}</a>}
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
        {hasShop && (
          <Card>
            <CardHeader><ShoppingBag className="h-7 w-7 text-primary" /><CardTitle>فروشگاه</CardTitle><CardDescription>محصولات و سفارش‌های این سازمان</CardDescription></CardHeader>
            <CardContent><Link href={href("/shop")}><Button>مشاهده فروشگاه</Button></Link></CardContent>
          </Card>
        )}
        {hasAppointments && (
          <Card>
            <CardHeader><CalendarDays className="h-7 w-7 text-primary" /><CardTitle>خدمات و نوبت‌دهی</CardTitle><CardDescription>خدمات، رزرو و نوبت‌های این سازمان</CardDescription></CardHeader>
            <CardContent><Link href={href("/services")}><Button>مشاهده خدمات</Button></Link></CardContent>
          </Card>
        )}
        {!hasShop && !hasAppointments && (
          <Card className="md:col-span-2">
            <CardHeader><UserRound className="h-7 w-7 text-primary" /><CardTitle>سازمان فعال است</CardTitle><CardDescription>این سازمان هنوز قابلیت کسب‌وکاری فعالی ندارد. اطلاعات، اعضا و تنظیمات آن همچنان از پنل سازمان قابل مدیریت‌اند.</CardDescription></CardHeader>
          </Card>
        )}
      </section>

      {reputation.reviewCount > 0 && (
        <section className="mx-auto mt-10 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>اعتبار کسب‌وکار</CardTitle>
              <CardDescription>
                امتیاز {reputation.score}/100 · میانگین {reputation.averageRating} از {reputation.reviewCount} نظر تاییدشده
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {reputation.selectedReviews.slice(0, 4).map((review) => (
                <article key={review.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{"★".repeat(review.rating)}</p>
                  {review.title && <p className="mt-2 font-medium">{review.title}</p>}
                  {review.text && <p className="mt-1 text-sm text-muted-foreground">"{review.text}"</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{review.customerLabel}</p>
                </article>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}
