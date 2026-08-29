import type { Metadata } from "next";
import prisma from "@/lib/db";
import { getTenantSeoContext } from "@/lib/custom-domain-seo";
import { buildPublicMetadata } from "@/lib/seo";

type ServicesLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: ServicesLayoutProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const organization = await prisma.organization.findFirst({
    where: { slug, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { name: true, description: true, logo: true, coverImage: true },
  });

  if (!organization) return { title: "Services Not Found" };

  const seoContext = await getTenantSeoContext({
    locale,
    slug,
    organizationType: "APPOINTMENT",
    subPath: "/services",
  });

  return buildPublicMetadata({
    locale,
    baseUrl: seoContext.baseUrl,
    path: seoContext.path,
    title: `Services | ${organization.name}`,
    description: organization.description || `Book services at ${organization.name}.`,
    image: organization.coverImage || organization.logo,
    keywords: ["Bazarbaaz", "services", "appointment", slug],
    alternatePath: seoContext.alternatePath,
  });
}

export default function ServicesLayout({ children }: ServicesLayoutProps) {
  return children;
}
