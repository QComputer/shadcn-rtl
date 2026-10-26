import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { resolveLegacyProductRedirect } from "@/lib/public-catalog/legacy-product-routing";

export const dynamic = "force-dynamic";

type Params = { locale: string; productId: string };

export default async function LegacyTenantlessProductRoute({ params }: { params: Promise<Params> }) {
  const { locale, productId } = await params;
  const products = await prisma.product.findMany({
    where: {
      OR: [{ id: productId }, { slug: productId }],
      isActive: true,
      deletedAt: null,
      category: { isActive: true, deletedAt: null },
      organization: {
        isActive: true,
        deletedAt: null,
        isPlatformOwner: false,
        OR: [
          { capabilitiesInitializedAt: null, type: "SHOP" },
          { capabilities: { some: { key: "SHOP", status: "ACTIVE" } } },
        ],
      },
    },
    take: 50,
    select: {
      id: true,
      slug: true,
      organizationId: true,
      organization: { select: { id: true, slug: true } },
      category: { select: { organizationId: true } },
    },
  });

  // Product slugs are tenant-scoped. Require a single visible match and an
  // organization-owned category before redirecting a URL with no tenant slug.
  const candidates = products
    .filter((product) => product.organizationId === product.organization.id
      && product.category.organizationId === product.organization.id)
    .map(({ id, slug, organization }) => ({ id, slug, organizationSlug: organization.slug }));
  const destination = resolveLegacyProductRedirect(locale, candidates);
  if (!destination) notFound();
  redirect(destination);
}
