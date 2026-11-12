import "server-only";

import type { IntegrationProvider, PaymentProviderAttemptStatus, Prisma, PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db-runtime";
import { authorizeHotelBookingActor, type HotelBookingActor } from "./booking-context";
import { createPaymentProviderAttempt, createPaymentRequest, updatePaymentAttemptStatus, updatePaymentRequestStatus } from "@/lib/payments/payment-request.service";
import { createPrismaHotelRepositories } from "@/lib/hotel/persistence/prisma-hotel-repositories";
import { hotelBookingSandboxEnabled } from "@/lib/hotel/sandbox/booking-sandbox.service";
import { quoteCancellation } from "@/lib/hotel/domain/rate";
import { resolvePropertyInstant } from "@/lib/hotel/domain/stay-dates";

type PaymentDb = PrismaClient;
type Binding = { merchantAccountKey: string; credentialProfileKey: string; merchantCodeName: string };
type ProviderStart = { provider: IntegrationProvider; providerFactorId?: string | null; merchantFactorId?: string | null; providerReference?: string | null; binding: Binding };
export type HotelOperationalPaymentAdapter = {
  available(): boolean;
  start(input: { organizationId: string; integrationId: string; amountToman: bigint; paymentRequestId: string; idempotencyKey: string }): Promise<ProviderStart>;
  verify(input: { organizationId: string; paymentRequestId: string; attemptId: string }): Promise<{ status: "VERIFIED" | "FAILED" | "PENDING_VERIFICATION"; paidAt?: Date; providerReference?: string | null; evidence?: Prisma.InputJsonObject }>;
  refund(input: { organizationId: string; paymentRequestId: string; originalPaymentRequestPublicId: string; amountToman: bigint; idempotencyKey: string }): Promise<{ status: "PENDING_VERIFICATION" | "VERIFIED" | "FAILED"; providerReference?: string | null; evidence?: Prisma.InputJsonObject }>;
  /** Queries an existing refund attempt; must never initiate another refund. */
  verifyRefund?(input: { organizationId: string; paymentRequestId: string; attemptId: string; originalPaymentRequestPublicId: string }): Promise<{ status: "VERIFIED" | "FAILED" | "PENDING_VERIFICATION"; providerReference?: string | null; evidence?: Prisma.InputJsonObject }>;
};

const unavailableAdapter: HotelOperationalPaymentAdapter = {
  available: () => false,
  async start() { throw new ApiError(503, "Hotel payment provider is unavailable"); },
  async verify() { throw new ApiError(503, "Hotel payment provider is unavailable"); },
  async refund() { throw new ApiError(503, "Hotel refund provider is unavailable"); },
  async verifyRefund() { throw new ApiError(503, "Hotel refund verification is unavailable"); },
};

const paymentId = z.string().trim().min(1).max(200);
export const hotelOperationalPaymentCommand = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-payment"), reservationId: paymentId, integrationId: paymentId.optional() }).strict(),
  z.object({ action: z.literal("reconcile-payment"), reservationId: paymentId, paymentRequestPublicId: paymentId }).strict(),
  z.object({ action: z.literal("reconcile-refund"), reservationId: paymentId, paymentRequestPublicId: paymentId }).strict(),
  z.object({ action: z.literal("request-refund"), reservationId: paymentId, paymentRequestPublicId: paymentId }).strict(),
  z.object({ action: z.literal("simulate-payment"), reservationId: paymentId, paymentRequestPublicId: paymentId, outcome: z.enum(["SUCCESS", "FAILED", "EXPIRED"]) }).strict(),
  z.object({ action: z.literal("simulate-refund"), reservationId: paymentId, paymentRequestPublicId: paymentId, outcome: z.enum(["SUCCESS", "FAILED", "EXPIRED"]) }).strict(),
]);
type ActionInput =
  | { action: "create-payment"; reservationId: string; integrationId: string }
  | { action: "reconcile-payment"; reservationId: string; paymentRequestPublicId: string }
  | { action: "reconcile-refund"; reservationId: string; paymentRequestPublicId: string }
  | { action: "request-refund"; reservationId: string; paymentRequestPublicId: string }
  | { action: "simulate-payment" | "simulate-refund"; reservationId: string; paymentRequestPublicId: string; outcome: "SUCCESS" | "FAILED" | "EXPIRED" };

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function simulatorAllowed(db: PaymentDb) {
  if (process.env.HOTEL_OPERATIONAL_PAYMENT_SIMULATOR_ENABLED !== "1" || !hotelBookingSandboxEnabled()) return false;
  if (!process.env.DATABASE_URL) return false;
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname) || url.port !== "55439" || url.pathname !== "/retail_hero_test" || process.env.RETAIL_HERO_EXPECTED_DATABASE !== "retail_hero_test" || process.env.DATABASE_URL !== process.env.DIRECT_URL) return false;
    const rows = await db.$queryRaw<Array<{ databaseName: string; roleName: string }>>`SELECT current_database() AS "databaseName", current_user AS "roleName"`;
    return rows[0]?.databaseName === "retail_hero_test" && rows[0]?.roleName === "hero_test";
  } catch { return false; }
}

/** Server-side payment intent/reconciliation boundary for hotel reservations. */
export class HotelOperationalPaymentService {
  constructor(private readonly db: PaymentDb = prisma, private readonly now: () => Date = () => new Date(), private readonly adapter: HotelOperationalPaymentAdapter = unavailableAdapter) {}

