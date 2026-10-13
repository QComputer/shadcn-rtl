import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-guards";
import { getPublicCatalogSnapshot } from "@/lib/public-catalog/service.server";
import RetailPreview from "@/app/[locale]/retail-preview/[store]/retail-preview";

export const dynamic = "force-dynamic";
type Params = { locale: string; organization: string };

async function load(params: Promise<Params>) {
  const { locale, organization } = await params;
  if (locale !== "fa") notFound();
  try { return await getPublicCatalogSnapshot(organization); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const catalog = await load(params);
  return { title: catalog.organization.name, description: catalog.organization.description ?? `محصولات منتشرشده ${catalog.organization.name}` };
}

export default async function PublicRetailStorefront({ params }: { params: Promise<Params> }) {
  const catalog = await load(params);
  return <RetailPreview liveView={{
    identifier: catalog.organization.identifier,
    name: catalog.organization.name,
    description: catalog.organization.description,
    theme: catalog.organization.theme,
    previewOnly: catalog.organization.previewOnly,
    categories: catalog.categories.map((category) => ({ id: category.id, slug: category.slug, name: category.name })),
    products: catalog.products,
  }} />;
}
