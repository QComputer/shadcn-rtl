import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";

interface OrganizationLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: OrganizationLayoutProps): Promise<Metadata> {
  const { locale, slug } = await params;
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/public/organizations/${slug}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return {
        title: "Organization Not Found",
      };
    }
    
    const data = await response.json();
    
    return {
      title: data.organization?.name || "Organization",
      description: data.organization?.description || "Book your appointment",
    };
  } catch {
    return {
      title: "Organization",
    };
  }
}

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const { locale, slug } = await params;
  
  // Validate organization exists and is APPOINTMENT type
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/public/organizations/${slug}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      notFound();
    }
    
    const data = await response.json();
    
    if (data.organization?.type !== "APPOINTMENT") {
      notFound();
    }
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <a href={`/${locale}/organizations/${slug}`} className="font-bold text-xl">
                Logo
              </a>
            </div>
            <div className="flex items-center gap-4">
              <LocaleSwitcher />
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main>
        {children}
      </main>
      
      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} - All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}
