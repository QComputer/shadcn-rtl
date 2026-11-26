import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { checkoutOrderOwner } from "@/lib/retail/checkout-owner.server";
import { normalizeIranianMobile } from "@/lib/integrations/inoti-ussd/parser";

export const GUEST_ORDER_WINDOW_MS = 15 * 60_000;
export const GUEST_ORDER_BROWSER_LIMIT = 3;
export const GUEST_ORDER_CONTACT_LIMIT = 3;
export const GUEST_ORDER_TENANT_LIMIT = 60;

// Invoke only inside the order SERIALIZABLE transaction after idempotent replay lookup.
// Count cancelled/soft-deleted rows too. Do not trust forwarded IP headers or phone as ownership.
export async function assertGuestCheckoutBudget(tx: Pick<Prisma.TransactionClient, "order">, slug: string, owner: { guestSessionId: string }, rawPhone: string, now = new Date()) {
  const phone = normalizeIranianMobile(rawPhone);
  if (!phone) throw new ApiError(400, "Valid guest contact is required.");
  const recent: Prisma.OrderWhereInput = { organizationSlug: slug, customerId: null, guestCustomerId: { not: null }, retailCheckoutKey: { not: null }, createdAt: { gte: new Date(now.getTime() - GUEST_ORDER_WINDOW_MS) } };
  const tenantCount = await tx.order.count({ where: recent });
  const browserCount = await tx.order.count({ where: { ...recent, ...checkoutOrderOwner(owner, slug) } });
  const contactCount = await tx.order.count({ where: { ...recent, guestCustomer: { is: { phone } } } });
  if (tenantCount >= GUEST_ORDER_TENANT_LIMIT || browserCount >= GUEST_ORDER_BROWSER_LIMIT || contactCount >= GUEST_ORDER_CONTACT_LIMIT) {
    throw new ApiError(429, "Too many guest orders. Please contact the store.");
  }
  return phone;
}
