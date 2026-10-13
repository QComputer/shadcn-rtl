import "server-only";

import { randomBytes } from "node:crypto";
import { InventoryMovementReason, OrderType, PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";
import { requireEnabledRetailPaymentMethod } from "@/lib/retail/payment-policy.server";

const money = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);
const code = (value: string) => value.trim().toUpperCase();

export const retailCheckoutInput = z.object({
  organization: z.string().trim().min(1).max(120),
  idempotencyKey: z.string().uuid(),
  type: z.nativeEnum(OrderType),
  deliveryAddress: z.string().trim().min(8).max(500).optional(),
  couponCode: z.string().trim().min(2).max(40).optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "INOTI_USSD"]),
  cashMode: z.enum(["COUNTER", "PICKUP", "COURIER"]).optional(),
}).strict().superRefine((value, context) => {
  if (value.type === "DELIVERY" && !value.deliveryAddress) {
    context.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Delivery address is required." });
  }
  if (value.paymentMethod === "CASH" && !value.cashMode) context.addIssue({ code: "custom", path: ["cashMode"], message: "Cash collection mode is required." });
  if (value.paymentMethod !== "CASH" && value.cashMode) context.addIssue({ code: "custom", path: ["cashMode"], message: "Cash mode is only valid for cash payment." });
});

type CheckoutInput = z.infer<typeof retailCheckoutInput>;
type Tx = Prisma.TransactionClient;

function discountedUnitPrice(product: {
  basePrice: Prisma.Decimal; discountType: string | null; discountValue: Prisma.Decimal | null;
}, variantPrice: Prisma.Decimal | null) {
  const listPrice = variantPrice ?? product.basePrice;
  if (listPrice.lte(0)) throw new ApiError(409, "Product price is invalid.");
  const discount = product.discountValue ?? money(0);
  if (discount.lt(0)) throw new ApiError(409, "Product discount is invalid.");
  if (product.discountType === "percentage") return Prisma.Decimal.max(0, listPrice.mul(money(1).sub(Prisma.Decimal.min(discount, 100).div(100))));
  if (product.discountType === "fixed") return Prisma.Decimal.max(0, listPrice.sub(discount));
  return listPrice;
}

