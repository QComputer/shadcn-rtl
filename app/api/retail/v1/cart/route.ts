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
    const item = await cartService.addItem(organization.slug, session.user.id, null,
      { variantId: parsed.data.variantId, quantity: parsed.data.quantity });
    return NextResponse.json({ item }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error, "Could not add product to cart."); }
}
