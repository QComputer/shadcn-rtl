import { hasModernRetailProductExperience } from "@/lib/retail/shop-experience";
import { CartProvider } from "@/lib/contexts/cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartBadge } from "@/components/shop/cart-badge";
import { Button } from "@/components/ui/button";
import type { Metadata, Viewport } from "next";
import { cache } from "react";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { Home, ShoppingCart, ShoppingBasket, User } from "lucide-react";
import prisma from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow/follow-button";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { TenantBrand } from "@/components/public/tenant-brand";
import { TenantSearch } from "@/components/public/tenant-search";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd, buildPublicMetadata } from "@/lib/seo";
import { getShopTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildShopCheckoutPath, buildShopOrderPath, buildShopProductsPath, buildShopPublicPath } from "@/lib/shop-public-paths";
import { TenantFooter } from "@/components/public/tenant-footer";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import { resolveOrganizationBranding, resolveTenantPageIcons, resolveTenantPwaBranding } from "@/lib/organization-branding";
import { ShopRouteProvider } from "@/lib/contexts/shop-route-context";
import { OrganizationRootNavigationProvider } from "@/lib/contexts/organization-root-navigation-context";
import { buildOrganizationRootPath } from "@/lib/custom-domain-routing";
import { appResourceUrl } from "@/lib/app-base-path";
import { tenantPwaManifestHref } from "@/lib/tenant-retail-pwa";
import { RetailBrandScope } from "@/components/retail/retail-brand-scope";

export interface ShopLayoutContentProps {
  children: React.ReactNode;
  organizationRootPath?: string;
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

const getShopMetadataOrganization = cache((slug: string) => prisma.organization.findFirst({
      where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        description: true,
        logo: true,
        coverImage: true,
        capabilitiesInitializedAt: true,
        capabilities: { select: { key: true, status: true } },
        settings: { select: { settings: true } },
        branding: true,
      },
    }));

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const organization = await getShopMetadataOrganization(slug);
    if (!organization || !hasOrganizationCapability({
      legacyType: organization.type,
      capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
      capabilities: organization.capabilities,
    }, "SHOP")) {
      return {
        title: "Shop Not Found",
      };
    }

    const seoContext = await getShopTenantSeoContext({ locale, slug: organization.slug, subPath: "/" });

    const branding = resolveOrganizationBranding({
      organizationId: organization.id,
      name: organization.name,
      logo: organization.logo,
      coverImage: organization.coverImage,
      branding: organization.branding,
    });
    const tenantIcons = resolveTenantPageIcons({
      organizationId: organization.id,
      name: organization.name,
      logo: organization.logo,
      branding: organization.branding,
    });

    const publicMetadata = buildPublicMetadata({
      locale,
      baseUrl: seoContext.baseUrl,
      path: seoContext.path,
      title: branding.displayName || organization.name || "Bazarbaaz shop",
      description: organization.description || "Online shop on Bazarbaaz.",
      image: branding.ogImage,
      keywords: ["Bazarbaaz", "shop", "online shopping", organization.slug],
      alternatePath: seoContext.alternatePath,
      icons: {
        icon: tenantIcons.icon.map(({ url }) => ({ url: appResourceUrl(url) })),
        apple: tenantIcons.apple.map(({ url }) => ({ url: appResourceUrl(url) })),
      },
    });
    return organization.branding?.retailPresentationTheme
      ? { ...publicMetadata, manifest: tenantPwaManifestHref({ organizationIdentifier: organization.slug, locale: locale === "en" || locale === "ar" ? locale : "fa", entry: "shop" }) }
      : publicMetadata;
  } catch {
    return {
      title: "بازارباز",
    };
  }
}

