import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import prisma from "@/lib/db";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd, buildPublicMetadata } from "@/lib/seo";
import { TenantFooter } from "@/components/public/tenant-footer";
import { buildOrganizationPublicPath, buildOrganizationRootPath } from "@/lib/custom-domain-routing";
import { getTenantSeoContext } from "@/lib/custom-domain-seo";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import type { CapabilityRecord } from "@/lib/organization-capabilities";
import { resolveOrganizationBranding } from "@/lib/organization-branding";
import { AppointmentRouteProvider } from "@/lib/contexts/appointment-route-context";
import { OrganizationRootNavigationProvider } from "@/lib/contexts/organization-root-navigation-context";
import { appResourceUrl } from "@/lib/app-base-path";

interface OrganizationLayoutProps {
  children: React.ReactNode;
  organizationRootPath?: string;
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
  branding: {
    organizationId: string;
    displayName: string | null;
    shortName: string | null;
    faviconUrl: string | null;
    appleTouchIconUrl: string | null;
    pwaIcon192Url: string | null;
    pwaIcon512Url: string | null;
    ogImageUrl: string | null;
    source: "BAZARBAAZ_MANAGED" | "EXTERNAL_SYNC" | "PLATFORM_FALLBACK" | null;
  } | null;
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
      branding: {
        select: {
          organizationId: true,
          displayName: true,
          shortName: true,
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

  const branding = resolveOrganizationBranding({
    organizationId: organization.id,
    name: organization.name,
    logo: organization.logo,
    coverImage: organization.coverImage,
    branding: organization.branding,
  });

  const seoContext = await getTenantSeoContext({
    locale,
    slug: organization.slug,
    organizationType: "APPOINTMENT",
    subPath: "/",
  });

  return buildPublicMetadata({
    locale,
    baseUrl: seoContext.baseUrl,
    path: seoContext.path,
    title: branding.displayName || organization.name || "Bazarbaaz appointment",
    description: organization.description || "Book appointments online on Bazarbaaz.",
    image: branding.ogImage,
    keywords: ["Bazarbaaz", "appointment", "booking", organization.slug],
    alternatePath: seoContext.alternatePath,
    icons: {
      icon: [{ url: appResourceUrl(branding.favicon) }],
      apple: [{ url: appResourceUrl(branding.appleTouchIcon) }],
    },
  });
}

export default async function OrganizationLayout({ children, params, organizationRootPath }: OrganizationLayoutProps) {
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
  const baseOrganizationPath = buildOrganizationPublicPath({
    locale,
    organizationSlug: organization.slug,
    surface: "appointment",
    isCustomDomain: seoContext.isCustomDomain,
  });
  const tenantHref = (subPath = "/") => subPath === "/"
    ? baseOrganizationPath
    : `${baseOrganizationPath}${subPath.startsWith("/") ? subPath : `/${subPath}`}`;
  const rootHref = organizationRootPath || buildOrganizationRootPath({
    locale,
    organizationSlug: organization.slug,
    isCustomDomain: seoContext.isCustomDomain,
  });
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
          { href: buildOrganizationPublicPath({ locale, organizationSlug: organization.slug, surface: "shop", isCustomDomain: seoContext.isCustomDomain }), label: t("navigation.products") },
        ]),
  ];

  return (
    <OrganizationRootNavigationProvider value={{ href: rootHref, mode: seoContext.organizationRootNavigation }}>
    <AppointmentRouteProvider value={{
      baseHref: baseOrganizationPath,
      organizationRootHref: rootHref,
      isCustomDomain: seoContext.isCustomDomain,
    }}>
    <div className="min-h-screen bg-background">
      <JsonLd
        data={buildOrganizationJsonLd({
          organization,
          path: organizationRootPath || seoContext.path,
          kind: "LocalBusiness",
          baseUrl: seoContext.baseUrl,
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
          servicesHref: hasOrganizationCapability({ legacyType: organization.type, capabilitiesInitializedAt: organization.capabilitiesInitializedAt, capabilities: organization.capabilities }, "APPOINTMENT") ? tenantHref("/services") : null,
          bookingHref: hasOrganizationCapability({ legacyType: organization.type, capabilitiesInitializedAt: organization.capabilitiesInitializedAt, capabilities: organization.capabilities }, "APPOINTMENT") ? tenantHref("/booking") : null,
          poweredByHref: "https://bazarbaaz.ir",
        }}
      />
    </div>
    </AppointmentRouteProvider>
    </OrganizationRootNavigationProvider>
  );
}
