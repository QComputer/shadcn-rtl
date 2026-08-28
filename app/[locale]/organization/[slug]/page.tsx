import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { CalendarDays, ShoppingBag, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/db";
import { buildTenantPublicPath } from "@/lib/custom-domain-routing";
import { activePublicBusinessCapabilities, resolveOrganizationPublicHome } from "@/lib/organization-public-home";
import { getPublicOrganizationReadModel } from "@/lib/public-experience/organization-public-read-model.service";
import { resolveOrganizationBranding } from "@/lib/organization-branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

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

  return {
    title: branding.displayName || organization.name || "Bazar Baz",
    description: organization.description || `${organization.name} on Bazar Baz.`,
    icons: {
      icon: [{ url: branding.favicon }],
      apple: [{ url: branding.appleTouchIcon }],
    },
    openGraph: {
      title: branding.displayName || organization.name || "Bazar Baz",
      description: organization.description || `${organization.name} on Bazar Baz.`,
      images: branding.ogImage ? [{ url: branding.ogImage, width: 1200, height: 630 }] : undefined,
    },
  };
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
      settings: { select: { settings: true } },
    },
  });

  if (!organization) notFound();
  const publicHome = resolveOrganizationPublicHome({
    capabilities: organization.capabilities,
    settings: organization.settings?.settings,
  });
  if (publicHome.kind === "capability") {
    if (isCustomDomain) {
      redirect(buildTenantPublicPath(locale, publicHome.capability === "SHOP" ? "/" : publicHome.publicEntryPath));
    }

    redirect(
      publicHome.capability === "SHOP"
        ? `/${locale}/shop/${organization.slug}`
        : `/${locale}/appointment/${organization.slug}${publicHome.publicEntryPath}`,
    );
  }

  const publicModel = await getPublicOrganizationReadModel(slug);
  const reputation = publicModel.reputation;

  const publicCapabilities = activePublicBusinessCapabilities(organization.capabilities);
  const hasShop = publicCapabilities.includes("SHOP");
  const hasAppointments = publicCapabilities.includes("APPOINTMENT");
  const href = (path: "/shop" | "/services") => {
    if (isCustomDomain) return buildTenantPublicPath(locale, path);
    return path === "/shop"
      ? `/${locale}/shop/${organization.slug}`
      : `/${locale}/appointment/${organization.slug}/services`;
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
