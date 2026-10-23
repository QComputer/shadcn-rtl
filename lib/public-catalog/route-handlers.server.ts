import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { ApiError, requireAuthSession } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { listRetailProductFavorites } from "@/lib/retail/favorites.server";
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
  try {
    const params = request.nextUrl.searchParams;
    const query = publicCatalogListQuerySchema.parse({ ...Object.fromEntries(params), ...(params.has("filter") ? { filter: params.getAll("filter") } : {}) });
    let productIds: string[] | undefined;
    if (query.saved) {
      const session = await requireAuthSession();
      const organization = await prisma.organization.findFirst({ where: { slug: organizationIdentifier, isActive: true, deletedAt: null }, select: { id: true } });
      if (!organization) throw new ApiError(404, "Storefront is unavailable.");
      productIds = await listRetailProductFavorites(organization.id, session.user.id);
    }
    const payload = await listPublicCatalogProducts({ organizationIdentifier, page: query.page, limit: query.limit, category: query.category, tag: query.tag, q: query.q, brand: query.brand, available: query.available, productIds, filter: "filter" in query ? query.filter : undefined, minPrice: query.minPrice, maxPrice: query.maxPrice, sort: query.sort });
    if (query.saved) return new NextResponse(head ? null : JSON.stringify({ version: "v1", data: payload }), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", Vary: "Cookie" } });
    return publicCatalogResponse(request, payload, { head });
  } catch (error) { return publicCatalogError(error); }
}
export async function productHandler(request: NextRequest, context: NestedParams, head = false) {
  const { organizationIdentifier, productIdentifier } = await context.params;
  return respond(request, () => getPublicCatalogProduct(organizationIdentifier, productIdentifier!), head);
}
