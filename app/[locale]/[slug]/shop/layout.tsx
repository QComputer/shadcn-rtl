import { CartProvider } from "@/lib/contexts/cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartBadge } from "@/components/shop/cart-badge";
import { Button } from "@/components/ui/button";
import { Metadata } from "next";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { Home, Package, ShoppingCart, ShoppingBasket, User } from "lucide-react";
import prisma from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow/follow-button";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { ShopLocationDialog } from "@/components/shop/shop-location-dialog";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd, buildPublicMetadata } from "@/lib/seo";
import { getShopTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildShopCheckoutPath, buildShopOrderPath, buildShopProductsPath, buildShopPublicPath } from "@/lib/shop-public-paths";
import { TenantFooter } from "@/components/public/tenant-footer";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import { resolveOrganizationBranding } from "@/lib/organization-branding";
import { ShopRouteProvider } from "@/lib/contexts/shop-route-context";
import { OrganizationRootNavigationProvider } from "@/lib/contexts/organization-root-navigation-context";
import { buildOrganizationRootPath } from "@/lib/custom-domain-routing";
import { appResourceUrl } from "@/lib/app-base-path";

interface ShopLayoutProps {
  children: React.ReactNode;
  organizationRootPath?: string;
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ShopLayoutProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const organization = await prisma.organization.findFirst({
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
    });
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

    return buildPublicMetadata({
      locale,
      baseUrl: seoContext.baseUrl,
      path: seoContext.path,
      title: branding.displayName || organization.name || "Bazar Baz shop",
      description: organization.description || "Online shop on Bazar Baz.",
      image: branding.ogImage,
      keywords: ["Bazar Baz", "shop", "online shopping", organization.slug],
      alternatePath: seoContext.alternatePath,
      icons: {
        icon: [{ url: appResourceUrl(branding.favicon) }],
        apple: [{ url: appResourceUrl(branding.appleTouchIcon) }],
      },
    });
  } catch {
    return {
      title: "بازارباز",
    };
  }
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
};

export default async function ShopLayout({ children, params, organizationRootPath }: ShopLayoutProps) {
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

  const navItems = [
    { href: productsHref, label: t("navigation.products") },
    { href: tenantHref("/profile"), label: t("navigation.profile") },
    { href: tenantHref("/fanpage"), label: t("organization.fanpage") },
    { href: checkoutHref, label: t("navigation.checkout") },
  ];

  return (
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
          <div className="container flex h-16 pr-5 pl-2 justify-between ">
            <span className="flex items-center text-lg md:text-xl">
              <Link href={productsHref}>
              {organization?.name}
              </Link>
              </span>

            <nav className="hidden items-center gap-2 text-sm md:flex" aria-label={t("navigation.menu")}>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 ">
              {organization.lat != null && organization.lng != null && (
                <ShopLocationDialog lat={organization.lat} lng={organization.lng} name={organization.name} locale={locale} />
              )}
              <FollowButton organizationId={organization.id} locale={locale} />
              <CartDrawer organizationSlug={slug} locale={locale}>
                <Button variant="ghost" size="icon" className="relative">
                  <CartBadge />
                </Button>
              </CartDrawer>
              <ThemeSwitcher />
            </div>

          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile Navigation - Bottom Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t supports-[backdrop-filter]:bg-background/60">
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
            <CartDrawer organizationSlug={slug} locale={locale}>
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
            name: organization.name || organization.slug,
            slug: organization.slug,
            description: organization.description,
            logo: organization.logo,
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
  );
}
