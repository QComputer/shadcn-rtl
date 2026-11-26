import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, jsonError, requireSameOriginMutation } from "@/lib/api-guards";
import { cartPrincipal, hasGuestCart, privateCartJson, requireCartItem, requireCartStore } from "@/lib/retail/cart-access.server";
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

const mergeInputSchema = z.object({ organization: z.string().trim().min(1).max(120), action: z.literal("merge") }).strict();

export async function GET(request: NextRequest) {
  try {
    const organization = await requireCartStore(request, request.nextUrl.searchParams.get("organization")?.trim() ?? "");
    const principal = await cartPrincipal(request, organization, true);
    const cart = await cartService.getCart(organization.slug, principal.customerId, principal.sessionId);
    return privateCartJson(principal, { cart, mergePending: await hasGuestCart(organization.slug, principal) });
  } catch (error) { return jsonError(error, "Could not load cart."); }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const body: unknown = await request.json();
    const merge = mergeInputSchema.safeParse(body);
    if (merge.success) {
      const organization = await requireCartStore(request, merge.data.organization);
      const principal = await cartPrincipal(request, organization, false);
      if (!principal.customerId) throw new ApiError(401, "Account required for cart merge.");
      const cart = principal.sessionId ? await cartService.mergeToUserCart(organization.slug, principal.customerId, principal.sessionId) : await cartService.getCart(organization.slug, principal.customerId, null);
      return privateCartJson(principal, { cart, mergePending: false });
    }
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Cart item is invalid.");
    const organization = await requireCartStore(request, parsed.data.organization);
    const principal = await cartPrincipal(request, organization, true);
    if (principal.customerId && principal.sessionId) await cartService.mergeToUserCart(organization.slug, principal.customerId, principal.sessionId);
    const savedItem = await cartService.addItem(organization.slug, principal.customerId, principal.sessionId,
      { variantId: parsed.data.variantId, quantity: parsed.data.quantity });
    const cart = await cartService.getCart(organization.slug, principal.customerId, principal.sessionId);
    const item = cart?.items.find((candidate: { id: string }) => candidate.id === savedItem.id) ?? savedItem;
    return privateCartJson(principal, { item }, 201);
  } catch (error) { return jsonError(error, "Could not add product to cart."); }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const parsed = updateInputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Cart item is invalid.");
    const organization = await requireCartStore(request, parsed.data.organization);
    const principal = await cartPrincipal(request, organization, false);
    await requireCartItem(organization.slug, parsed.data.itemId, principal);
    await cartService.updateItemQuantity(parsed.data.itemId, { quantity: parsed.data.quantity }, principal.customerId, principal.sessionId, organization.slug);
    const cart = await cartService.getCart(organization.slug, principal.customerId, principal.sessionId);
    const item = cart?.items.find((candidate: { id: string }) => candidate.id === parsed.data.itemId) ?? null;
    return privateCartJson(principal, { item });
  } catch (error) { return jsonError(error, "Could not update cart item."); }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOriginMutation(request);
    const parsed = removeInputSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Cart item is invalid.");
    const organization = await requireCartStore(request, parsed.data.organization);
    const principal = await cartPrincipal(request, organization, false);
    await requireCartItem(organization.slug, parsed.data.itemId, principal);
    await cartService.removeItem(parsed.data.itemId, principal.customerId, principal.sessionId, organization.slug);
    return privateCartJson(principal, { success: true });
  } catch (error) { return jsonError(error, "Could not remove cart item."); }
}
