import { CartProvider } from "@/lib/contexts/cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartBadge } from "@/components/shop/cart-badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Store } from "lucide-react";
import { Metadata } from "next";


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
    const response = await fetch(`/api/public/organizations/${slug}/shop`, {
      //cache: 'no-store'
    });
    //console.log("------------------shop response:", response);
    
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


export default async function ShopLayout({ children, params }: ShopLayoutProps) {
  const { locale, slug } = await params;

  // Get organization ID from slug

  return (
    <CartProvider locale={locale} slug={slug} >
      <div className="min-h-screen flex flex-col">
        {/* Shop Header */}
        <header className="sticky top-2 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
              <span className="flex gap-3 mx-10 font-semibold ">
              <Store className="h-5 w-5 " />
              </span>

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
            <p>© {new Date().getFullYear()}. تمامی حقوق محفوظ است.</p>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
