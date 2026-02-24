"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GuestCartProvider } from "@/lib/contexts/guest-cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { CartBadge } from "@/components/shop/cart-badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";

interface ShopLayoutProps {
  children: React.ReactNode;
}

export default function ShopLayout({ children }: ShopLayoutProps) {
  const params = useParams();
  const slug = params.slug as string;
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch organization ID from slug
  useEffect(() => {
    async function fetchOrganization() {
      try {
        const response = await fetch(`/api/public/organizations/${slug}`);
        if (response.ok) {
          const data = await response.json();
          setOrganizationId(data.id);
          setOrganizationName(data.name);
        }
      } catch (error) {
        console.error("Failed to fetch organization:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (slug) {
      fetchOrganization();
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Store className="h-16 w-16 text-muted-foreground/50" />
        <h1 className="text-2xl font-bold">Shop Not Found</h1>
        <p className="text-muted-foreground">
          The shop you're looking for doesn't exist or has been removed.
        </p>
        <Link href="/">
          <Button>
            Go Home
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <GuestCartProvider organizationId={organizationId}>
      <div className="min-h-screen flex flex-col">
        {/* Shop Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between">
            <Link href={`/shop/${slug}`} className="flex items-center gap-2">
              <Store className="h-6 w-6" />
              <span className="font-semibold text-lg">{organizationName}</span>
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
            <p>© {new Date().getFullYear()} {organizationName}. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </GuestCartProvider>
  );
}
