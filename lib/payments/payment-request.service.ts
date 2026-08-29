import "server-only";

import { randomUUID } from "node:crypto";
import type { IntegrationProvider, PaymentProviderAttemptStatus, PaymentRequestStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { recordBusinessEvent } from "@/lib/integrations/runtime/business-events";
import { canTransitionPaymentAttempt, canTransitionPaymentRequest } from "@/lib/payments/payment-state";

type DbClient = Prisma.TransactionClient | typeof prisma;

function asJsonObject(value: unknown): Prisma.InputJsonObject {
  return (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Prisma.InputJsonObject;
}

async function assertOrganization(organizationId: string, db: DbClient) {
  const organization = await db.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
}

async function assertOrderBelongsToOrganization(input: { organizationId: string; orderId?: string | null; db: DbClient }) {
  if (!input.orderId) return;
  const order = await input.db.order.findFirst({
    where: { id: input.orderId, organization: { id: input.organizationId, isActive: true, deletedAt: null } },
    select: { id: true },
  });
  if (!order) throw new ApiError(404, "Order not found for organization");
}

async function assertAppointmentBelongsToOrganization(input: { organizationId: string; appointmentId?: string | null; db: DbClient }) {
  if (!input.appointmentId) return;
  const appointment = await input.db.appointment.findFirst({
    where: { id: input.appointmentId, service: { organizationId: input.organizationId } },
    select: { id: true },
  });
  if (!appointment) throw new ApiError(404, "Appointment not found for organization");
}

async function assertIntegrationBelongsToOrganization(input: { organizationId: string; integrationId?: string | null; db: DbClient }) {
  if (!input.integrationId) return;
  const integration = await input.db.organizationIntegration.findFirst({
    where: { id: input.integrationId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!integration) throw new ApiError(404, "Provider integration not found for organization");
}

async function assertCustomerIdentityBelongsToOrganization(input: { organizationId: string; customerIdentityId?: string | null; db: DbClient }) {
  if (!input.customerIdentityId) return;
  const customerIdentity = await input.db.customerIdentity.findFirst({
    where: { id: input.customerIdentityId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!customerIdentity) throw new ApiError(404, "Customer identity not found for organization");
}

async function assertGuestCustomerBelongsToOrganization(input: { organizationId: string; guestCustomerId?: string | null; db: DbClient }) {
  if (!input.guestCustomerId) return;
  const guestCustomer = await input.db.guestCustomer.findFirst({
    where: {
      id: input.guestCustomerId,
      OR: [
        { orders: { some: { organization: { id: input.organizationId } } } },
        { appointments: { some: { service: { organizationId: input.organizationId } } } },
        { customerIdentities: { some: { organizationId: input.organizationId } } },
      ],
    },
    select: { id: true },
  });
  if (!guestCustomer) throw new ApiError(404, "Guest customer not found for organization");
}

export function generateBazarBaazFactorId() {
  return `BZ${randomUUID().replace(/-/g, "")}`;
}

export async function createPaymentRequest(input: {
  organizationId: string;
  customerIdentityId?: string | null;
  orderId?: string | null;
  appointmentId?: string | null;
  guestCustomerId?: string | null;
  providerIntegrationId?: string | null;
  amountToman: bigint;
  purpose: string;
  expiresAt?: Date | null;
  metadata?: unknown;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  if (input.amountToman <= BigInt(0)) throw new ApiError(400, "Payment amount must be positive Toman");
  await assertOrganization(input.organizationId, db);
  await assertOrderBelongsToOrganization({ organizationId: input.organizationId, orderId: input.orderId, db });
  await assertAppointmentBelongsToOrganization({ organizationId: input.organizationId, appointmentId: input.appointmentId, db });
  await assertIntegrationBelongsToOrganization({ organizationId: input.organizationId, integrationId: input.providerIntegrationId, db });
  await assertCustomerIdentityBelongsToOrganization({ organizationId: input.organizationId, customerIdentityId: input.customerIdentityId, db });
  await assertGuestCustomerBelongsToOrganization({ organizationId: input.organizationId, guestCustomerId: input.guestCustomerId, db });

  const request = await db.paymentRequest.create({
    data: {
      organizationId: input.organizationId,
      customerIdentityId: input.customerIdentityId ?? null,
      orderId: input.orderId ?? null,
      appointmentId: input.appointmentId ?? null,
      guestCustomerId: input.guestCustomerId ?? null,
      providerIntegrationId: input.providerIntegrationId ?? null,
      amountToman: input.amountToman,
      currency: "TOMAN",
      purpose: input.purpose,
      expiresAt: input.expiresAt ?? null,
      metadata: asJsonObject(input.metadata),
    },
  });

  await recordBusinessEvent({
    organizationId: input.organizationId,
    integrationId: input.providerIntegrationId,
    type: "PAYMENT_REQUEST_CREATED",
    entityType: "PaymentRequest",
    entityId: request.id,
    payload: { purpose: request.purpose, currency: "TOMAN" },
    metadata: { amountToman: request.amountToman.toString() },
  }).catch(() => undefined);

  return request;
}

export async function createPaymentProviderAttempt(input: {
  organizationId: string;
  paymentRequestId: string;
  providerIntegrationId?: string | null;
  provider: IntegrationProvider;
  amountToman: bigint;
  merchantFactorId?: string | null;
  providerFactorId?: string | null;
  idempotencyKey?: string | null;
  metadata?: unknown;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  await assertIntegrationBelongsToOrganization({ organizationId: input.organizationId, integrationId: input.providerIntegrationId, db });
  const request = await db.paymentRequest.findFirst({
    where: { id: input.paymentRequestId, organizationId: input.organizationId },
    select: { id: true, amountToman: true },
  });
  if (!request) throw new ApiError(404, "Payment request not found");
  if (request.amountToman !== input.amountToman) throw new ApiError(409, "Payment attempt amount does not match request amount");

  return db.paymentProviderAttempt.create({
    data: {
      organizationId: input.organizationId,
      paymentRequestId: input.paymentRequestId,
      providerIntegrationId: input.providerIntegrationId ?? null,
      provider: input.provider,
      amountToman: input.amountToman,
      merchantFactorId: input.merchantFactorId ?? null,
      providerFactorId: input.providerFactorId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      verificationEvidence: asJsonObject(input.metadata),
    },
  });
}

export async function updatePaymentRequestStatus(input: {
  organizationId: string;
  paymentRequestId: string;
  status: PaymentRequestStatus;
  providerReference?: string | null;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const current = await db.paymentRequest.findUnique({
    where: { id_organizationId: { id: input.paymentRequestId, organizationId: input.organizationId } },
    select: { status: true },
  });
  if (!current) throw new ApiError(404, "Payment request not found");
  if (!canTransitionPaymentRequest(current.status, input.status)) {
    throw new ApiError(409, `Illegal payment request transition: ${current.status} -> ${input.status}`);
  }
  const updated = await db.paymentRequest.updateMany({
    where: { id: input.paymentRequestId, organizationId: input.organizationId, status: current.status },
    data: {
      status: input.status,
      providerReference: input.providerReference ?? undefined,
      paidAt: input.status === "PAID" ? new Date() : undefined,
      failedAt: input.status === "FAILED" ? new Date() : undefined,
      cancelledAt: input.status === "CANCELLED" ? new Date() : undefined,
    },
  });
  if (updated.count !== 1) throw new ApiError(409, "Payment request changed concurrently");
  return db.paymentRequest.findUniqueOrThrow({
    where: { id_organizationId: { id: input.paymentRequestId, organizationId: input.organizationId } },
  });
}

export async function updatePaymentAttemptStatus(input: {
  organizationId: string;
  attemptId: string;
  status: PaymentProviderAttemptStatus;
  providerFactorId?: string | null;
  rrn?: string | null;
  providerResult?: string | null;
  callbackEvidence?: unknown;
  verificationEvidence?: unknown;
  failureReason?: string | null;
  db?: DbClient;
}) {
  const db = input.db ?? prisma;
  const current = await db.paymentProviderAttempt.findUnique({
    where: { id_organizationId: { id: input.attemptId, organizationId: input.organizationId } },
    select: { status: true },
  });
  if (!current) throw new ApiError(404, "Payment attempt not found");
  if (!canTransitionPaymentAttempt(current.status, input.status)) {
    throw new ApiError(409, `Illegal payment attempt transition: ${current.status} -> ${input.status}`);
  }
  const updated = await db.paymentProviderAttempt.updateMany({
    where: { id: input.attemptId, organizationId: input.organizationId, status: current.status },
    data: {
      status: input.status,
      providerFactorId: input.providerFactorId ?? undefined,
      rrn: input.rrn ?? undefined,
      providerResult: input.providerResult ?? undefined,
      callbackEvidence: input.callbackEvidence === undefined ? undefined : asJsonObject(input.callbackEvidence),
      verificationEvidence: input.verificationEvidence === undefined ? undefined : asJsonObject(input.verificationEvidence),
      failureReason: input.failureReason ?? undefined,
      callbackReceivedAt: input.callbackEvidence === undefined ? undefined : new Date(),
      verificationStartedAt: input.status === "PENDING_VERIFICATION" ? new Date() : undefined,
      verifiedAt: input.status === "VERIFIED" ? new Date() : undefined,
    },
  });
  if (updated.count !== 1) throw new ApiError(409, "Payment attempt changed concurrently");
  return db.paymentProviderAttempt.findUniqueOrThrow({
    where: { id_organizationId: { id: input.attemptId, organizationId: input.organizationId } },
  });
}
