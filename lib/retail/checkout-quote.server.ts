import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { type QuoteInput } from "@/lib/retail/checkout.contract";

const money = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);
const code = (value: string) => value.trim().toUpperCase();
type Tx = Prisma.TransactionClient;
const unitPrice = (product: { basePrice: Prisma.Decimal; discountType: string | null; discountValue: Prisma.Decimal | null }, variantPrice: Prisma.Decimal | null) => {
  const list = variantPrice ?? product.basePrice;
  if (list.lte(0)) throw new ApiError(409, "Product price is invalid.");
  const discount = product.discountValue ?? money(0);
  if (product.discountType === "percentage") return Prisma.Decimal.max(0, list.mul(money(1).sub(Prisma.Decimal.min(discount, 100).div(100))));
  if (product.discountType === "fixed") return Prisma.Decimal.max(0, list.sub(discount));
  return list;
};

export async function createRetailCheckoutQuote(customerId: string, input: QuoteInput) {
  const organization = await prisma.organization.findFirst({ where: { slug: input.organization, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { id: true, slug: true, branding: { select: { retailPreviewOnly: true } } } });
  if (!organization || organization.branding?.retailPreviewOnly) throw new ApiError(404, "Storefront is unavailable.");
  await requireActiveOrganizationCapability({ organizationId: organization.id, capability: "SHOP" });
  const user = await prisma.user.findUnique({ where: { id: customerId }, select: { firstName: true, lastName: true, name: true, phone: true, address: true } });
  const result = await quoteInTransaction(prisma, organization, customerId, input);
  return { quote: { ...result.quote, customer: { name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.name || null, mobile: user?.phone ?? null, address: user?.address ?? null } } };
}

/** Re-evaluates customer/cart/pricing facts without writing coupon, cart, or inventory state. */
export async function quoteInTransaction(tx: Tx, organization: { id: string; slug: string }, customerId: string, input: QuoteInput) {
  const cart = await tx.shopCart.findUnique({
    where: { organizationSlug_customerId: { organizationSlug: organization.slug, customerId } },
    include: { items: { include: { variant: { include: {
      product: true, optionValues: { include: { definition: true } },
    } } } } },
  });
  if (!cart?.items.length) throw new ApiError(409, "Cart is empty.");
  let subtotal = money(0); let hasUnorderable = false;
  const items = [] as Array<{ id: string; variantId: string; quantity: number; unitPrice: number; lineTotal: number; orderable: boolean; reason: string | null }>;
  const facts: unknown[] = [];
  for (const line of cart.items) {
    const variant = line.variant; const product = variant.product;
    let reason: string | null = null;
    if (line.quantity < 1 || !product.isActive || product.deletedAt || variant.deletedAt || product.organizationId !== organization.id || product.organizationSlug !== organization.slug) reason = "unavailable";
    const category = reason ? null : await tx.productCategory.findFirst({ where: { id: product.categoryId, organizationId: organization.id, isActive: true, deletedAt: null }, select: { id: true } });
    if (!reason && !category) reason = "unavailable";
    const price = unitPrice(product, variant.price);
    const available = Math.max(0, variant.inventory - variant.reservedQuantity);
    if (!reason && product.trackInventory && !variant.allowBackOrder && line.quantity > available) reason = "insufficient_stock";
    const orderable = reason === null;
    if (!orderable) hasUnorderable = true;
    subtotal = subtotal.add(price.mul(line.quantity));
    items.push({ id: line.id, variantId: variant.id, quantity: line.quantity, unitPrice: price.toNumber(), lineTotal: price.mul(line.quantity).toNumber(), orderable, reason });
    facts.push([line.id, variant.id, line.quantity, price.toString(), product.trackInventory, variant.inventory, variant.reservedQuantity, variant.allowBackOrder, reason]);
  }
  const settings = await tx.organizationSettings.findUnique({ where: { organizationSlug: organization.slug }, select: { deliveryFee: true, enablePickup: true, enableDelivery: true } });
  const deliveryFeeConfigured = settings?.deliveryFee !== null && settings?.deliveryFee !== undefined;
  const deliveryFee = input.type === "DELIVERY" && deliveryFeeConfigured ? money(settings!.deliveryFee!) : money(0);
  const fulfillmentIssue = input.type === "PICK_UP" && settings?.enablePickup === false
    ? "Customer pickup is unavailable."
    : input.type === "DELIVERY" && settings?.enableDelivery === false
      ? "Delivery is unavailable."
      : input.type === "DELIVERY" && !deliveryFeeConfigured
        ? "Delivery fee is unavailable."
        : !deliveryFee.isFinite() || deliveryFee.lt(0) ? "Delivery fee is unavailable." : null;
  let discount = money(0); let couponIssue: string | null = null; let couponFacts: unknown = null;
  if (input.couponCode) {
    const coupon = await tx.coupon.findUnique({ where: { organizationId_code: { organizationId: organization.id, code: code(input.couponCode) } } });
    if (!coupon) couponIssue = "Discount code was not found.";
    else {
      const usedByCustomer = await tx.couponRedemption.count({ where: { couponId: coupon.id, customerId, releasedAt: null } });
      const now = new Date();
      if (!coupon.isActive || coupon.segmentKey || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now)) couponIssue = "Discount code is unavailable.";
      else if (coupon.minOrderTotal && subtotal.lt(coupon.minOrderTotal)) couponIssue = "Order does not meet the discount minimum.";
      else if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) couponIssue = "Discount usage limit reached.";
      else if (coupon.perCustomerLimit !== null && usedByCustomer >= coupon.perCustomerLimit) couponIssue = "Customer discount limit reached.";
      const raw = coupon.discountType === "PERCENTAGE" ? subtotal.mul(coupon.discountValue).div(100) : coupon.discountValue;
      if (!couponIssue) discount = Prisma.Decimal.max(0, Prisma.Decimal.min(coupon.maxDiscountAmount ? Prisma.Decimal.min(raw, coupon.maxDiscountAmount) : raw, subtotal));
      couponFacts = [coupon.id, coupon.isActive, coupon.usedCount, coupon.usageLimit, usedByCustomer, coupon.perCustomerLimit, coupon.discountType, coupon.discountValue.toString(), coupon.maxDiscountAmount?.toString() ?? null, couponIssue];
    }
  }
  const total = Prisma.Decimal.max(0, subtotal.add(deliveryFee).sub(discount));
  const issues = [...(hasUnorderable ? ["Cart contains unavailable or insufficient-stock items."] : []), ...(couponIssue ? [couponIssue] : []), ...(fulfillmentIssue ? [fulfillmentIssue] : [])];
  const factsHash = createHash("sha256").update(JSON.stringify([organization.id, customerId, input.type, input.deliveryAddress ?? null, input.recipientName ?? null, input.recipientMobile ?? null, input.deliveryNotes ?? null, input.paymentMethod ?? null, input.cashMode ?? null, facts, subtotal.toString(), discount.toString(), deliveryFee.toString(), total.toString(), couponFacts])).digest("base64url");
  return { quote: { reviewToken: factsHash, subtotal: subtotal.toNumber(), discount: discount.toNumber(), deliveryFee: deliveryFee.toNumber(), total: total.toNumber(), currency: "TOMAN" as const,
    items, fulfillment: [ ...(settings?.enablePickup === false ? [] : [{ type: "PICK_UP" as const, label: "Customer pickup", fee: 0 }]), ...(settings?.enableDelivery === false || !deliveryFeeConfigured || !deliveryFee.isFinite() || deliveryFee.lt(0) ? [] : [{ type: "DELIVERY" as const, label: "Delivery", fee: money(settings!.deliveryFee!).toNumber() }]) ], issues } };
}

export function sameReviewToken(expected: string, received: string) { return expected === received; }
