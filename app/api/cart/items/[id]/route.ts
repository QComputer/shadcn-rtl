import { NextRequest } from "next/server";
import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { cartService } from "@/lib/services/cart.service";
import { updateCartItemSchema } from "@/lib/validators";
import { cartPrincipal, privateCartJson, requireCartItem, requireCartStore } from "@/lib/retail/cart-access.server";

async function itemScope(request: NextRequest, id: string) {
  const item = await prisma.shopCartItem.findUnique({ where: { id }, select: { cart: { select: { organizationSlug: true } } } });
  if (!item) throw new ApiError(404, "Cart item not found.");
  const organization = await requireCartStore(request, item.cart.organizationSlug);
  const principal = await cartPrincipal(request, organization, false);
  await requireCartItem(organization.slug, id, principal);
  return { organization, principal };
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id } = await params;
    const parsed = updateCartItemSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Cart item is invalid.");
    const { organization, principal } = await itemScope(request, id);
    const item = await cartService.updateItemQuantity(id, parsed.data, principal.customerId, principal.sessionId, organization.slug);
    return privateCartJson(principal, item);
  } catch (error) { return jsonError(error, "Could not update cart item."); }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOriginMutation(request);
    const { id } = await params;
    const { organization, principal } = await itemScope(request, id);
    await cartService.removeItem(id, principal.customerId, principal.sessionId, organization.slug);
    return privateCartJson(principal, { success: true });
  } catch (error) { return jsonError(error, "Could not remove cart item."); }
}
