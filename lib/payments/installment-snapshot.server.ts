import "server-only";

import { Prisma } from "@prisma/client";

/** One-time tenant-scoped binding of an immutable retail quote to its payment request. */
export async function attachInstallmentSnapshotToPaymentRequest(tx: Prisma.TransactionClient, input: {
  organizationId: string;
  orderId: string;
  paymentRequestId: string;
}) {
  const [snapshot, paymentRequest] = await Promise.all([
    tx.retailInstallmentQuoteSnapshot.findFirst({
      where: { orderId: input.orderId, organizationId: input.organizationId },
      select: { id: true, paymentRequestId: true, finalPayableAmountToman: true, currency: true },
    }),
    tx.paymentRequest.findFirst({
      where: { id: input.paymentRequestId, organizationId: input.organizationId },
      select: { id: true, amountToman: true, currency: true },
    }),
  ]);
  if (!snapshot || !paymentRequest || snapshot.finalPayableAmountToman !== paymentRequest.amountToman || snapshot.currency !== paymentRequest.currency) {
    throw new Error("Payment request does not match the immutable installment amount snapshot.");
  }
  if (snapshot.paymentRequestId === input.paymentRequestId) return { linked: true, replay: true } as const;
  if (snapshot.paymentRequestId !== null) throw new Error("Installment quote snapshot is already bound to another payment request.");

  const updated = await tx.retailInstallmentQuoteSnapshot.updateMany({
    where: { id: snapshot.id, organizationId: input.organizationId, paymentRequestId: null },
    data: { paymentRequestId: paymentRequest.id },
  });
  if (updated.count === 1) return { linked: true, replay: false } as const;
  const current = await tx.retailInstallmentQuoteSnapshot.findUnique({ where: { id: snapshot.id }, select: { paymentRequestId: true } });
  if (current?.paymentRequestId === input.paymentRequestId) return { linked: true, replay: true } as const;
  throw new Error("Concurrent installment payment request binding conflict.");
}