  async get(actor: HotelBookingActor, organizationId: string, propertyId: string, reservationId: string) {
    if (process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || process.env.HOTEL_GUEST_PORTAL_ENABLED !== "1") throw new ApiError(403, "Hotel operational reservations are disabled");
    const property = await authorizeHotelBookingActor(this.db as PrismaClient, actor, organizationId, propertyId);
    if (property.operationalMode !== "RESERVATION") throw new ApiError(403, "Hotel property is not accepting reservations");
    const reservation = await this.db.hotelReservation.findFirst({ where: { id: reservationId, organizationId, propertyId }, select: { id: true, guestCustomerId: true } });
    if (!reservation) throw new ApiError(404, "Reservation not found");
    if (actor.role === "CUSTOMER") {
      const owned = reservation.guestCustomerId && await this.db.customerIdentity.findFirst({ where: { organizationId, userId: actor.userId, guestCustomerId: reservation.guestCustomerId }, select: { id: true } });
      if (!owned) throw new ApiError(404, "Reservation not found");
    }
    const rows = await this.db.paymentRequest.findMany({ where: { organizationId, orderId: null, appointmentId: null, metadata: { path: ["hotelReservationId"], equals: reservationId } }, orderBy: { createdAt: "desc" }, select: { publicId: true, purpose: true, status: true, amountToman: true, currency: true, createdAt: true, expiresAt: true, paidAt: true, metadata: true, attempts: { select: { id: true }, take: 1 } } });
    return { requests: rows.filter(row => jsonObject(row.metadata).hotelPropertyId === propertyId).map(({ publicId, purpose, status, amountToman, currency, createdAt, expiresAt, paidAt, metadata, attempts }) => ({ publicId, purpose, status, amountToman: amountToman.toString(), currency, createdAt, expiresAt, paidAt, simulated: jsonObject(metadata).simulated === true, reconcilable: attempts.length > 0 })) };
  }

