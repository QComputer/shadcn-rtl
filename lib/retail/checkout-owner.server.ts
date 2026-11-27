import "server-only";
import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-guards";
import { cartPrincipal, hasGuestCart, requireCartStore } from "@/lib/retail/cart-access.server";
import { guestOrderScope } from "./guest-order-scope";

// Only server-resolved principals may reach this service. The string form keeps
// the established authenticated service callers compatible. No client owner IDs.
export type RetailCheckoutOwner = string | { guestSessionId: string };
export const guestCheckoutEnabled = () => process.env.RETAIL_GUEST_CHECKOUT_ENABLED === "1";
export const checkoutCustomerId = (owner: RetailCheckoutOwner) => typeof owner === "string" ? owner : null;
export { guestOrderScope } from "./guest-order-scope";
export function checkoutOwnerKey(owner: RetailCheckoutOwner, slug: string) {
  return typeof owner === "string" ? owner : guestOrderScope(slug, owner.guestSessionId);
}
export function checkoutOrderOwner(owner: RetailCheckoutOwner, slug: string): Prisma.OrderWhereInput {
  return typeof owner === "string" ? { customerId: owner } : {
    customerId: null, guestCustomer: { is: { sessionId: { startsWith: guestOrderScope(slug, owner.guestSessionId) } } },
  };
}
export function checkoutCartOwner(owner: RetailCheckoutOwner, slug: string): Prisma.ShopCartWhereInput {
  return typeof owner === "string" ? { organizationSlug: slug, customerId: owner }
    : { organizationSlug: slug, customerId: null, sessionId: owner.guestSessionId };
}
export async function requireCheckoutOwner(request: NextRequest, slug: string, requireMerged = false) {
  const store = await requireCartStore(request, slug);
  const principal = await cartPrincipal(request, store, false);
  if (requireMerged && await hasGuestCart(store.slug, principal)) throw new ApiError(409, "Merge your guest cart before checkout.");
  if (!principal.customerId && !principal.sessionId) throw new ApiError(404, "Checkout access unavailable.");
  const owner: RetailCheckoutOwner = principal.customerId ?? { guestSessionId: principal.sessionId! };
  return { store, owner };
}
export function requireGuestCheckout(owner: RetailCheckoutOwner, input: { couponCode?: string; paymentMethod?: string; recipientName?: string; recipientMobile?: string | null; reviewToken?: string }, placing = false) {
  if (typeof owner === "string") return;
  if (!guestCheckoutEnabled()) throw new ApiError(403, "Guest checkout is not enabled.");
  if (input.couponCode) throw new ApiError(409, "Account discounts require an account.");
  if (input.paymentMethod === "INOTI_USSD") throw new ApiError(409, "This payment method requires an account.");
  if (placing && (!input.recipientName || !input.recipientMobile || !input.reviewToken)) throw new ApiError(400, "Guest contact and a reviewed quote are required.");
}
