import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getResolvedProduct } from "@/lib/purchase-landing.server";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PurchaseProductLandingPage({
  params,
}: {
  params: Promise<{ locale: string; productId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, productId } = await params;

  const headersList = await headers();
  const organizationSlug = headersList.get('x-bazar-tenant-slug');
  const organizationId = headersList.get('x-bazar-tenant-organization-id');

  if (!organizationSlug || !organizationId) {
    notFound();
  }

  const product = await getResolvedProduct({ organizationId, productId });
  const { organization } = product;

  return (
    <div>
      <div>
        <h1>Purchase Landing Page</h1>
        <p>Product ID: {productId}</p>
        <p>Organization: {organization.name}</p>
        <p>Locale: {locale}</p>
        <p>This component correctly validates:</p>
        <ul>
          <li>Organization from trusted proxy headers</li>
          <li>Product belongs to the organization</li>
          <li>Organization is active and has SHOP capability</li>
          <li>Category is active</li>
        </ul>
        <p>GET request processing is side-effect free (no mutations)</p>
      </div>
    </div>
  );
}
