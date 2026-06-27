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

interface ShopLayoutProps {
  children: React.ReactNode;
   params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ShopLayoutProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
const organization = await prisma.organization.findUnique({
  where: { slug, type: "SHOP"},
  select: {name: true, slug: true, description: true, logo: true, coverImage: true}
})
    if (!organization) {
      return {
        title: "Shop Not Found",
      };
    }

    return buildPublicMetadata({
      locale,
      path: `/${locale}/shop/${organization.slug}`,
      title: organization.name || "Bazar Baz shop",
      description: organization.description || "Online shop on Bazar Baz.",
      image: organization.coverImage || organization.logo,
      keywords: ["Bazar Baz", "shop", "online shopping", organization.slug],
      alternatePath: (nextLocale) => `/${nextLocale}/shop/${organization.slug}`,
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
};

export default async function ShopLayout({ children, params }: ShopLayoutProps) {
  const { locale, slug } = await params;
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);

const organization = await prisma.organization.findFirst({
  where: { slug, type: "SHOP", isActive: true, deletedAt: null },
  select: { id: true, name: true, slug: true, type: true, lat: true, lng: true, description: true, address: true, phone: true, email: true, logo: true, coverImage: true },
}) as ShopLayoutOrganization | null;

  if (!organization?.slug) {
    notFound();
  }

  const navItems = [
    { href: `/${locale}/shop/${organization.slug}`, label: t("navigation.products") },
    { href: `/${locale}/shop/${organization.slug}/profile`, label: t("navigation.profile") },
    { href: `/${locale}/shop/${organization.slug}/fanpage`, label: t("organization.fanpage") },
    { href: `/${locale}/shop/${organization.slug}/checkout`, label: t("navigation.checkout") },
  ];

  return (
    <CartProvider locale={locale} slug={slug} >
      <JsonLd
        data={buildOrganizationJsonLd({
          organization,
          path: `/${locale}/shop/${organization.slug}`,
          kind: "Store",
        })}
      />
      <div className="min-h-screen flex flex-col">
        {/* Shop Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 pr-5 pl-2 justify-between ">
            <span className="flex items-center text-lg md:text-xl">
              <Link href={`/${locale}/shop/${organization?.slug}`}>              
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
              href={`/${locale}/shop/${organization.slug}`}
              className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Home className="h-5 w-5" />
              <span>{t("navigation.products")}</span>
            </Link>
            <Link
              href={`/${locale}/shop/${organization.slug}/profile`}
              className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <User className="h-5 w-5" />
              <span>{t("navigation.profile")}</span>
            </Link>
            <Link
              href={`/${locale}/shop/${organization.slug}/fanpage`}
              className="flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ShoppingBasket className="h-5 w-5" />
              <span>{t("organization.fanpage")}</span>
            </Link>
            <Link
              href={`/${locale}/shop/${organization.slug}/checkout`}
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
      </div>
    </CartProvider>
  );
}
