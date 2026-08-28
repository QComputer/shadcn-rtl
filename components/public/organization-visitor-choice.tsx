import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { headers } from "next/headers";
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing";

interface OrganizationVisitorChoiceProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function OrganizationVisitorChoice({ params }: OrganizationVisitorChoiceProps) {
  const { locale, slug } = await params;
  const isCustomDomain = (await headers()).get("x-bazar-custom-domain") === "true";

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      name: true,
      capabilities: {
        where: { status: "ACTIVE" },
        select: { key: true },
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const capabilities = organization.capabilities.map((c) => c.key);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">{organization.name}</h1>
          <p className="text-muted-foreground mb-8">لطفاً one of the following options را انتخاب کنید</p>
          <div className="space-y-4">
            {capabilities.includes("SHOP") && (
              <Link
                href={buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "shop", isCustomDomain })}
                className="block w-full rounded-md bg-primary px-6 py-3 text-center text-primary-foreground hover:bg-primary/90"
              >
                فروشگاه
              </Link>
            )}
            {capabilities.includes("APPOINTMENT") && (
              <Link
                href={buildOrganizationPublicPath({ locale, organizationSlug: slug, surface: "appointment", subPath: "/services", isCustomDomain })}
                className="block w-full rounded-md border px-6 py-3 text-center hover:bg-accent"
              >
                رزرو خدمات
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
