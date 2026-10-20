import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireAuthSession, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { cartService } from "@/lib/services/cart.service";

const inputSchema = z.object({
  organization: z.string().trim().min(1).max(120),
  variantId: z.string().cuid(),
  quantity: z.number().int().positive().max(99),
}).strict();
const updateInputSchema = z.object({
  organization: z.string().trim().min(1).max(120),
  itemId: z.string().cuid(),
  quantity: z.number().int().positive().max(99),
}).strict();
const removeInputSchema = z.object({
  organization: z.string().trim().min(1).max(120),
  itemId: z.string().cuid(),
}).strict();

async function requireStore(slug: string) {
  const organization = await prisma.organization.findFirst({ where: {
    slug, isActive: true, deletedAt: null, isPlatformOwner: false,
  }, select: { id: true, slug: true, branding: { select: { retailPreviewOnly: true } } } });
  if (!organization || organization.branding?.retailPreviewOnly) throw new ApiError(404, "Storefront is unavailable.");
  await requireActiveOrganizationCapability({ organizationId: organization.id, capability: "SHOP" });
  return organization;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const organization = await requireStore(request.nextUrl.searchParams.get("organization")?.trim() ?? "");
    const cart = await cartService.getCart(organization.slug, session.user.id, null);
    return NextResponse.json({ cart }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not load cart."); }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Cart item is invalid.");
    const organization = await requireStore(parsed.data.organization);
    const savedItem = await cartService.addItem(organization.slug, session.user.id, null,
      { variantId: parsed.data.variantId, quantity: parsed.data.quantity });
    const cart = await cartService.getCart(organization.slug, session.user.id, null);
    const item = cart?.items.find((candidate: { id: string }) => candidate.id === savedItem.id) ?? savedItem;
    return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not add product to cart."); }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = updateInputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Cart item is invalid.");
    const organization = await requireStore(parsed.data.organization);
    await cartService.updateItemQuantity(parsed.data.itemId, { quantity: parsed.data.quantity }, session.user.id, null, organization.slug);
    const cart = await cartService.getCart(organization.slug, session.user.id, null);
    const item = cart?.items.find((candidate: { id: string }) => candidate.id === parsed.data.itemId) ?? null;
    return NextResponse.json({ item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not update cart item."); }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const parsed = removeInputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Cart item is invalid.");
    const organization = await requireStore(parsed.data.organization);
    await cartService.removeItem(parsed.data.itemId, session.user.id, null, organization.slug);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not remove cart item."); }
}
