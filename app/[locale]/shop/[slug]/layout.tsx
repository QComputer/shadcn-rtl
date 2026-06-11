import { CartProvider } from "@/lib/contexts/cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartBadge } from "@/components/shop/cart-badge";
import { Button } from "@/components/ui/button";
import { Metadata } from "next";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import prisma from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow/follow-button";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { ShopLocationDialog } from "@/components/shop/shop-location-dialog";

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
  select: {name: true, slug: true, description: true}
})
    if (!organization) {
      return {
        title: "Shop Not Found",
      };
    }
    
    return {
      title: organization?.name || "بازارباز",
      description: organization.description || "خرید آنلاین",
      icons:{
         icon: [
        { url: '/globe.svg', type: 'image/svg', sizes: '192x192' },
      ],
    }
    };
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
};

export default async function ShopLayout({ children, params }: ShopLayoutProps) {
  const { locale, slug } = await params;
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);

const organization = await prisma.organization.findFirst({
  where: { slug, type: "SHOP", isActive: true, deletedAt: null },
  select: { id: true, name: true, slug: true, type: true, lat: true, lng: true },
}) as ShopLayoutOrganization | null;

  if (!organization?.slug) {
    notFound();
  }

  const navItems = [
    { href: `/${locale}/shop/${organization.slug}`, label: t("navigation.products") },
    { href: `/${locale}/organizations/${organization.slug}/fanpage`, label: t("organization.fanpage") },
    { href: `/${locale}/shop/${organization.slug}/checkout`, label: t("navigation.checkout") },
  ];

  return (
    <CartProvider locale={locale} slug={slug} >
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
        <main className="flex-1">
          {children}
        </main>

        {/* Shop Footer */}
        <footer className="border-t py-6 hidden">
          <div className="container text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()}. تمامی حقوق محفوظ است.</p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}