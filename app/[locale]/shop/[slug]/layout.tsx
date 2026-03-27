import { CartProvider } from "@/lib/contexts/cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartBadge } from "@/components/shop/cart-badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";
import { Metadata } from "next";
import prisma from "@/lib/db";

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
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/public/organizations/${slug}/shop`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return {
        title: "Shop Not Found",
      };
    }
    
    const data = await response.json();
    
    return {
      title: data.organization?.name || "Shop",
      description: data.organization?.description || "Shop online",
    };
  } catch {
    return {
      title: "Shop",
    };
  }
}

async function getOrganization(slug: string){
  const shop = await prisma.organization.findUnique({
    where: { slug },
  });
  const id = await shop?.id as string
  const name = await shop?.name as string
  return {id, name}
}

export default async function ShopLayout({ children, params }: ShopLayoutProps) {
  const { locale, slug } = await params;

  // Fetch organization ID from slug
  const shopData = await getOrganization(slug)

  return (
    <CartProvider organizationId={shopData.id}>
      <div className="min-h-screen flex flex-col">
        {/* Shop Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <Link href={`/shop/${slug}`} className="flex items-center gap-2 px-2">
              <Store className="h-6 w-6 " />
              <span className="font-semibold text-lg">{shopData.name}</span>
            </Link>

            <div className="flex items-center gap-4">
              <CartDrawer organizationSlug={slug}>
                <Button variant="ghost" size="icon" className="relative">
                  <CartBadge />
                </Button>
              </CartDrawer>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Shop Footer */}
        <footer className="border-t py-6">
          <div className="container text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} {shopData.name}. تمامی حقوق محفوظ است.</p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
