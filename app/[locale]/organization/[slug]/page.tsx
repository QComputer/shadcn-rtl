import Link from "next/link";
import { headers } from "next/headers";
import { CalendarDays, ShoppingBag, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import { buildTenantPublicPath } from "@/lib/custom-domain-routing";
import { getPublicOrganizationReadModel } from "@/lib/public-experience/organization-public-read-model.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ locale: string; slug: string }> };

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
      type: true,
      capabilitiesInitializedAt: true,
      capabilities: { select: { key: true, status: true } },
    },
  });

  if (!organization) notFound();
  const publicModel = await getPublicOrganizationReadModel(slug);
  const reputation = publicModel.reputation;

  const hasShop = hasOrganizationCapability({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  }, "SHOP");
  const hasAppointments = hasOrganizationCapability({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  }, "APPOINTMENT");
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
