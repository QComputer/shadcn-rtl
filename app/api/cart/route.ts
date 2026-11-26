import { NextRequest } from "next/server";
import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { cartService } from "@/lib/services/cart.service";
import { addToCartSchema } from "@/lib/validators";
import { cartPrincipal, hasGuestCart, privateCartJson, requireCartStore } from "@/lib/retail/cart-access.server";

export async function GET(request: NextRequest) {
  try {
    const organization = await requireCartStore(request, request.nextUrl.searchParams.get("organizationSlug") ?? "");
    const principal = await cartPrincipal(request, organization, true);
    const cart = await cartService.getCart(organization.slug, principal.customerId, principal.sessionId);
    return privateCartJson(principal, cart, 200, await hasGuestCart(organization.slug, principal));
  } catch (error) { return jsonError(error, "Could not load cart."); }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const body = await request.json();
    const parsed = addToCartSchema.safeParse(body);
    if (!parsed.success || typeof body.organizationSlug !== "string") throw new ApiError(400, "Cart item is invalid.");
    const organization = await requireCartStore(request, body.organizationSlug);
    const principal = await cartPrincipal(request, organization, true);
    if (principal.customerId && principal.sessionId) await cartService.mergeToUserCart(organization.slug, principal.customerId, principal.sessionId);
    const item = await cartService.addItem(organization.slug, principal.customerId, principal.sessionId, parsed.data);
    return privateCartJson(principal, item, 201);
  } catch (error) { return jsonError(error, "Could not add product to cart."); }
}
export async function DELETE(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const organization = await requireCartStore(request, request.nextUrl.searchParams.get("organizationSlug") ?? "");
    const principal = await cartPrincipal(request, organization, false);
    await cartService.clearCart(organization.slug, principal.customerId, principal.sessionId);
    return privateCartJson(principal, { success: true });
  } catch (error) { return jsonError(error, "Could not clear cart."); }
}
