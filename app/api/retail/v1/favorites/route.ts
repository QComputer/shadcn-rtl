import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import {
  addRetailProductFavorite,
  isMissingRetailFavoritesTable,
  listRetailProductFavorites,
  removeRetailProductFavorite,
} from "@/lib/retail/favorites.server";

const inputSchema = z.object({
  organization: z.string().trim().min(1).max(120),
  productId: z.string().cuid(),
}).strict();

async function requireStore(slug: string) {
  const organization = await prisma.organization.findFirst({ where: {
    slug, isActive: true, deletedAt: null, isPlatformOwner: false,
  }, select: { id: true, slug: true, branding: { select: { retailPreviewOnly: true } } } });
  if (!organization || organization.branding?.retailPreviewOnly) throw new ApiError(404, "Storefront is unavailable.");
  await requireActiveOrganizationCapability({ organizationId: organization.id, capability: "SHOP" });
  return organization;
}

function configurationRequiredResponse() {
  return NextResponse.json({ productIds: [], favoritesAvailable: false, configurationRequired: true }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const organization = await requireStore(request.nextUrl.searchParams.get("organization")?.trim() ?? "");
    try {
      const productIds = await listRetailProductFavorites(organization.id, session.user.id);
      return NextResponse.json({ productIds, favoritesAvailable: true }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      if (isMissingRetailFavoritesTable(error)) return configurationRequiredResponse();
      throw error;
    }
  } catch (error) { return jsonError(error, "Could not load saved products."); }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Favorite is invalid.");
    const organization = await requireStore(parsed.data.organization);
    await addRetailProductFavorite(organization.id, session.user.id, parsed.data.productId);
    return NextResponse.json({ success: true, favorited: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, "Could not save product."); }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Favorite is invalid.");
    const organization = await requireStore(parsed.data.organization);
    await removeRetailProductFavorite(organization.id, session.user.id, parsed.data.productId);
    return NextResponse.json({ success: true, favorited: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error, "Could not remove saved product."); }
}
