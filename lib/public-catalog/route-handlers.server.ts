import "server-only";

import { NextRequest } from "next/server";
import { publicCatalogListQuerySchema } from "@/lib/public-catalog/contracts";
import { publicCatalogError, publicCatalogResponse } from "@/lib/public-catalog/http";
import {
  getPublicCatalogCategory, getPublicCatalogProduct, getPublicCatalogSnapshot,
  listPublicCatalogCategories, listPublicCatalogProducts,
} from "@/lib/public-catalog/service.server";

type OrganizationParams = { params: Promise<{ organizationIdentifier: string }> };
type NestedParams = { params: Promise<{ organizationIdentifier: string; categoryIdentifier?: string; productIdentifier?: string }> };

async function respond(request: NextRequest, load: () => Promise<unknown>, head = false) {
  try { return publicCatalogResponse(request, await load(), { head }); } catch (error) { return publicCatalogError(error); }
}

export async function catalogHandler(request: NextRequest, context: OrganizationParams, head = false) {
  const { organizationIdentifier } = await context.params;
  return respond(request, () => getPublicCatalogSnapshot(organizationIdentifier), head);
}
export async function categoriesHandler(request: NextRequest, context: OrganizationParams, head = false) {
  const { organizationIdentifier } = await context.params;
  return respond(request, async () => (await listPublicCatalogCategories(organizationIdentifier)).categories, head);
}
export async function categoryHandler(request: NextRequest, context: NestedParams, head = false) {
  const { organizationIdentifier, categoryIdentifier } = await context.params;
  return respond(request, () => getPublicCatalogCategory(organizationIdentifier, categoryIdentifier!), head);
}
export async function productsHandler(request: NextRequest, context: OrganizationParams, head = false) {
  const { organizationIdentifier } = await context.params;
  return respond(request, () => {
    const query = publicCatalogListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return listPublicCatalogProducts({ organizationIdentifier, page: query.page, limit: query.limit, category: query.category, q: query.q });
  }, head);
}
export async function productHandler(request: NextRequest, context: NestedParams, head = false) {
  const { organizationIdentifier, productIdentifier } = await context.params;
  return respond(request, () => getPublicCatalogProduct(organizationIdentifier, productIdentifier!), head);
}