async function consumeCoupon(tx: Tx, input: {
  organizationId: string; customerId: string; couponCode: string; subtotal: Prisma.Decimal;
}) {
  const coupon = await tx.coupon.findUnique({
    where: { organizationId_code: { organizationId: input.organizationId, code: code(input.couponCode) } },
  });
  if (!coupon) throw new ApiError(404, "Discount code was not found.");
  // Lock the coupon row so its global and per-customer limits share one serialization point.
  await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${coupon.id} AND "organizationId" = ${input.organizationId} FOR UPDATE`;
  const current = await tx.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
  const now = new Date();
  if (!current.isActive || current.segmentKey || (current.startsAt && current.startsAt > now) ||
      (current.expiresAt && current.expiresAt < now)) throw new ApiError(409, "Discount code is unavailable.");
  if (current.minOrderTotal && input.subtotal.lt(current.minOrderTotal)) throw new ApiError(409, "Order does not meet the discount minimum.");
  if (current.usageLimit !== null && current.usedCount >= current.usageLimit) throw new ApiError(409, "Discount usage limit reached.");
  const usedByCustomer = await tx.couponRedemption.count({ where: { couponId: current.id, customerId: input.customerId } });
  if (current.perCustomerLimit !== null && usedByCustomer >= current.perCustomerLimit) throw new ApiError(409, "Customer discount limit reached.");
  const raw = current.discountType === "PERCENTAGE"
    ? input.subtotal.mul(current.discountValue).div(100) : current.discountValue;
  const capped = current.maxDiscountAmount ? Prisma.Decimal.min(raw, current.maxDiscountAmount) : raw;
  const discount = Prisma.Decimal.max(0, Prisma.Decimal.min(capped, input.subtotal));
  await tx.coupon.update({ where: { id: current.id }, data: { usedCount: { increment: 1 } } });
  return { coupon: current, discount };
}

export async function createRetailCheckout(customerId: string, input: CheckoutInput) {
  const organization = await prisma.organization.findFirst({
    where: { slug: input.organization, isActive: true, deletedAt: null, isPlatformOwner: false },
    select: { id: true, slug: true, branding: { select: { retailPreviewOnly: true } } },
  });
  if (!organization || organization.branding?.retailPreviewOnly) throw new ApiError(404, "Storefront is unavailable.");
  await requireActiveOrganizationCapability({ organizationId: organization.id, capability: "SHOP" });
  const paymentPolicy = await requireEnabledRetailPaymentMethod(organization.slug, input.paymentMethod);
  if (input.cashMode && !paymentPolicy.cashModes.includes(input.cashMode)) throw new ApiError(409, "Cash collection mode is unavailable.");
  const existing = await prisma.order.findFirst({
    where: { retailCheckoutKey: input.idempotencyKey, organizationSlug: organization.slug, customerId },
    select: { id: true, orderNumber: true, total: true, paymentStatus: true, status: true },
  });
  if (existing) return existing;

  const run = async () => prisma.$transaction(async (tx) => {
    const cart = await tx.shopCart.findUnique({
      where: { organizationSlug_customerId: { organizationSlug: organization.slug, customerId } },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
    if (!cart || cart.items.length === 0) throw new ApiError(409, "Cart is empty.");
    let subtotal = money(0);
    const items: Array<{ variantId: string; productId: string; quantity: number; price: Prisma.Decimal; trackInventory: boolean; allowBackOrder: boolean }> = [];
    for (const line of cart.items) {
      const variant = line.variant;
      const product = variant.product;
      if (line.quantity < 1 || !product.isActive || product.deletedAt || variant.deletedAt ||
          product.organizationId !== organization.id || product.organizationSlug !== organization.slug) {
        throw new ApiError(409, "Cart contains an unavailable product.");
      }
      const category = await tx.productCategory.findFirst({
        where: { id: product.categoryId, organizationId: organization.id, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!category) throw new ApiError(409, "Cart contains an unavailable category.");
      const price = discountedUnitPrice(product, variant.price);
      subtotal = subtotal.add(price.mul(line.quantity));
      items.push({ variantId: variant.id, productId: product.id, quantity: line.quantity,
        price, trackInventory: product.trackInventory, allowBackOrder: variant.allowBackOrder });
    }

    const settings = await tx.organizationSettings.findUnique({ where: { organizationSlug: organization.slug }, select: { deliveryFee: true } });
    const deliveryFee = input.type === "DELIVERY" ? money(settings?.deliveryFee ?? 0) : money(0);
    if (!deliveryFee.isFinite() || deliveryFee.lt(0)) throw new ApiError(409, "Delivery fee is unavailable.");
    const applied = input.couponCode ? await consumeCoupon(tx, {
      organizationId: organization.id, customerId, couponCode: input.couponCode, subtotal,
    }) : null;
    const discount = applied?.discount ?? money(0);
    const total = Prisma.Decimal.max(0, subtotal.add(deliveryFee).sub(discount));
    const order = await tx.order.create({
      data: {
        orderNumber: `RET-${Date.now().toString(36).toUpperCase()}-${randomBytes(5).toString("hex").toUpperCase()}`,
        retailCheckoutKey: input.idempotencyKey,
        type: input.type, status: "PENDING", subtotal, deliveryFee, tax: 0, discount, total,
        deliveryAddress: input.deliveryAddress ?? null, organizationSlug: organization.slug,
        customerId, paymentMethod: input.paymentMethod as PaymentMethod, paymentStatus: "PENDING",
        items: { create: items.map((item) => ({ productId: item.productId, variantId: item.variantId,
          quantity: item.quantity, price: item.price, discount: 0 })) },
      },
      select: { id: true, orderNumber: true, total: true, paymentStatus: true, status: true },
    });
    for (const item of items) {
      if (!item.trackInventory) continue;
      const updated = await tx.$queryRaw<Array<{ inventory: number }>>`
        UPDATE "ProductVariant" SET "inventory" = "inventory" - ${item.quantity}
        WHERE "id" = ${item.variantId} AND "deletedAt" IS NULL
          AND (${item.allowBackOrder} OR "inventory" - "reservedQuantity" >= ${item.quantity})
        RETURNING "inventory"`;
      if (updated.length !== 1) throw new ApiError(409, "Insufficient inventory.");
      await tx.inventoryMovement.create({ data: {
        variantId: item.variantId, orderId: order.id, quantityDelta: -item.quantity,
        quantityBefore: updated[0].inventory + item.quantity, quantityAfter: updated[0].inventory,
        reason: InventoryMovementReason.ORDER_CREATED, createdById: customerId,
        note: "Retail checkout stock reservation",
      } });
    }
    if (applied) await tx.couponRedemption.create({ data: {
      couponId: applied.coupon.id, organizationId: organization.id, customerId, orderId: order.id,
      discountAmount: applied.discount, metadata: { code: applied.coupon.code, source: "RETAIL_CHECKOUT" },
    } });
    await tx.payment.create({ data: { orderId: order.id, method: input.paymentMethod as PaymentMethod, amount: total, status: "PENDING",
      metadata: { retailR4: { cashMode: input.cashMode ?? null, cashBeforeConfirmation: paymentPolicy.cashBeforeConfirmation } } } });
    await tx.paymentEvent.create({ data: { orderId: order.id, previousStatus: null, newStatus: "PENDING",
      method: input.paymentMethod as PaymentMethod, amount: total, createdById: customerId, note: "Retail checkout created" } });
    await tx.orderStatusHistory.create({ data: { orderId: order.id, previousStatus: null,
      newStatus: "PENDING", changedById: customerId, note: "Retail checkout created" } });
    await tx.shopCartItem.deleteMany({ where: { cartId: cart.id } });
    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });

  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await run(); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const previous = await prisma.order.findFirst({ where: {
          retailCheckoutKey: input.idempotencyKey, organizationSlug: organization.slug, customerId,
        }, select: { id: true, orderNumber: true, total: true, paymentStatus: true, status: true } });
        if (previous) return previous;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new ApiError(409, "Checkout is busy. Please retry.");
}
