import type { ReactNode } from "react";
import { RetailBrandScope } from "@/components/retail/retail-brand-scope";
import { listPublicCatalogCategories } from "@/lib/public-catalog/service.server";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-guards";

export default async function RetailLayout({ children, params }: { children: ReactNode; params: Promise<{ organization: string }> }) {
  const { organization: identifier } = await params;
  try {
    const { organization } = await listPublicCatalogCategories(identifier);
    return <RetailBrandScope color={organization.branding?.storefrontPrimaryColor}>{children}</RetailBrandScope>;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
