import "server-only";

import { Prisma, RetailPaymentReportStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { getRetailPaymentPolicy } from "@/lib/retail/payment-policy.server";
import { removeRetailReceipt, storeRetailReceipt } from "@/lib/retail/receipt-storage.server";

export const bankTimeInput = z.object({
  method: z.literal("TIME"),
  reportedAt: z.string().datetime({ offset: true }),
  submittedLocalTime: z.string().trim().min(4).max(100),
}).strict();

async function customerOrder(organizationSlug: string, orderNumber: string, customerId: string) {
  const order = await prisma.order.findFirst({
    where: { orderNumber, organizationSlug, customerId, retailCheckoutKey: { not: null },
      deletedAt: null, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    select: { id: true, organization: { select: { id: true, slug: true } },
      paymentMethod: true, paymentStatus: true, status: true, retailPaymentDeadlineAt: true },
  });
  if (!order) throw new ApiError(404, "Order not found.");
  return order;
}

async function submitBankReport(input: {
  organizationSlug: string; orderNumber: string; customerId: string;
  kind: "BANK_RECEIPT" | "BANK_TIME"; receiptKey?: string; reportedAt?: Date;
  submittedContext?: Prisma.InputJsonValue;
}) {
  const order = await customerOrder(input.organizationSlug, input.orderNumber, input.customerId);
  if (order.paymentMethod !== "BANK_TRANSFER" || order.paymentStatus !== "PENDING") {
    throw new ApiError(409, "This order is not awaiting a bank transfer report.");
  }
  if (order.retailPaymentDeadlineAt && order.retailPaymentDeadlineAt <= new Date()) {
    throw new ApiError(409, "The payment deadline for this order has passed.");
  }
  const policy = await getRetailPaymentPolicy(order.organization.slug);
  if (!policy.bankTransferEnabled) throw new ApiError(409, "Bank transfer reporting is unavailable.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    const current = await tx.order.findFirst({ where: { id: order.id, organization: { id: order.organization.id },
      customerId: input.customerId, retailCheckoutKey: { not: null }, paymentMethod: "BANK_TRANSFER", paymentStatus: "PENDING",
      status: { notIn: ["CANCELLED", "REFUNDED"] }, OR: [{ retailPaymentDeadlineAt: null }, { retailPaymentDeadlineAt: { gt: new Date() } }] }, select: { id: true } });
    if (!current) throw new ApiError(409, "This order is no longer accepting a bank transfer report.");
    const pending = await tx.retailPaymentReport.findFirst({ where: { orderId: order.id, status: "PENDING_REVIEW" }, select: { id: true } });
    if (pending) throw new ApiError(409, "A payment report is already awaiting review.");
    return tx.retailPaymentReport.create({ data: {
      organizationId: order.organization.id, orderId: order.id, submittedById: input.customerId,
      kind: input.kind, receiptKey: input.receiptKey ?? null, reportedAt: input.reportedAt ?? null,
      submittedContext: input.submittedContext ?? Prisma.JsonNull,
    }, select: { id: true, kind: true, status: true, createdAt: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitBankTimeReport(input: {
  organizationSlug: string; orderNumber: string; customerId: string;
  reportedAt: string; submittedLocalTime: string;
}) {
  const reportedAt = new Date(input.reportedAt);
  if (!Number.isFinite(reportedAt.getTime()) || reportedAt.getTime() < Date.now() - 30 * 86_400_000 ||
      reportedAt.getTime() > Date.now() + 5 * 60_000) throw new ApiError(400, "Payment time is outside the allowed range.");
  return submitBankReport({ ...input, kind: "BANK_TIME", reportedAt,
    submittedContext: { submittedLocalTime: input.submittedLocalTime, normalizedAt: reportedAt.toISOString() } });
}

export async function submitBankReceiptReport(input: {
  organizationSlug: string; orderNumber: string; customerId: string;
  buffer: Buffer; mimeType: string;
}) {
  // Check the order before uploading. The second check in submitBankReport also
  // covers changes that happen while storage is in progress.
  const order = await customerOrder(input.organizationSlug, input.orderNumber, input.customerId);
  if (order.paymentMethod !== "BANK_TRANSFER" || order.paymentStatus !== "PENDING") throw new ApiError(409, "Bank transfer reporting is unavailable.");
  const receiptKey = await storeRetailReceipt(input.buffer, input.mimeType, order.organization.id);
  try {
    return await submitBankReport({ ...input, kind: "BANK_RECEIPT", receiptKey });
  } catch (error) {
    try { await removeRetailReceipt(receiptKey, order.organization.id); }
    catch (cleanupError) { console.error("[retail-payment] receipt compensation failed", cleanupError); }
    throw error;
  }
}

export async function listRetailPaymentReports(organizationId: string) {
  const reports = await prisma.retailPaymentReport.findMany({
    where: { organizationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
    select: { id: true, orderId: true, kind: true, status: true, reportedAt: true, createdAt: true,
      reviewedAt: true, reviewedById: true, reviewReason: true, receiptKey: true,
      submittedContext: true, cashMode: true, collectorId: true,
      order: { select: { orderNumber: true, total: true, paymentStatus: true, paymentMethod: true } } },
  });
  return reports.map((report) => ({
    id: report.id, orderNumber: report.order.orderNumber, total: report.order.total.toString(),
    paymentStatus: report.order.paymentStatus, paymentMethod: report.order.paymentMethod,
    kind: report.kind, status: report.status, reportedAt: report.reportedAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(), reviewedAt: report.reviewedAt?.toISOString() ?? null,
    reviewedById: report.reviewedById, reviewReason: report.reviewReason,
    hasReceipt: Boolean(report.receiptKey),
    submittedContext: report.submittedContext, cashMode: report.cashMode, collectorId: report.collectorId,
  }));
}

export const reviewInput = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_CORRECTION"]),
  reason: z.string().trim().max(500).optional(),
}).strict().superRefine((value, context) => {
  if (value.action !== "APPROVE" && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "Reason is required." });
});

export async function reviewRetailPaymentReport(input: {
  organizationId: string; actorUserId: string; reportId: string;
  action: z.infer<typeof reviewInput>["action"]; reason?: string;
}) {
  const status: RetailPaymentReportStatus = input.action === "APPROVE" ? "APPROVED"
    : input.action === "REJECT" ? "REJECTED" : "CORRECTION_REQUESTED";
  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.retailPaymentReport.findFirst({
      where: { id: input.reportId, organizationId: input.organizationId },
      include: { order: { include: { payment: true, organization: { select: { id: true } } } } },
    });
    if (!report || report.order.organization.id !== input.organizationId) throw new ApiError(404, "Payment report not found.");
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${report.orderId} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: report.orderId }, include: { payment: true } });
    const matchingMethod = report.kind === "CASH_COLLECTION"
      ? order.paymentMethod === "CASH" && report.cashMode === "COURIER" && Boolean(report.collectorId)
      : order.paymentMethod === "BANK_TRANSFER";
    if (report.status !== "PENDING_REVIEW" || order.paymentStatus !== "PENDING" ||
        !matchingMethod || !order.retailCheckoutKey ||
        ["CANCELLED", "REFUNDED"].includes(order.status)) throw new ApiError(409, "Payment report is no longer reviewable.");
    await tx.retailPaymentReport.update({ where: { id: report.id }, data: {
      status, reviewedById: input.actorUserId, reviewedAt: new Date(), reviewReason: input.reason ?? null,
    } });
    if (status === "APPROVED") {
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: "COMPLETED", paidAt: new Date() } });
      if (!order.payment) throw new ApiError(409, "Order payment record is missing.");
      await tx.payment.update({ where: { orderId: order.id }, data: { status: "COMPLETED" } });
    }
    await tx.paymentEvent.create({ data: {
      orderId: order.id, previousStatus: order.paymentStatus,
      newStatus: status === "APPROVED" ? "COMPLETED" : "PENDING",
      method: order.paymentMethod, amount: order.total, createdById: input.actorUserId,
      note: `Retail payment report ${status.toLowerCase()}${input.reason ? `: ${input.reason}` : ""}`,
    } });
    await tx.auditLog.create({ data: {
      action: "UPDATE", entityType: "RetailPaymentReport", entityId: report.id,
      description: `Retail payment report ${status.toLowerCase()}`,
      userId: input.actorUserId, organizationId: input.organizationId,
      newValue: { status, reason: input.reason ?? null, orderId: order.id },
    } });
    return { orderId: order.id, reportId: report.id, status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return result;
}

export async function getRetailReceiptForMerchant(organizationId: string, reportId: string) {
  const report = await prisma.retailPaymentReport.findFirst({
    where: { id: reportId, organizationId, kind: "BANK_RECEIPT" },
    select: { receiptKey: true },
  });
  if (!report?.receiptKey) throw new ApiError(404, "Receipt not found.");
  return report.receiptKey;
}
