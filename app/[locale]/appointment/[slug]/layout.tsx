import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/ui/locale-switcher";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import prisma from "@/lib/db";
import { getDictionary, getDictValue } from "@/lib/dictionary";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd, buildPublicMetadata, getUploadedOrGeneratedSeoImageUrl } from "@/lib/seo";

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
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  coverImage: string | null;
  lat: number | null;
  lng: number | null;
};

async function getPublicOrganization(slug: string): Promise<OrganizationLayoutData | null> {
  return prisma.organization.findFirst({
    where: {
      slug,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      address: true,
      phone: true,
      email: true,
      logo: true,
      coverImage: true,
      lat: true,
      lng: true,
    },
  });
}

export async function generateMetadata({ params }: OrganizationLayoutProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const organization = await getPublicOrganization(slug);

  if (!organization) {
    return {
      title: "Organization Not Found",
    };
  }

  const uploadedShareImage = organization.coverImage || organization.logo;

  return buildPublicMetadata({
    locale,
    path: `/${locale}/appointment/${organization.slug}`,
    title: organization.name || "Bazar Baz appointment",
    description: organization.description || "Book appointments online on Bazar Baz.",
    image: getUploadedOrGeneratedSeoImageUrl(uploadedShareImage, {
      kind: "organization",
      locale,
      title: organization.name || "Bazar Baz appointment",
      subtitle: organization.description || "Book appointments online on Bazar Baz.",
      organizationName: organization.name,
    }),
    keywords: ["Bazar Baz", "appointment", "booking", organization.slug],
    alternatePath: (nextLocale) => `/${nextLocale}/appointment/${organization.slug}`,
  });
}

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const { locale, slug } = await params;
  const organization = await getPublicOrganization(slug);
  const dict = getDictionary(locale);
  const t = (key: string) => getDictValue(dict, key);
  if (!organization) {
    notFound();
  }

  const baseOrganizationPath = `/${locale}/appointment/${organization.slug}`;
  const navItems = [
    { href: baseOrganizationPath, label: t("navigation.profile") },
    { href: `${baseOrganizationPath}/fanpage`, label: t("organization.fanpage") },
    ...(organization.type === "APPOINTMENT"
      ? [
          { href: `${baseOrganizationPath}/services`, label: t("navigation.services") },
          { href: `${baseOrganizationPath}/booking`, label: t("organization.bookNow") },
          { href: `${baseOrganizationPath}/my-appointments`, label: t("navigation.myAppointments") },
        ]
      : [
          { href: `/${locale}/shop/${organization.slug}`, label: t("navigation.products") },
        ]),
  ];

  return (
    <div className="min-h-screen bg-background">
      <JsonLd
        data={buildOrganizationJsonLd({
          organization,
          path: `/${locale}/appointment/${organization.slug}`,
          kind: "LocalBusiness",
        })}
      />
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <a href={`/${locale}/appointment/${organization.slug}`} className="font-bold text-xl">
                {organization.name}
              </a>
            </div>
            <nav className="hidden items-center gap-2 text-sm md:flex" aria-label={t("navigation.menu")}>
              {navItems.map((item) => (
                <a key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  {item.label}
                </a>
              ))}
            </nav>
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
