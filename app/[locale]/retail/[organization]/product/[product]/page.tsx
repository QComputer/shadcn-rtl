import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api-guards";
import { getPublicCatalogProduct, getPublicCatalogSnapshot } from "@/lib/public-catalog/service.server";
import RetailPreview from "@/app/[locale]/retail-preview/[store]/retail-preview";

export const dynamic = "force-dynamic";
type Params = { locale: string; organization: string; product: string };

async function load(params: Promise<Params>) {
  const { locale, organization, product } = await params;
  if (locale !== "fa") notFound();
  try {
    const [catalog, detail] = await Promise.all([getPublicCatalogSnapshot(organization), getPublicCatalogProduct(organization, product)]);
    return { catalog, detail };
  } catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); throw error; }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { catalog, detail } = await load(params);
  return { title: `${detail.name} | ${catalog.organization.name}`, description: detail.description ?? detail.name };
}

export default async function PublicRetailProductPage({ params }: { params: Promise<Params> }) {
  const { catalog, detail } = await load(params);
  const products = catalog.products.some((product) => product.id === detail.id) ? catalog.products : [...catalog.products, detail];
  return <RetailPreview liveView={{ identifier: catalog.organization.identifier, name: catalog.organization.name,
    description: catalog.organization.description, theme: catalog.organization.theme,
    previewOnly: catalog.organization.previewOnly,
    categories: catalog.categories.map((category) => ({ id: category.id, slug: category.slug, name: category.name })), products }} productId={detail.slug ?? detail.id} />;
}