  async execute(actor: HotelBookingActor, organizationId: string, propertyId: string, input: unknown, idempotencyKey: string) {
    input = hotelOperationalPaymentCommand.parse(input);
    const command = input as ActionInput;
    if (process.env.HOTEL_OPERATIONAL_RESERVATIONS_ENABLED !== "1" || process.env.HOTEL_GUEST_PORTAL_ENABLED !== "1") throw new ApiError(403, "Hotel operational reservations are disabled");
    if (!idempotencyKey.trim() || idempotencyKey.length > 128) throw new ApiError(400, "A valid idempotency key is required");
    const property = await authorizeHotelBookingActor(this.db as PrismaClient, actor, organizationId, propertyId);
    if (property.operationalMode !== "RESERVATION") throw new ApiError(403, "Hotel property is not accepting reservations");
    const reservation = await this.db.hotelReservation.findFirst({ where: { id: command.reservationId, organizationId, propertyId: property.id }, include: { guests: true, nights: { orderBy: { date: "asc" } } } });
    if (!reservation) throw new ApiError(404, "Reservation not found");
    let identityId: string | null = null;
    if (actor.role === "CUSTOMER") {
      const identity = await this.db.customerIdentity.findFirst({ where: { organizationId, userId: actor.userId, guestCustomerId: reservation.guestCustomerId }, select: { id: true } });
      if (!identity || !reservation.guestCustomerId) throw new ApiError(404, "Reservation not found");
      identityId = identity.id;
      if (command.action !== "create-payment") throw new ApiError(403, "Reception access is required for payment reconciliation and refunds");
    }
    const operationScope = "HOTEL_OPERATIONAL_PAYMENT_ACTION";
    const fingerprint = createHash("sha256").update(JSON.stringify([actor.userId, propertyId, command])).digest("hex");
    const ledgerKey = { organizationId_operationScope_idempotencyKey: { organizationId, operationScope, idempotencyKey } };
    const replay = await this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, operationScope, idempotencyKey])},0))`;
      const existing = await tx.hotelInventoryIdempotency.findUnique({ where: { organizationId_operationScope_idempotencyKey: ledgerKey.organizationId_operationScope_idempotencyKey } });
      if (existing) {
        if (existing.requestFingerprint !== fingerprint) throw new ApiError(409, "Idempotency key conflict");
        if (existing.status === "COMPLETED" && existing.resultJson) return existing.resultJson;
        if (existing.status === "PROCESSING") return { __wait: true };
      }
      await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${organizationId} FOR UPDATE`;
      try {
        await tx.hotelInventoryIdempotency.create({ data: { id: randomUUID(), organizationId, operationScope, idempotencyKey, requestFingerprint: fingerprint, status: "PROCESSING" } });
        return null;
      } catch (e) {
        const existing2 = await tx.hotelInventoryIdempotency.findUnique({ where: { organizationId_operationScope_idempotencyKey: ledgerKey.organizationId_operationScope_idempotencyKey } });
        if (existing2?.requestFingerprint === fingerprint && existing2.status === "COMPLETED" && existing2.resultJson) return existing2.resultJson;
        if (existing2?.requestFingerprint === fingerprint && existing2.status === "PROCESSING") return { __wait: true };
        if (existing2?.requestFingerprint !== fingerprint) throw new ApiError(409, "Idempotency key conflict");
        throw e;
      }
    });
    const replayObject = replay && typeof replay === "object" ? replay as Record<string, unknown> : null;
    if (replayObject?.__wait === true) {
      // If the ledger is still PROCESSING but the underlying action already
      // created durable state (payment request + attempt), return that state
      // instead of polling forever. This handles the case where provider.start
      // threw after the intent was committed.
      const existingAttempt = await this.db.paymentProviderAttempt.findFirst({ where: { organizationId, idempotencyKey } });
      if (existingAttempt) {
        const existingRequest = await this.db.paymentRequest.findUnique({ where: { id: existingAttempt.paymentRequestId } });
        if (existingRequest) {
          await this.db.hotelInventoryIdempotency.update({ where: ledgerKey, data: { status: "COMPLETED", resultJson: { paymentRequestPublicId: existingRequest.publicId, status: existingRequest.status, amountToman: existingRequest.amountToman.toString(), providerAvailable: this.adapter.available(), simulated: jsonObject(existingRequest.metadata).simulated === true }, completedAt: this.now() } });
          return { paymentRequestPublicId: existingRequest.publicId, status: existingRequest.status, amountToman: existingRequest.amountToman.toString(), providerAvailable: this.adapter.available(), simulated: jsonObject(existingRequest.metadata).simulated === true };
        }
      }
      // No durable state yet - throw a clear error instead of polling
      throw new ApiError(409, "Payment action is processing or requires reconciliation");
    }
    if (replayObject) return replayObject;
    try {
      let result: Record<string, unknown>;
      if (command.action === "create-payment") result = await this.createPayment(actor, organizationId, propertyId, reservation, identityId, command.integrationId, idempotencyKey);
      else if (command.action === "reconcile-payment") result = await this.reconcile(organizationId, reservation, command.paymentRequestPublicId);
      else if (command.action === "reconcile-refund") result = await this.reconcileRefund(organizationId, reservation, command.paymentRequestPublicId);
      else if (command.action === "request-refund") result = await this.createRefund(organizationId, propertyId, reservation, command.paymentRequestPublicId, idempotencyKey);
      else {
        if (!await simulatorAllowed(this.db)) throw new ApiError(403, "Hotel payment simulator is unavailable");
        result = await this.simulate(organizationId, propertyId, reservation, command, idempotencyKey);
      }
      const resultJson = JSON.parse(JSON.stringify(result, (_key, value) => typeof value === "bigint" ? value.toString() : value)) as Prisma.InputJsonValue;
      await this.db.hotelInventoryIdempotency.update({ where: ledgerKey, data: { status: "COMPLETED", resultJson, completedAt: this.now() } });
      return result;
    } catch (error) {
      // Only delete PROCESSING if no external side effect has been recorded.
      // Check if there is an attempt created for this action/idempotency.
      const hasAttempt = await this.db.paymentProviderAttempt.findFirst({ where: { organizationId, idempotencyKey } });
      if (hasAttempt) {
        // Keep PROCESSING state for recovery via reconcile/status inquiry
        throw error;
      }
      await this.db.hotelInventoryIdempotency.deleteMany({ where: { organizationId, operationScope, idempotencyKey, status: "PROCESSING" } });
      throw error;
    }
  }

  private async createPayment(actor: HotelBookingActor, organizationId: string, propertyId: string, reservation: { id: string; guestCustomerId: string | null; totalAmount: bigint; paidAmount: bigint; currency: string; status: string }, identityId: string | null, requestedIntegrationId: string | undefined, key: string) {
    if (reservation.status !== "PENDING_PAYMENT" || reservation.paidAmount !== BigInt(0) || reservation.currency !== "TOMAN" || reservation.totalAmount <= BigInt(0)) throw new ApiError(409, "Reservation is not payable");
    const integrations = await this.db.organizationIntegration.findMany({ where: { ...(requestedIntegrationId ? { id: requestedIntegrationId } : {}), organizationId, status: "ACTIVE", disabledAt: null, revokedAt: null }, select: { id: true, provider: true, codeName: true, credentialProfileKey: true, configuration: true } });
    const integration = integrations.filter(row => jsonObject(row.configuration).paymentEnabled === true).length === 1 ? integrations.find(row => jsonObject(row.configuration).paymentEnabled === true) : null;
    const config = jsonObject(integration?.configuration ?? null);
    if (!integration || config.paymentEnabled !== true) throw new ApiError(403, "Payment integration is unavailable");
    const org = await this.db.organization.findFirst({ where: { id: organizationId }, select: { slug: true } });
    const simulated = !this.adapter.available() && Boolean(org?.slug.startsWith("hotel-operational-")) && jsonObject(integration.configuration).fixtureOnly === true && await simulatorAllowed(this.db);
    const binding = { merchantAccountKey: `LEGACY_INTEGRATION:${integration.id}`, credentialProfileKey: integration.credentialProfileKey, merchantCodeName: integration.codeName };
    const intent = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${organizationId} FOR UPDATE`;
      const current = await tx.hotelReservation.findFirst({ where: { id: reservation.id, organizationId, propertyId }, select: { status: true, totalAmount: true, paidAmount: true, guestCustomerId: true } });
      if (!current || current.status !== "PENDING_PAYMENT" || current.paidAmount !== BigInt(0) || current.totalAmount <= BigInt(0)) throw new ApiError(409, "Reservation is not payable");
      const prior = await tx.paymentRequest.findFirst({ where: { organizationId, purpose: "RESERVATION_BALANCE", status: { in: ["CREATED", "AWAITING_CUSTOMER", "PENDING_VERIFICATION", "PAID"] }, metadata: { path: ["hotelReservationId"], equals: reservation.id } }, select: { id: true } });
      if (prior) throw new ApiError(409, "Reservation already has a payment request");
      const request = await createPaymentRequest({ organizationId, customerIdentityId: identityId, guestCustomerId: current.guestCustomerId, providerIntegrationId: integration.id, amountToman: BigInt(current.totalAmount), purpose: "RESERVATION_BALANCE", metadata: { hotelReservationId: reservation.id, hotelPropertyId: propertyId, ...(simulated ? { simulated: true } : {}) }, db: tx });
      await tx.paymentRequest.update({ where: { id: request.id }, data: { merchantAccountKey: binding.merchantAccountKey, credentialProfileKeySnapshot: binding.credentialProfileKey, merchantCodeName: binding.merchantCodeName, accountBoundAt: this.now() } });
      if (!this.adapter.available() && !simulated) return { existing: null, request, attempt: null };
      const attempt = await createPaymentProviderAttempt({ organizationId, paymentRequestId: request.id, providerIntegrationId: integration.id, provider: integration.provider, amountToman: request.amountToman, idempotencyKey: key, db: tx });
      await tx.paymentProviderAttempt.update({ where: { id: attempt.id }, data: { merchantAccountKey: binding.merchantAccountKey, credentialProfileKeySnapshot: binding.credentialProfileKey, merchantCodeName: binding.merchantCodeName } });
      if (simulated) {
        await tx.paymentRequest.update({ where: { id: request.id }, data: { status: "AWAITING_CUSTOMER" } });
        await tx.paymentProviderAttempt.update({ where: { id: attempt.id }, data: { status: "AWAITING_CUSTOMER", verificationEvidence: { simulated: true, fixture: true } } });
      }
      return { existing: null, request, attempt };
    });
    if (intent.existing) return { paymentRequestPublicId: intent.existing.publicId, status: intent.existing.status, amountToman: intent.existing.amountToman.toString(), providerAvailable: this.adapter.available(), simulated: jsonObject(intent.existing.metadata).simulated === true };
    const created = intent.request;
    if (!intent.attempt) return { paymentRequestPublicId: created.publicId, status: created.status, amountToman: created.amountToman.toString(), providerAvailable: false, simulated: false };
    if (simulated) return { paymentRequestPublicId: created.publicId, status: "AWAITING_CUSTOMER", amountToman: created.amountToman.toString(), attemptId: intent.attempt.id, providerAvailable: false, simulated: true };
    const started = await this.adapter.start({ organizationId, integrationId: integration.id, amountToman: created.amountToman, paymentRequestId: created.id, idempotencyKey: key });
    if (started.provider !== integration.provider || !started.binding.merchantAccountKey || !started.binding.credentialProfileKey || !started.binding.merchantCodeName) throw new ApiError(503, "Payment account binding is invalid");
    await updatePaymentRequestStatus({ organizationId, paymentRequestId: created.id, status: "AWAITING_CUSTOMER", providerReference: started.providerReference, db: this.db as never });
    await updatePaymentAttemptStatus({ organizationId, attemptId: intent.attempt.id, status: "AWAITING_CUSTOMER", db: this.db as never });
    return { paymentRequestPublicId: created.publicId, status: "AWAITING_CUSTOMER", amountToman: created.amountToman.toString(), attemptId: intent.attempt.id, providerReference: started.providerReference ?? null };
  }

  private async reconcile(organizationId: string, reservation: { id: string; propertyId: string }, publicId: string) {
    const payment = await this.db.paymentRequest.findFirst({ where: { publicId, organizationId, purpose: "RESERVATION_BALANCE" }, include: { attempts: { orderBy: { createdAt: "desc" }, take: 1 } } });
    const metadata = jsonObject(payment?.metadata ?? null);
    if (!payment || metadata.hotelReservationId !== reservation.id || metadata.hotelPropertyId !== reservation.propertyId || !payment.providerIntegrationId || !payment.merchantAccountKey || !payment.credentialProfileKeySnapshot || !payment.attempts[0]) throw new ApiError(404, "Payment request not found");
    const existingAllocation = await this.db.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: payment.publicId } });
    if (payment.status === "PAID" && existingAllocation?.kind === "BALANCE" && existingAllocation.hotelReservationId === reservation.id) return { status: "PAID", isApplied: true, isIdempotentReplay: true, paymentRequestPublicId: payment.publicId };
    const result = await this.adapter.verify({ organizationId, paymentRequestId: payment.id, attemptId: payment.attempts[0].id });
    if (result.status !== "VERIFIED") {
      await updatePaymentAttemptStatus({ organizationId, attemptId: payment.attempts[0].id, status: result.status as PaymentProviderAttemptStatus, verificationEvidence: result.evidence ?? {}, db: this.db as never });
      if (result.status === "FAILED" && payment.status !== "FAILED") await updatePaymentRequestStatus({ organizationId, paymentRequestId: payment.id, status: "FAILED", db: this.db as never });
      return { status: result.status };
    }
    return this.db.$transaction(async tx => {
      let paymentStatus = payment.status;
      if (paymentStatus === "CREATED") { await updatePaymentRequestStatus({ organizationId, paymentRequestId: payment.id, status: "AWAITING_CUSTOMER", db: tx as never }); paymentStatus = "AWAITING_CUSTOMER"; }
      if (paymentStatus === "AWAITING_CUSTOMER") { await updatePaymentRequestStatus({ organizationId, paymentRequestId: payment.id, status: "PENDING_VERIFICATION", db: tx as never }); paymentStatus = "PENDING_VERIFICATION"; }
      let attemptStatus = payment.attempts[0].status;
      if (attemptStatus === "CREATED") { await updatePaymentAttemptStatus({ organizationId, attemptId: payment.attempts[0].id, status: "AWAITING_CUSTOMER", db: tx as never }); attemptStatus = "AWAITING_CUSTOMER"; }
      if (attemptStatus === "AWAITING_CUSTOMER") { await updatePaymentAttemptStatus({ organizationId, attemptId: payment.attempts[0].id, status: "PENDING_VERIFICATION", db: tx as never }); attemptStatus = "PENDING_VERIFICATION"; }
      if (attemptStatus !== "VERIFIED") await updatePaymentAttemptStatus({ organizationId, attemptId: payment.attempts[0].id, status: "VERIFIED", verificationEvidence: result.evidence ?? {}, db: tx as never });
      if (paymentStatus !== "PAID") await updatePaymentRequestStatus({ organizationId, paymentRequestId: payment.id, status: "PAID", providerReference: result.providerReference, db: tx as never });
      const applied = await createPrismaHotelRepositories(tx as unknown as PrismaClient).applyVerifiedPayment({ scope: { organizationId }, reservationId: reservation.id, paymentRequestPublicId: publicId, paidAt: result.paidAt ?? this.now(), amountToman: payment.amountToman, now: this.now() }, tx as never);
      if (!applied.isApplied) throw new ApiError(409, `Verified payment could not be applied: ${applied.reason}`);
      return { status: "PAID", isApplied: true, isIdempotentReplay: applied.isIdempotentReplay, paymentRequestPublicId: payment.publicId, reservation: applied.reservation };
    });
  }

  private async reconcileRefund(organizationId: string, reservation: { id: string; propertyId: string }, publicId: string) {
    const refund = await this.db.paymentRequest.findFirst({ where: { publicId, organizationId, purpose: "RESERVATION_REFUND" }, include: { attempts: { orderBy: { createdAt: "desc" }, take: 1 } } });
    const metadata = jsonObject(refund?.metadata ?? null);
    if (!refund || metadata.hotelReservationId !== reservation.id || metadata.hotelPropertyId !== reservation.propertyId || !refund.providerIntegrationId || !refund.attempts[0]) throw new ApiError(404, "Refund request not found");
    const existingAllocation = await this.db.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: refund.publicId } });
    if (refund.status === "PAID" && existingAllocation?.kind === "REFUND" && existingAllocation.hotelReservationId === reservation.id) return { status: "PAID", refundRequestPublicId: refund.publicId, amountToman: refund.amountToman.toString(), isIdempotentReplay: true };
    if (!this.adapter.verifyRefund) throw new ApiError(503, "Refund status verification is unavailable; manual reconciliation required");
    const result = await this.adapter.verifyRefund({ organizationId, paymentRequestId: refund.id, attemptId: refund.attempts[0].id, originalPaymentRequestPublicId: metadata.originalPaymentRequestPublicId as string });
    if (result.status !== "VERIFIED") {
      await updatePaymentAttemptStatus({ organizationId, attemptId: refund.attempts[0].id, status: result.status as PaymentProviderAttemptStatus, verificationEvidence: result.evidence ?? {}, db: this.db as never });
      if (result.status === "FAILED" && refund.status !== "FAILED") await updatePaymentRequestStatus({ organizationId, paymentRequestId: refund.id, status: "FAILED", db: this.db as never });
      return { status: result.status, refundRequestPublicId: refund.publicId, amountToman: refund.amountToman.toString() };
    }
    if (jsonObject(result.evidence ?? null).simulated === true || jsonObject(result.evidence ?? null).fixture === true) throw new ApiError(409, "Simulated refund evidence cannot settle a refund");
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${organizationId} FOR UPDATE`;
      const current = await tx.hotelReservation.findFirst({ where: { id: reservation.id, organizationId, propertyId: reservation.propertyId }, select: { paidAmount: true, refundedAmount: true, status: true } });
      if (!current || !["CANCELLED", "NO_SHOW", "REFUNDED"].includes(current.status) || current.refundedAmount + refund.amountToman > current.paidAmount) throw new ApiError(409, "Refund balance changed");
      let refundStatus = refund.status;
      if (refundStatus === "CREATED") { await updatePaymentRequestStatus({ organizationId, paymentRequestId: refund.id, status: "AWAITING_CUSTOMER", db: tx as never }); refundStatus = "AWAITING_CUSTOMER"; }
      if (refundStatus === "AWAITING_CUSTOMER") { await updatePaymentRequestStatus({ organizationId, paymentRequestId: refund.id, status: "PENDING_VERIFICATION", db: tx as never }); refundStatus = "PENDING_VERIFICATION"; }
      let attemptStatus = refund.attempts[0].status;
      if (attemptStatus === "CREATED") { await updatePaymentAttemptStatus({ organizationId, attemptId: refund.attempts[0].id, status: "AWAITING_CUSTOMER", db: tx as never }); attemptStatus = "AWAITING_CUSTOMER"; }
      if (attemptStatus === "AWAITING_CUSTOMER") { await updatePaymentAttemptStatus({ organizationId, attemptId: refund.attempts[0].id, status: "PENDING_VERIFICATION", db: tx as never }); attemptStatus = "PENDING_VERIFICATION"; }
      if (attemptStatus !== "VERIFIED") await updatePaymentAttemptStatus({ organizationId, attemptId: refund.attempts[0].id, status: "VERIFIED", verificationEvidence: result.evidence ?? {}, db: tx as never });
      if (refundStatus !== "PAID") await updatePaymentRequestStatus({ organizationId, paymentRequestId: refund.id, status: "PAID", providerReference: result.providerReference, db: tx as never });
      const existing = await tx.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: refund.publicId } });
      if (existing) return;
      await tx.hotelPaymentAllocation.create({ data: { organizationId, hotelReservationId: reservation.id, paymentRequestPublicId: refund.publicId, kind: "REFUND", amountToman: refund.amountToman } });
      const newRefunded = current.refundedAmount + refund.amountToman;
      await tx.hotelReservation.update({ where: { id: reservation.id }, data: { refundedAmount: newRefunded, status: newRefunded >= current.paidAmount ? "REFUNDED" : current.status, version: { increment: 1 } } });
    });
    return { status: "PAID", refundRequestPublicId: refund.publicId, amountToman: refund.amountToman.toString() };
  }

  private async createRefund(organizationId: string, propertyId: string, reservation: { id: string; guestCustomerId: string | null; totalAmount: bigint; paidAmount: bigint; refundedAmount: bigint; currency: string; status: string; cancellationPolicySnapshot: Prisma.JsonValue; checkIn: Date; cancelledAt: Date | null; nights: Array<{ rate: bigint }> }, originalPublicId: string, key: string) {
    if (!(["CANCELLED", "NO_SHOW"].includes(reservation.status)) || reservation.paidAmount <= reservation.refundedAmount) throw new ApiError(409, "Reservation has no refundable settled balance");
    const original = await this.db.paymentRequest.findFirst({ where: { publicId: originalPublicId, organizationId, status: "PAID", purpose: "RESERVATION_BALANCE" }, include: { attempts: true } });
    const originalMetadata = jsonObject(original?.metadata ?? null);
    if (!original || originalMetadata.hotelReservationId !== reservation.id || originalMetadata.hotelPropertyId !== propertyId) throw new ApiError(404, "Settled payment not found");
    if (!original.providerIntegrationId || original.currency !== reservation.currency || original.currency !== "TOMAN" || original.amountToman !== reservation.paidAmount || original.guestCustomerId !== reservation.guestCustomerId || !original.merchantAccountKey || !original.credentialProfileKeySnapshot) throw new ApiError(409, "Original payment binding does not match the reservation");
    const balanceAllocation = await this.db.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: original.publicId } });
    const verifiedOriginal = original.attempts.some(attempt => {
      const evidence = jsonObject(attempt.verificationEvidence);
      return attempt.organizationId === organizationId && attempt.status === "VERIFIED" && attempt.amountToman === original!.amountToman && attempt.merchantAccountKey === original!.merchantAccountKey && attempt.credentialProfileKeySnapshot === original!.credentialProfileKeySnapshot && evidence.simulated !== true && evidence.fixture !== true;
    });
    if (!balanceAllocation || balanceAllocation.organizationId !== organizationId || balanceAllocation.hotelReservationId !== reservation.id || balanceAllocation.kind !== "BALANCE" || balanceAllocation.amountToman !== original.amountToman || !verifiedOriginal || originalMetadata.simulated === true) throw new ApiError(409, "Original verified balance allocation is unavailable");
    const provider = (await this.db.organizationIntegration.findFirst({ where: { id: original.providerIntegrationId, organizationId, status: "ACTIVE", disabledAt: null, revokedAt: null }, select: { provider: true } }))?.provider;
    if (!provider) throw new ApiError(409, "Original payment integration is unavailable");
    const property = await this.db.hotelProperty.findFirst({ where: { id: propertyId, organizationId }, select: { timezone: true, checkInTime: true } });
    const checkInAt = property && resolvePropertyInstant({ date: reservation.checkIn.toISOString().slice(0, 10), time: property.checkInTime, timeZone: property.timezone });
    if (!checkInAt || !reservation.cancelledAt) throw new ApiError(409, "Property cancellation calendar is invalid");
    const cancellation = quoteCancellation({ totalAmount: Number(reservation.totalAmount), cancelledAt: reservation.cancelledAt, checkInAt, firstNightAmount: Number(reservation.nights[0]?.rate ?? BigInt(0)), policy: reservation.cancellationPolicySnapshot as never });
    const refundAmount = BigInt(Math.min(Number(reservation.paidAmount - reservation.refundedAmount), cancellation.refundableAmount));
    if (refundAmount <= BigInt(0)) throw new ApiError(409, "Cancellation policy allows no refund");
    const intent = await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${organizationId} FOR UPDATE`;
      const current = await tx.hotelReservation.findFirst({ where: { id: reservation.id, organizationId, propertyId }, select: { paidAmount: true, refundedAmount: true, status: true } });
      if (!current || !["CANCELLED", "NO_SHOW"].includes(current.status) || refundAmount > current.paidAmount - current.refundedAmount) throw new ApiError(409, "Refund balance changed");
      const pendingRefund = await tx.paymentRequest.findFirst({ where: { organizationId, purpose: "RESERVATION_REFUND", status: { in: ["CREATED", "AWAITING_CUSTOMER", "PENDING_VERIFICATION"] }, metadata: { path: ["hotelReservationId"], equals: reservation.id } }, select: { id: true } });
      if (pendingRefund) throw new ApiError(409, "Reservation already has a pending refund request");
      const created = await createPaymentRequest({ organizationId, guestCustomerId: reservation.guestCustomerId, providerIntegrationId: original.providerIntegrationId, amountToman: refundAmount, purpose: "RESERVATION_REFUND", metadata: { requestType: "HOTEL_REFUND", originalPaymentRequestPublicId: originalPublicId, hotelReservationId: reservation.id, hotelPropertyId: propertyId, policySnapshot: jsonObject(reservation.cancellationPolicySnapshot), cancellationQuote: { policyKey: cancellation.policyKey, refundableAmount: cancellation.refundableAmount, retainedAmount: cancellation.retainedAmount, reason: cancellation.reason } }, db: tx });
      if (!this.adapter.available()) return { created, attempt: null };
      const attempt = await tx.paymentProviderAttempt.create({ data: { organizationId, paymentRequestId: created.id, providerIntegrationId: original.providerIntegrationId, provider, amountToman: created.amountToman, idempotencyKey: key, status: "PENDING_VERIFICATION" } });
      await tx.paymentRequest.update({ where: { id: created.id }, data: { status: "PENDING_VERIFICATION" } });
      return { created, attempt };
    });
    const refund = intent.created;
    const attempt = intent.attempt;
    if (!attempt) return { refundRequestPublicId: refund.publicId, status: "CREATED", amountToman: refund.amountToman.toString(), providerAvailable: false };
    const result = await this.adapter.refund({ organizationId, paymentRequestId: refund.id, originalPaymentRequestPublicId: originalPublicId, amountToman: refund.amountToman, idempotencyKey: key });
    // The PaymentRequest is the durable refund request; only trusted VERIFIED provider truth moves it to PAID.
    if (result.status === "VERIFIED" && (jsonObject(result.evidence ?? null).simulated === true || jsonObject(result.evidence ?? null).fixture === true)) throw new ApiError(409, "Simulated refund evidence cannot settle a refund");
    if (result.status === "VERIFIED") {
      await this.db.$transaction(async tx => {
        const now = this.now();
        await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${organizationId} FOR UPDATE`;
        const current = await tx.hotelReservation.findFirst({ where: { id: reservation.id, organizationId, propertyId }, select: { paidAmount: true, refundedAmount: true, status: true } });
        if (!current || !["CANCELLED", "NO_SHOW", "REFUNDED"].includes(current.status) || current.refundedAmount + refund.amountToman > current.paidAmount) throw new ApiError(409, "Refund balance changed");
        await tx.paymentProviderAttempt.update({ where: { id: attempt.id }, data: { status: "VERIFIED", verifiedAt: now, providerResult: result.providerReference, verificationEvidence: result.evidence ?? {} } });
        await tx.paymentRequest.update({ where: { id: refund.id }, data: { status: "PAID", paidAt: now, providerReference: result.providerReference } });
        await tx.hotelPaymentAllocation.create({ data: { organizationId, hotelReservationId: reservation.id, paymentRequestPublicId: refund.publicId, kind: "REFUND", amountToman: refund.amountToman } });
        const newRefunded = current.refundedAmount + refund.amountToman;
        await tx.hotelReservation.update({ where: { id: reservation.id }, data: { refundedAmount: newRefunded, status: newRefunded >= current.paidAmount ? "REFUNDED" : current.status, version: { increment: 1 } } });
      });
    } else if (result.status === "FAILED") {
      await this.db.paymentProviderAttempt.update({ where: { id: attempt.id }, data: { status: "FAILED", failureReason: "PROVIDER_REFUND_FAILED", verificationEvidence: result.evidence ?? {} } });
      await updatePaymentRequestStatus({ organizationId, paymentRequestId: refund.id, status: "FAILED", providerReference: result.providerReference, db: this.db as never });
    }
    return { refundRequestPublicId: refund.publicId, status: result.status, amountToman: refund.amountToman.toString() };
  }

  private async simulate(organizationId: string, propertyId: string, reservation: { id: string; totalAmount: bigint; status: string; paidAmount: bigint; refundedAmount: bigint }, input: Extract<ActionInput, { action: "simulate-payment" | "simulate-refund" }>, key: string) {
    const org = await this.db.organization.findFirst({ where: { id: organizationId }, select: { slug: true } });
    if (!org?.slug.startsWith("hotel-operational-")) throw new ApiError(403, "Simulator fixture organization required");
    const payment = await this.db.paymentRequest.findFirst({ where: { publicId: input.paymentRequestPublicId, organizationId } });
    const metadata = jsonObject(payment?.metadata ?? null);
    if (!payment || metadata.hotelReservationId !== reservation.id || metadata.hotelPropertyId !== propertyId) throw new ApiError(404, "Payment request not found");
    if (input.action === "simulate-payment") {
      if (payment.purpose !== "RESERVATION_BALANCE" || payment.amountToman !== reservation.totalAmount) throw new ApiError(409, "Payment fixture does not match reservation");
      return this.db.$transaction(async tx => {
        const now = this.now();
        await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${organizationId} FOR UPDATE`;
        const existing = await tx.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: payment.publicId } });
        const current = await tx.hotelReservation.findFirst({ where: { id: reservation.id, organizationId, propertyId }, select: { status: true, paidAmount: true } });
        if (existing) {
          if (existing.hotelReservationId !== reservation.id || existing.kind !== "BALANCE" || existing.amountToman !== payment.amountToman) throw new ApiError(409, "Simulator allocation conflict");
          return { status: "PAID", simulated: true, replay: true, paymentRequestPublicId: payment.publicId };
        }
        if (!current || current.status !== "PENDING_PAYMENT" || current.paidAmount !== BigInt(0) || payment.status !== "AWAITING_CUSTOMER") throw new ApiError(409, "Payment fixture is already settled or inactive");
        await tx.paymentRequest.update({ where: { id: payment.id }, data: { metadata: { ...metadata, simulated: true }, status: input.outcome === "SUCCESS" ? "PAID" : input.outcome === "FAILED" ? "FAILED" : "EXPIRED", paidAt: input.outcome === "SUCCESS" ? now : null } });
        const attempt = await tx.paymentProviderAttempt.create({ data: { organizationId, paymentRequestId: payment.id, provider: "INOTI_USSD", amountToman: payment.amountToman, idempotencyKey: key, status: input.outcome === "SUCCESS" ? "VERIFIED" : input.outcome === "FAILED" ? "FAILED" : "EXPIRED", verifiedAt: input.outcome === "SUCCESS" ? now : null, verificationEvidence: { simulated: true, outcome: input.outcome } } });
        if (input.outcome !== "SUCCESS") return { status: input.outcome };
        await tx.hotelPaymentAllocation.create({ data: { organizationId, hotelReservationId: reservation.id, paymentRequestPublicId: payment.publicId, kind: "BALANCE", amountToman: payment.amountToman } });
        const changed = await tx.hotelReservation.updateMany({ where: { id: reservation.id, organizationId, propertyId, status: "PENDING_PAYMENT", paidAmount: BigInt(0) }, data: { status: "CONFIRMED", paidAmount: payment.amountToman, confirmedAt: now, version: { increment: 1 } } });
        if (changed.count !== 1) throw new ApiError(409, "Simulator reservation state changed");
        return { status: "PAID", simulated: true, paymentRequestPublicId: payment.publicId, attemptId: attempt.id };
      });
    }
    if (payment.purpose !== "RESERVATION_REFUND" || metadata.requestType !== "HOTEL_REFUND") throw new ApiError(409, "Refund fixture does not match request");
    await this.db.$transaction(async tx => {
      const now = this.now();
      await tx.$queryRaw`SELECT "id" FROM "HotelReservation" WHERE "id"=${reservation.id} AND "organizationId"=${organizationId} FOR UPDATE`;
      const existing = await tx.hotelPaymentAllocation.findUnique({ where: { paymentRequestPublicId: payment.publicId } });
      if (existing) {
        if (existing.hotelReservationId !== reservation.id || existing.kind !== "REFUND" || existing.amountToman !== payment.amountToman) throw new ApiError(409, "Simulator refund allocation conflict");
        return;
      }
      const current = await tx.hotelReservation.findFirst({ where: { id: reservation.id, organizationId, propertyId }, select: { paidAmount: true, refundedAmount: true, status: true } });
      if (!current || !["CANCELLED", "NO_SHOW", "REFUNDED"].includes(current.status)) throw new ApiError(409, "Simulator reservation state changed");
      if (payment.status !== "PENDING_VERIFICATION") throw new ApiError(409, "Refund fixture is already settled or inactive");
      await tx.paymentRequest.update({ where: { id: payment.id }, data: { status: input.outcome === "SUCCESS" ? "PAID" : input.outcome === "FAILED" ? "FAILED" : "EXPIRED", paidAt: input.outcome === "SUCCESS" ? now : null, metadata: { ...metadata, simulated: true } } });
      if (input.outcome === "SUCCESS") {
        const nextRefunded = current.refundedAmount + payment.amountToman;
        if (nextRefunded > current.paidAmount) throw new ApiError(409, "Simulator refund exceeds settled balance");
        await tx.hotelPaymentAllocation.create({ data: { organizationId, hotelReservationId: reservation.id, paymentRequestPublicId: payment.publicId, kind: "REFUND", amountToman: payment.amountToman } });
        await tx.hotelReservation.update({ where: { id: reservation.id }, data: { refundedAmount: nextRefunded, status: nextRefunded >= current.paidAmount ? "REFUNDED" : current.status, version: { increment: 1 } } });
      }
    });
    return { status: input.outcome, simulated: true };
  }
}
