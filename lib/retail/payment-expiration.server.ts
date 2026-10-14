import "server-only";

import { InventoryMovementReason, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient;
type RetailReleaseReason = "CANCELLED" | "EXPIRED";

export async function releaseRetailCouponReservationsTx(tx: Tx, orderId: string, organizationId: string, now: Date) {
  const redemptions = await tx.couponRedemption.findMany({
    where: { orderId, organizationId, releasedAt: null },
    select: { couponId: true },
    orderBy: { couponId: "asc" },
  });
  for (const couponId of [...new Set(redemptions.map((redemption) => redemption.couponId))]) {
    await tx.$queryRaw`SELECT "id" FROM "Coupon" WHERE "id" = ${couponId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    const current = await tx.couponRedemption.findMany({
      where: { orderId, organizationId, couponId, releasedAt: null },
      select: { id: true, pointsSpent: true, metadata: true },
    });
    const redemptionIds = current.filter((redemption) => {
      const metadata = redemption.metadata;
      return redemption.pointsSpent === 0 && metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
        (metadata as Prisma.JsonObject).source === "RETAIL_CHECKOUT";
    }).map((redemption) => redemption.id);
    if (!redemptionIds.length) continue;
    const released = await tx.couponRedemption.updateMany({
      where: { id: { in: redemptionIds }, orderId, organizationId, couponId, releasedAt: null },
      data: { releasedAt: now },
    });
    if (!released.count) continue;
    const decremented = await tx.coupon.updateMany({
      where: { id: couponId, organizationId, usedCount: { gte: released.count } },
      data: { usedCount: { decrement: released.count } },
    });
    if (decremented.count !== 1) throw new Error("RETAIL_COUPON_RESERVATION_ACCOUNTING_MISMATCH");
  }
}

export async function restoreRetailInventoryTx(tx: Tx, input: {
  orderId: string; organizationId: string; reason: RetailReleaseReason; actorUserId?: string | null; now?: Date;
}) {
  const now = input.now ?? new Date();
  const reservations = await tx.inventoryMovement.groupBy({
    by: ["variantId"],
    where: { orderId: input.orderId, reason: InventoryMovementReason.ORDER_CREATED, quantityDelta: { lt: 0 } },
    orderBy: { variantId: "asc" },
    _sum: { quantityDelta: true },
  });
  for (const reservation of reservations) {
    const quantity = Math.abs(reservation._sum.quantityDelta ?? 0);
    if (quantity < 1) continue;
    const retailReleaseKey = `retail-release:${input.orderId}:${reservation.variantId}`;
    const alreadyReleased = await tx.inventoryMovement.findUnique({
      where: { retailReleaseKey },
      select: { id: true },
    });
    if (alreadyReleased) continue;
    const variants = await tx.$queryRaw<Array<{ inventory: number }>>`
      UPDATE "ProductVariant" AS variant
      SET "inventory" = variant."inventory" + ${quantity}
      WHERE variant."id" = ${reservation.variantId}
        AND EXISTS (SELECT 1 FROM "Product" product WHERE product."id" = variant."productId" AND product."organizationId" = ${input.organizationId})
      RETURNING variant."inventory"
    `;
    if (variants.length !== 1) throw new Error("RETAIL_INVENTORY_TENANT_MISMATCH");
    const inventory = variants[0]!.inventory;
    await tx.inventoryMovement.create({ data: {
      variantId: reservation.variantId,
      orderId: input.orderId,
      quantityDelta: quantity,
      quantityBefore: inventory - quantity,
      quantityAfter: inventory,
      reason: InventoryMovementReason.ORDER_CANCELLED,
      retailReleaseKey,
      createdById: input.actorUserId ?? null,
      note: input.reason === "EXPIRED" ? "Retail stock released after unpaid order expiry" : "Retail stock released after cancellation",
      createdAt: now,
    } });
  }
}

async function expireRetailOrderTx(tx: Tx, orderId: string, now: Date) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, organizationSlug: true, retailCheckoutKey: true,
      retailPaymentDeadlineAt: true, retailPaymentExpiredAt: true, status: true, paymentStatus: true,
      paymentMethod: true, organization: { select: { id: true } } },
  });
  if (!order || !order.retailCheckoutKey || !order.retailPaymentDeadlineAt || order.retailPaymentDeadlineAt > now ||
      order.retailPaymentExpiredAt || order.paymentStatus !== PaymentStatus.PENDING ||
      order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED ||
      order.status === OrderStatus.PICKED_UP || order.status === OrderStatus.DELIVERED) {
    return false;
  }

  const [pendingReports, approvedReports, completedPayments, paidRequests, verifiedIntents, verifiedAttempts] = await Promise.all([
    tx.retailPaymentReport.count({ where: { orderId, status: "PENDING_REVIEW" } }),
    tx.retailPaymentReport.count({ where: { orderId, status: "APPROVED" } }),
    tx.payment.count({ where: { orderId, status: "COMPLETED" } }),
    tx.paymentRequest.count({ where: { orderId, organizationId: order.organization.id, status: "PAID" } }),
    tx.ussdPaymentIntent.count({ where: { orderId, organizationId: order.organization.id, status: { in: ["VERIFIED", "SETTLED"] } } }),
    tx.paymentProviderAttempt.count({ where: { organizationId: order.organization.id, verifiedAt: { not: null }, paymentRequest: { orderId } } }),
  ]);
  if (pendingReports || approvedReports || completedPayments || paidRequests || verifiedIntents || verifiedAttempts) return false;

  const claimed = await tx.order.updateMany({
    where: { id: orderId, retailCheckoutKey: { not: null }, retailPaymentDeadlineAt: { lte: now },
      retailPaymentExpiredAt: null, paymentStatus: PaymentStatus.PENDING,
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED, OrderStatus.PICKED_UP, OrderStatus.DELIVERED] } },
    data: { status: OrderStatus.CANCELLED, retailPaymentExpiredAt: now },
  });
  if (claimed.count !== 1) return false;

  await tx.paymentRequest.updateMany({
    where: { orderId, organizationId: order.organization.id, status: { in: ["CREATED", "AWAITING_CUSTOMER", "PENDING_VERIFICATION", "FAILED"] } },
    data: { status: "EXPIRED", expiresAt: order.retailPaymentDeadlineAt },
  });
  await releaseRetailCouponReservationsTx(tx, orderId, order.organization.id, now);
  await restoreRetailInventoryTx(tx, { orderId, organizationId: order.organization.id, reason: "EXPIRED", now });
  await tx.orderStatusHistory.create({ data: {
    orderId, previousStatus: order.status, newStatus: OrderStatus.CANCELLED,
    note: "Unpaid retail order expired; payment evidence remains available for reconciliation",
  } });
  await tx.auditLog.create({ data: {
    action: "CHANGE_STATUS", entityType: "RetailOrderPaymentDeadline", entityId: orderId,
    description: "Unpaid retail order expired and its stock and coupon reservation were released",
    previousValue: { orderStatus: order.status, paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod, deadlineAt: order.retailPaymentDeadlineAt.toISOString() },
    newValue: { orderStatus: OrderStatus.CANCELLED, paymentStatus: order.paymentStatus, expiredAt: now.toISOString() },
    organizationId: order.organization.id, organizationSlug: order.organizationSlug,
  } });
  return true;
}

export async function expireDueRetailPaymentOrders(input: { now?: Date; limit?: number; organizationId?: string } = {}) {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const outcome = await prisma.$transaction(async (tx) => {
    const due = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT o."id"
      FROM "Order" o
      JOIN "Organization" org ON org."slug" = o."organizationSlug"
      WHERE o."retailCheckoutKey" IS NOT NULL
        AND o."retailPaymentDeadlineAt" <= ${now}
        AND o."retailPaymentExpiredAt" IS NULL
        AND o."paymentStatus" = 'PENDING'
        AND o."status" NOT IN ('CANCELLED', 'REFUNDED', 'PICKED_UP', 'DELIVERED')
        AND (${input.organizationId ?? null}::text IS NULL OR org."id" = ${input.organizationId ?? null})
        AND NOT EXISTS (SELECT 1 FROM "RetailPaymentReport" r WHERE r."orderId" = o."id" AND r."status" = 'PENDING_REVIEW')
        AND NOT EXISTS (SELECT 1 FROM "RetailPaymentReport" r WHERE r."orderId" = o."id" AND r."status" = 'APPROVED')
        AND NOT EXISTS (SELECT 1 FROM "Payment" pay WHERE pay."orderId" = o."id" AND pay."status" = 'COMPLETED')
        AND NOT EXISTS (SELECT 1 FROM "PaymentRequest" p WHERE p."orderId" = o."id" AND p."organizationId" = org."id" AND p."status" = 'PAID')
        AND NOT EXISTS (SELECT 1 FROM "UssdPaymentIntent" i WHERE i."orderId" = o."id" AND i."organizationId" = org."id" AND i."status" IN ('VERIFIED', 'SETTLED'))
        AND NOT EXISTS (SELECT 1 FROM "PaymentProviderAttempt" a JOIN "PaymentRequest" p ON p."id" = a."paymentRequestId" AND p."organizationId" = a."organizationId" WHERE p."orderId" = o."id" AND a."organizationId" = org."id" AND a."verifiedAt" IS NOT NULL)
      ORDER BY o."retailPaymentDeadlineAt", o."id"
      FOR UPDATE OF o SKIP LOCKED
      LIMIT ${limit}
    `);
    const expired: string[] = [];
    for (const row of due) if (await expireRetailOrderTx(tx, row.id, now)) expired.push(row.id);
    return { scanned: due.length, expired };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 });
  return { scanned: outcome.scanned, expired: outcome.expired.length, orderIds: outcome.expired };
}

export async function expireRetailOrderAfterPaymentDeadlineTx(tx: Tx, orderId: string, now: Date) {
  return expireRetailOrderTx(tx, orderId, now);
}