export async function generateViewport({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const organization = await getShopMetadataOrganization(slug);
  if (!organization || !hasOrganizationCapability({ legacyType: organization.type, capabilitiesInitializedAt: organization.capabilitiesInitializedAt, capabilities: organization.capabilities }, "SHOP")) return {};
  const branding = resolveTenantPwaBranding({ organizationId: organization.id, name: organization.name, logo: organization.logo, branding: organization.branding });
  return { themeColor: branding.themeColor || "#2F5BFF" };
}

type ShopLayoutOrganization = {
  id: string;
  name: string | null;
  slug: string | null;
  type: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  coverImage: string | null;
  capabilitiesInitializedAt: Date | null;
  capabilities: Array<{ key: "SHOP" | "APPOINTMENT"; status: "ACTIVE" | "INACTIVE" }>;
  settings: { settings: unknown } | null;
  branding: { logoUrl: string | null; displayName: string | null; retailPresentationTheme: string | null; retailPreviewOnly: boolean; storefrontPrimaryColor: string | null } | null;
};

export async function ShopLayoutContent({ children, params, organizationRootPath }: ShopLayoutContentProps) {
  const { locale, slug } = await params;
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);

const organization = await prisma.organization.findFirst({
  where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
  select: {
    id: true, name: true, slug: true, type: true, lat: true, lng: true,
    description: true, address: true, phone: true, email: true, logo: true, coverImage: true,
    capabilitiesInitializedAt: true,
    capabilities: { select: { key: true, status: true } },
    settings: { select: { settings: true } },
    branding: { select: { logoUrl: true, displayName: true, retailPresentationTheme: true, retailPreviewOnly: true, storefrontPrimaryColor: true } },
  },
}) as ShopLayoutOrganization | null;

  if (!organization?.slug || !hasOrganizationCapability({
    legacyType: organization.type as "SHOP" | "APPOINTMENT",
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  }, "SHOP")) {
    notFound();
  }

  const seoContext = await getShopTenantSeoContext({ locale, slug: organization.slug, subPath: "/" });
  const tenantHref = (subPath = "/") =>
    buildShopPublicPath({
      locale,
      shopSlug: organization.slug,
      subPath,
      isCustomDomain: seoContext.isCustomDomain,
    });
  const productsHref = buildShopProductsPath({
    locale,
    shopSlug: organization.slug,
    isCustomDomain: seoContext.isCustomDomain,
  });
  const checkoutHref = buildShopCheckoutPath({
    locale,
    shopSlug: organization.slug,
    isCustomDomain: seoContext.isCustomDomain,
  });
  const routePaths = {
    productsHref,
    checkoutHref,
    orderHrefPrefix: buildShopOrderPath({
      locale,
      shopSlug: organization.slug,
      orderNumber: "",
      isCustomDomain: seoContext.isCustomDomain,
    }),
  };
  const rootHref = organizationRootPath || buildOrganizationRootPath({
    locale,
    organizationSlug: organization.slug,
    isCustomDomain: seoContext.isCustomDomain,
  });

  const catalogSearchEnabled = organization.capabilities.some(capability => capability.key === "SHOP" && capability.status === "ACTIVE");
  const brandName = organization.branding?.displayName?.trim() || organization.name || organization.slug;
  const brandLogo = organization.branding?.logoUrl?.trim() || organization.logo;

  const navItems = [
    { href: productsHref, label: t("navigation.products") },
    { href: tenantHref("/profile"), label: t("navigation.profile") },
    { href: tenantHref("/fanpage"), label: t("organization.fanpage") },
    { href: checkoutHref, label: t("navigation.checkout") },
  ];

  return (
    <RetailBrandScope color={organization.type === "SHOP" ? organization.branding?.storefrontPrimaryColor : null}>
    <CartProvider locale={locale} slug={slug} >
      <OrganizationRootNavigationProvider value={{ href: rootHref, mode: seoContext.organizationRootNavigation }}>
      <ShopRouteProvider value={routePaths}>
        <JsonLd
          data={buildOrganizationJsonLd({
            organization,
            path: organizationRootPath || seoContext.path,
            kind: "Store",
            baseUrl: seoContext.baseUrl,
          })}
        />
        <div className="min-h-screen flex flex-col">
        {/* Shop Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between gap-2 px-3 sm:px-5">
            <TenantBrand name={brandName} logo={brandLogo} href={productsHref} />

            <nav className="hidden items-center gap-1 text-sm lg:flex" aria-label={t("navigation.menu")}>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-2 max-[360px]:gap-0">
              <TenantSearch key={organization.id} locale={locale} name={brandName} organization={catalogSearchEnabled ? organization.slug : undefined} storefrontHref={productsHref} searchHref={catalogSearchEnabled && locale === "fa" ? tenantHref("/discover") : undefined} description={organization.description} address={organization.address} phone={organization.phone} email={organization.email} />
              <FollowButton organizationId={organization.id} locale={locale} className="max-sm:h-11 max-sm:w-11 max-sm:shrink-0 max-sm:p-0 max-sm:text-[0px] max-sm:[&_svg]:m-0 max-sm:[&_svg]:h-5 max-sm:[&_svg]:w-5" />
              <CartDrawer retail={hasModernRetailProductExperience(organization.settings?.settings, organization.branding ?? {})} organizationSlug={slug} locale={locale}>
                <Button variant="ghost" size="icon" className="relative">
                  <CartBadge />
                </Button>
              </CartDrawer>
              <ThemeSwitcher />
            </div>

          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-16 lg:pb-0">
          {children}
        </main>

        {/* Mobile Navigation - Bottom Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t supports-[backdrop-filter]:bg-background/60">
          <div className="grid grid-cols-5 h-16">
            <Link
              href={productsHref}
              className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Home className="h-5 w-5" />
              <span>{t("navigation.products")}</span>
            </Link>
            <Link
              href={tenantHref("/profile")}
              className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <User className="h-5 w-5" />
              <span>{t("navigation.profile")}</span>
            </Link>
            <Link
              href={tenantHref("/fanpage")}
              className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ShoppingBasket className="h-5 w-5" />
              <span>{t("organization.fanpage")}</span>
            </Link>
            <Link
              href={checkoutHref}
              className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ShoppingCart className="h-5 w-5" />
              <span>{t("navigation.checkout")}</span>
            </Link>
            <CartDrawer retail={hasModernRetailProductExperience(organization.settings?.settings, organization.branding ?? {})} organizationSlug={slug} locale={locale}>
              <button className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
                <ShoppingCart className="h-5 w-5" />
                <span>{t("navigation.cart") || "سبد"}</span>
              </button>
            </CartDrawer>
          </div>
        </nav>
        <TenantFooter
          footer={{
            kind: "shop",
            locale,
            name: brandName,
            slug: organization.slug,
            description: organization.description,
            logo: brandLogo,
            address: organization.address,
            phone: organization.phone,
            email: organization.email,
            homeHref: productsHref,
            profileHref: tenantHref("/profile"),
            cartHref: checkoutHref,
            poweredByHref: "https://bazarbaaz.ir",
          }}
        />
        </div>
      </ShopRouteProvider>
      </OrganizationRootNavigationProvider>
    </CartProvider>
    </RetailBrandScope>
  );
}
