import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";

interface OrganizationBrandHomeProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function OrganizationBrandHome({ params }: OrganizationBrandHomeProps) {
  const { locale, slug } = await params;
  const isCustomDomain = (await headers()).get("x-bazar-custom-domain") === "true";

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      logo: true,
      coverImage: true,
      capabilities: {
        where: { status: "ACTIVE" },
        select: { key: true },
      },
      domains: {
        where: { isPrimary: true, status: "ACTIVE" },
        select: { domain: true },
        take: 1,
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const hasShop = organization.capabilities.some((c) => c.key === "SHOP");
  const hasAppointment = organization.capabilities.some((c) => c.key === "APPOINTMENT");
  const primaryDomain = organization.domains[0]?.domain;

  return (
    <div className="min-h-screen bg-background">
      {organization.coverImage && (
        <div className="relative h-48 md:h-64 bg-muted">
          <img
            src={organization.coverImage}
            alt={organization.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
        </div>
      )}
      <section className={`${organization.coverImage ? "-mt-20" : "pt-8"} relative`}>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            {organization.logo && (
              <img
                src={organization.logo}
                alt={organization.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{organization.name}</h1>
              {primaryDomain && (
                <p className="text-muted-foreground">{primaryDomain}</p>
              )}
            </div>
          </div>
          {organization.description && (
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
              {organization.description}
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            {hasShop && (
              <a
                href={buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "shop", isCustomDomain })}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
              >
                فروشگاه
              </a>
            )}
            {hasAppointment && (
              <a
                href={buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "appointment", subPath: "/services", isCustomDomain })}
                className="inline-flex items-center justify-center rounded-md border px-6 py-3 hover:bg-accent"
              >
                رزرو خدمات
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
