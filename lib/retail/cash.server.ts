import "server-only";

import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";

type CashMode = "COUNTER" | "PICKUP" | "COURIER";
function cashMode(metadata: Prisma.JsonValue | null): CashMode | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const retail = (metadata as Prisma.JsonObject).retailR4;
  if (!retail || typeof retail !== "object" || Array.isArray(retail)) return null;
  const mode = (retail as Prisma.JsonObject).cashMode;
  return mode === "COUNTER" || mode === "PICKUP" || mode === "COURIER" ? mode : null;
}

export async function confirmRetailCashCollection(input: {
  organizationId: string; orderNumber: string; actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { orderNumber: input.orderNumber,
      organization: { id: input.organizationId }, retailCheckoutKey: { not: null }, deletedAt: null },
      include: { payment: true } });
    if (!order) throw new ApiError(404, "Order not found.");
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    if (order.paymentMethod !== "CASH" || order.paymentStatus !== "PENDING" || !order.payment ||
        ["CANCELLED", "REFUNDED"].includes(order.status)) throw new ApiError(409, "Cash collection is unavailable.");
    const mode = cashMode(order.payment.metadata);
    if (mode === "COURIER" || !mode) throw new ApiError(409, "Courier cash requires merchant reconciliation.");
    if (mode === "PICKUP" && !["READY", "PICKED_UP"].includes(order.status)) {
      throw new ApiError(409, "Cash on pickup can be confirmed when the order is ready.");
    }
    const existing = await tx.retailPaymentReport.count({ where: { orderId: order.id, status: "PENDING_REVIEW" } });
    if (existing) throw new ApiError(409, "A cash collection is awaiting review.");
    const now = new Date();
    const report = await tx.retailPaymentReport.create({ data: {
      organizationId: input.organizationId, orderId: order.id, submittedById: input.actorUserId,
      kind: "CASH_COLLECTION", status: "APPROVED", cashMode: mode, collectorId: input.actorUserId,
      reportedAt: now, reviewedById: input.actorUserId, reviewedAt: now,
      submittedContext: { source: "MERCHANT_CONFIRMED_COLLECTION" },
    } });
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "COMPLETED", paidAt: now } });
    await tx.payment.update({ where: { orderId: order.id }, data: { status: "COMPLETED" } });
    await tx.paymentEvent.create({ data: { orderId: order.id, previousStatus: "PENDING", newStatus: "COMPLETED",
      method: "CASH", amount: order.total, createdById: input.actorUserId,
      note: `Retail cash collected at ${mode.toLowerCase()}` } });
    return { reportId: report.id, orderNumber: order.orderNumber, paymentStatus: "COMPLETED" as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitCourierCashCollection(input: {
  organizationSlug: string; orderNumber: string; actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { organizationSlug: input.organizationSlug,
      orderNumber: input.orderNumber, retailCheckoutKey: { not: null }, deletedAt: null },
      include: { payment: true, organization: { select: { id: true } } } });
    if (!order) throw new ApiError(404, "Order not found.");
    if (order.driverId !== input.actorUserId || !["PICKED_UP", "DELIVERED"].includes(order.status)) {
      throw new ApiError(403, "Courier is not assigned to this order.");
    }
    const membership = await tx.organizationMember.findFirst({ where: {
      organizationId: order.organization.id, userId: input.actorUserId, isActive: true,
      role: "DRIVER", user: { isActive: true, deletedAt: null },
    }, select: { id: true } });
    if (!membership) throw new ApiError(403, "Courier is not authorized.");
    if (order.paymentMethod !== "CASH" || order.paymentStatus !== "PENDING" ||
        cashMode(order.payment?.metadata ?? null) !== "COURIER") throw new ApiError(409, "Courier collection is unavailable.");
    const report = await tx.retailPaymentReport.create({ data: {
      organizationId: order.organization.id, orderId: order.id, submittedById: input.actorUserId,
      kind: "CASH_COLLECTION", status: "PENDING_REVIEW", cashMode: "COURIER",
      collectorId: input.actorUserId, reportedAt: new Date(),
      submittedContext: { source: "COURIER_COLLECTION_DECLARATION" },
    }, select: { id: true, status: true } });
    await tx.paymentEvent.create({ data: { orderId: order.id, previousStatus: "PENDING", newStatus: "PENDING",
      method: "CASH", amount: order.total, createdById: input.actorUserId,
      note: "Courier reported cash collection; merchant reconciliation pending" } });
    return report;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
