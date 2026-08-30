import "server-only";

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import {
  buildOperatorReconciliationItem,
  buildPublicPaymentStatus,
  type PaymentOperationsInput,
} from "@/lib/payments/payment-operations-read-model";

type DbClient = Prisma.TransactionClient | typeof prisma;

const paymentOperationsSelect = {
  publicPaymentId: true,
  amountToman: true,
  currency: true,
  purpose: true,
  status: true,
  expiresAt: true,
  paidAt: true,
  failedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  attempts: {
    select: {
      status: true,
      failureReason: true,
      callbackReceivedAt: true,
      verificationStartedAt: true,
      verifiedAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  ussdPaymentIntent: {
    select: {
      status: true,
      verifiedAt: true,
      settledAt: true,
    },
  },
} satisfies Prisma.PaymentRequestSelect;

export async function getPublicPaymentStatus(publicPaymentId: string, db: DbClient = prisma) {
  const payment = await db.paymentRequest.findUnique({
    where: { publicPaymentId },
    select: paymentOperationsSelect,
  });
  return payment ? buildPublicPaymentStatus(payment as PaymentOperationsInput) : null;
}
export async function getOrganizationReconciliationQueue(input: {
  organizationId: string;
  limit?: number;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const take = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const payments = await db.paymentRequest.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [
        { status: { in: ["PENDING_VERIFICATION", "FAILED", "EXPIRED", "CANCELLED"] } },
        { attempts: { some: { status: { in: ["PENDING_VERIFICATION", "FAILED", "VERIFIED"] } } } },
        { ussdPaymentIntent: { is: { status: { in: ["VERIFYING", "VERIFIED", "SETTLED", "REJECTED"] } } } },
      ],
    },
    select: paymentOperationsSelect,
    orderBy: { updatedAt: "desc" },
    take,
  });
  return payments
    .map((payment) => buildOperatorReconciliationItem(payment as PaymentOperationsInput))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}
