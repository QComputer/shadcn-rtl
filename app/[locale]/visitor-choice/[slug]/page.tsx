import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/db";
import { resolveOrganizationBranding } from "@/lib/organization-branding";
import Link from "next/link";

interface VisitorChoicePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: VisitorChoicePageProps): Promise<Metadata> {
  const { slug } = await params;

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      logo: true,
      coverImage: true,
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
    description: `${organization.name} - Choose your experience.`,
    icons: {
      icon: [{ url: branding.favicon }],
      apple: [{ url: branding.appleTouchIcon }],
    },
    openGraph: {
      title: branding.displayName || organization.name || "Bazar Baz",
      description: `${organization.name} - Choose your experience.`,
      images: branding.ogImage ? [{ url: branding.ogImage, width: 1200, height: 630 }] : undefined,
    },
  };
}

export default async function VisitorChoicePage({ params }: VisitorChoicePageProps) {
  const { locale, slug } = await params;

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      name: true,
      capabilities: {
        where: { status: "ACTIVE" },
        select: { key: true },
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const capabilities = organization.capabilities.map((c) => c.key);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">{organization.name}</h1>
          <p className="text-muted-foreground mb-8">لطفاً one of the following options را انتخاب کنید</p>
          <div className="space-y-4">
            {capabilities.includes("SHOP") && (
              <Link
                href={`/${locale}/shop/${slug}`}
                className="block w-full rounded-md bg-primary px-6 py-3 text-center text-primary-foreground hover:bg-primary/90"
              >
                فروشگاه
              </Link>
            )}
            {capabilities.includes("APPOINTMENT") && (
              <Link
                href={`/${locale}/appointment/${slug}/services`}
                className="block w-full rounded-md border px-6 py-3 text-center hover:bg-accent"
              >
                رزرو خدمات
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
