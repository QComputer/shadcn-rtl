import { CartProvider } from "@/lib/contexts/cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartBadge } from "@/components/shop/cart-badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Store } from "lucide-react";
import { Metadata } from "next";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import prisma from "@/lib/db";
import Link from "next/link";


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
    //console.log("------------------shop organization:", organization);
    
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


export default async function ShopLayout({ children, params }: ShopLayoutProps) {
  const { locale, slug } = await params;

const organization = await prisma.organization.findUnique({
  where: { slug},
  select: {name: true, slug: true}
})

  // Get organization ID from slug

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

            <div className="flex items-center gap-2 ">
              <CartDrawer organizationSlug={slug}>
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
