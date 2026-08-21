import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import prisma from "@/lib/db";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd, buildPublicMetadata, getUploadedOrGeneratedSeoImageUrl } from "@/lib/seo";
import { TenantFooter } from "@/components/public/tenant-footer";
import { buildTenantPublicPath } from "@/lib/custom-domain-routing";
import { getTenantSeoContext } from "@/lib/custom-domain-seo";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import type { CapabilityRecord } from "@/lib/organization-capabilities";

interface OrganizationLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

type OrganizationLayoutData = {
  id: string;
  name: string;
  slug: string;
  type: "APPOINTMENT" | "SHOP";
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  coverImage: string | null;
  lat: number | null;
  lng: number | null;
  capabilitiesInitializedAt: Date | null;
  capabilities: CapabilityRecord[];
};

async function getPublicOrganization(slug: string): Promise<OrganizationLayoutData | null> {
  const organization = await prisma.organization.findFirst({
    where: {
      slug,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      address: true,
      phone: true,
      email: true,
      logo: true,
      coverImage: true,
      lat: true,
      lng: true,
      capabilitiesInitializedAt: true,
      capabilities: { select: { key: true, status: true } },
    },
  });
  return organization && hasOrganizationCapability({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  }, "APPOINTMENT")
    ? organization
    : null;
}

export async function generateMetadata({ params }: OrganizationLayoutProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const organization = await getPublicOrganization(slug);

  if (!organization) {
    return {
      title: "Organization Not Found",
    };
  }

  const uploadedShareImage = organization.coverImage || organization.logo;

  return buildPublicMetadata({
    locale,
    path: `/${locale}/appointment/${organization.slug}`,
    title: organization.name || "Bazar Baz appointment",
    description: organization.description || "Book appointments online on Bazar Baz.",
    image: getUploadedOrGeneratedSeoImageUrl(uploadedShareImage, {
      kind: "organization",
      locale,
      title: organization.name || "Bazar Baz appointment",
      subtitle: organization.description || "Book appointments online on Bazar Baz.",
      organizationName: organization.name,
    }),
    keywords: ["Bazar Baz", "appointment", "booking", organization.slug],
    alternatePath: (nextLocale) => `/${nextLocale}/appointment/${organization.slug}`,
  });
}

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const { locale, slug } = await params;
  const organization = await getPublicOrganization(slug);
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);
  if (!organization) {
    notFound();
  }

  const seoContext = await getTenantSeoContext({
    locale,
    slug: organization.slug,
    organizationType: "APPOINTMENT",
    subPath: "/",
  });
  const baseOrganizationPath = `/${locale}/appointment/${organization.slug}`;
  const tenantHref = (subPath = "/") => {
    if (seoContext.isCustomDomain) {
      return buildTenantPublicPath(locale, subPath);
    }

    return `${baseOrganizationPath}${subPath === "/" ? "" : subPath}`;
  };
  const navItems = [
    { href: tenantHref("/"), label: t("navigation.profile") },
    { href: tenantHref("/fanpage"), label: t("organization.fanpage") },
    ...(hasOrganizationCapability({
      legacyType: organization.type,
      capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
      capabilities: organization.capabilities,
    }, "APPOINTMENT")
      ? [
          { href: tenantHref("/services"), label: t("navigation.services") },
          { href: tenantHref("/booking"), label: t("organization.bookNow") },
          { href: tenantHref("/my-appointments"), label: t("navigation.myAppointments") },
        ]
      : [
          { href: `/${locale}/shop/${organization.slug}`, label: t("navigation.products") },
        ]),
  ];

  return (
    <div className="min-h-screen bg-background">
      <JsonLd
        data={buildOrganizationJsonLd({
          organization,
          path: `/${locale}/appointment/${organization.slug}`,
          kind: "LocalBusiness",
        })}
      />
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <a href={tenantHref("/")} className="font-bold text-xl">
                {organization.name}
              </a>
            </div>
            <nav className="hidden items-center gap-2 text-sm md:flex" aria-label={t("navigation.menu")}>
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-4">
              <LocaleSwitcher />
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main>
        {children}
      </main>

      <TenantFooter
        footer={{
          kind: "service",
          locale,
          name: organization.name,
          slug: organization.slug,
          description: organization.description,
          logo: organization.logo,
          address: organization.address,
          phone: organization.phone,
          email: organization.email,
          homeHref: tenantHref("/"),
          profileHref: tenantHref("/"),
          servicesHref: tenantHref("/services"),
          bookingHref: tenantHref("/booking"),
          poweredByHref: "https://bazarbaaz.ir",
        }}
      />
    </div>
  );
}
