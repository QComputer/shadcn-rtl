import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import prisma from "@/lib/db";

interface OrganizationLayoutProps {
  children: React.ReactNode;
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
};

async function getAppointmentOrganization(slug: string): Promise<OrganizationLayoutData | null> {
  return prisma.organization.findFirst({
    where: {
      slug,
      type: "APPOINTMENT",
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
    },
  });
}

export async function generateMetadata({ params }: OrganizationLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const organization = await getAppointmentOrganization(slug);

  if (!organization) {
    return {
      title: "Organization Not Found",
    };
  }

  return {
    title: organization.name || "Organization",
    description: organization.description || "Book your appointment",
  };
}

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const { locale, slug } = await params;
  const organization = await getAppointmentOrganization(slug);

  if (!organization) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <a href={`/${locale}/organizations/${organization.slug}`} className="font-bold text-xl">
                {organization.name}
              </a>
            </div>
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

      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} - {"تمامی حقوق محفوظ است"}</p>
        </div>
      </footer>
    </div>
  );
}
