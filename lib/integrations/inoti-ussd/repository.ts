import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { generateBazarBaazFactorId } from "@/lib/payments/payment-request.service";
import type {
  PaymentSettlementInput,
  PaymentSettlementResult,
  ResolvedInotiIntegration,
  UssdOrderProjection,
  UssdPaymentIntentProjection,
} from "@/lib/integrations/inoti-ussd/types";

export interface UssdIntegrationRepository {
  resolveIntegration(publicId: string): Promise<ResolvedInotiIntegration | null>;
  touchIntegration(integrationId: string): Promise<void>;
  findOrderByTrackingToken(integration: ResolvedInotiIntegration, token: string): Promise<UssdOrderProjection | null>;
  createOrGetPaymentIntent(input: {
    integration: ResolvedInotiIntegration;
    order: UssdOrderProjection;
    sessionIdHash: string;
    mobileHash: string;
    mobileMasked: string;
    amountRial: bigint;
  }): Promise<UssdPaymentIntentProjection>;
  findPaymentIntent(integrationId: string, merchantFactorId: string): Promise<UssdPaymentIntentProjection | null>;
  recordCallbackEvent(input: {
    integration: ResolvedInotiIntegration;
    paymentIntentId?: string | null;
    idempotencyKey: string;
    sessionIdHash: string;
    mobileHash: string;
    callHash: string;
    rrnHash?: string | null;
    outcome: "ACCEPTED" | "REJECTED" | "DUPLICATE" | "FAILED";
    errorCode?: string | null;
  }): Promise<void>;
  markPaymentVerificationStarted(input: {
    integration: ResolvedInotiIntegration;
    intent: UssdPaymentIntentProjection;
    providerFactorId: string;
    rrn: string;
  }): Promise<void>;
  markPaymentVerificationFailed(input: {
    integration: ResolvedInotiIntegration;
    intent: UssdPaymentIntentProjection;
    reason: string;
  }): Promise<void>;
  settleVerifiedPayment(input: PaymentSettlementInput): Promise<PaymentSettlementResult>;
  markNotificationAttempted(intentId: string): Promise<void>;
}

function readConfig(value: Prisma.JsonValue | null): ResolvedInotiIntegration["config"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { orderStatusEnabled: false, paymentEnabled: false };
  }
  const config = value as Prisma.JsonObject;
  return {
    orderStatusEnabled: config.orderStatusEnabled === true,
    paymentEnabled: config.paymentEnabled === true,
  };
}

function toIntentProjection(intent: {
  id: string;
  organizationId: string;
  integrationId: string;
  orderId: string;
  paymentRequestId: string | null;
  providerAttemptId: string | null;
  merchantFactorId: string;
  amountRial: bigint;
  sessionIdHash: string;
  mobileHash: string;
  mobileMasked: string;
  status: UssdPaymentIntentProjection["status"];
  providerFactorId: string | null;
  rrn: string | null;
}): UssdPaymentIntentProjection {
  return intent;
}

export class PrismaUssdIntegrationRepository implements UssdIntegrationRepository {
  async resolveIntegration(publicId: string) {
    const integration = await prisma.organizationIntegration.findUnique({
      where: { publicId },
      select: {
        id: true,
        publicId: true,
        organizationId: true,
        provider: true,
        status: true,
        codeName: true,
        credentialProfileKey: true,
        configuration: true,
        callbackOrigin: true,
        organization: { select: { slug: true, isActive: true, deletedAt: true } },
      },
    });
    if (!integration || integration.provider !== "INOTI_USSD" || !integration.organization.isActive || integration.organization.deletedAt) {
      return null;
    }
    return {
      id: integration.id,
      publicId: integration.publicId,
      organizationId: integration.organizationId,
      organizationSlug: integration.organization.slug,
      status: integration.status,
      codeName: integration.codeName,
      credentialProfileKey: integration.credentialProfileKey,
      callbackOrigin: integration.callbackOrigin,
      config: readConfig(integration.configuration),
    };
  }

  async touchIntegration(integrationId: string) {
    await prisma.organizationIntegration.update({ where: { id: integrationId }, data: { lastCallbackAt: new Date() } });
  }

  async findOrderByTrackingToken(integration: ResolvedInotiIntegration, token: string) {
    const order = await prisma.order.findFirst({
      where: {
        publicTrackingToken: token,
        deletedAt: null,
        organization: { id: integration.organizationId, isActive: true, deletedAt: null },
      },
      select: {
        id: true,
        orderNumber: true,
        publicTrackingToken: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        customerId: true,
        guestCustomerId: true,
        guestCustomer: { select: { phone: true } },
      },
    });
    if (!order?.publicTrackingToken) return null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      publicTrackingToken: order.publicTrackingToken,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalToman: order.total.toString(),
      customerId: order.customerId,
      guestCustomerId: order.guestCustomerId,
      guestPhone: order.guestCustomer?.phone ?? null,
    };
  }

  async createOrGetPaymentIntent(input: {
    integration: ResolvedInotiIntegration;
    order: UssdOrderProjection;
    sessionIdHash: string;
    mobileHash: string;
    mobileMasked: string;
    amountRial: bigint;
  }) {
    const where = {
      integrationId_orderId_sessionIdHash: {
        integrationId: input.integration.id,
        orderId: input.order.id,
        sessionIdHash: input.sessionIdHash,
      },
    };
    const existing = await prisma.ussdPaymentIntent.findUnique({ where });
    if (existing) return toIntentProjection(existing);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const merchantFactorId = generateBazarBaazFactorId();
        const paymentRequest = await tx.paymentRequest.create({
          data: {
            organizationId: input.integration.organizationId,
            orderId: input.order.id,
            providerIntegrationId: input.integration.id,
            amountRial: input.amountRial,
            currency: "IRR",
            purpose: "ORDER_PAYMENT",
            status: "AWAITING_CUSTOMER",
            metadata: {
              source: "INOTI_USSD",
              merchantFactorId,
              amountUnit: "IRR",
            },
          },
        });
        const providerAttempt = await tx.paymentProviderAttempt.create({
          data: {
            organizationId: input.integration.organizationId,
            paymentRequestId: paymentRequest.id,
            providerIntegrationId: input.integration.id,
            provider: "INOTI_USSD",
            status: "AWAITING_CUSTOMER",
            amountRial: input.amountRial,
            merchantFactorId,
          },
        });
        return tx.ussdPaymentIntent.create({
          data: {
            organizationId: input.integration.organizationId,
            integrationId: input.integration.id,
            orderId: input.order.id,
            paymentRequestId: paymentRequest.id,
            providerAttemptId: providerAttempt.id,
            merchantFactorId,
            amountRial: input.amountRial,
            sessionIdHash: input.sessionIdHash,
            mobileHash: input.mobileHash,
            mobileMasked: input.mobileMasked,
          },
        });
      });
      return toIntentProjection(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await prisma.ussdPaymentIntent.findUnique({ where });
        if (raced) return toIntentProjection(raced);
      }
      throw error;
    }
  }

  async findPaymentIntent(integrationId: string, merchantFactorId: string) {
    const intent = await prisma.ussdPaymentIntent.findFirst({ where: { integrationId, merchantFactorId } });
    return intent ? toIntentProjection(intent) : null;
  }

  async recordCallbackEvent(input: Parameters<UssdIntegrationRepository["recordCallbackEvent"]>[0]) {
    try {
      await prisma.ussdCallbackEvent.create({
        data: {
          organizationId: input.integration.organizationId,
          integrationId: input.integration.id,
          paymentIntentId: input.paymentIntentId ?? null,
          idempotencyKey: input.idempotencyKey,
          sessionIdHash: input.sessionIdHash,
          mobileHash: input.mobileHash,
          callHash: input.callHash,
          rrnHash: input.rrnHash ?? null,
          outcome: input.outcome,
          errorCode: input.errorCode ?? null,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    }
  }

  async markPaymentVerificationStarted(input: Parameters<UssdIntegrationRepository["markPaymentVerificationStarted"]>[0]) {
    await prisma.$transaction(async (tx) => {
      await tx.ussdPaymentIntent.updateMany({
        where: {
          id: input.intent.id,
          integrationId: input.integration.id,
          organizationId: input.integration.organizationId,
          status: { not: "SETTLED" },
        },
        data: {
          status: "VERIFYING",
          providerFactorId: input.providerFactorId,
          rrn: input.rrn,
        },
      });
      if (input.intent.paymentRequestId) {
        await tx.paymentRequest.update({
          where: { id_organizationId: { id: input.intent.paymentRequestId, organizationId: input.integration.organizationId } },
          data: { status: "PENDING_VERIFICATION", providerReference: input.providerFactorId },
        });
      }
      if (input.intent.providerAttemptId) {
        await tx.paymentProviderAttempt.update({
          where: { id_organizationId: { id: input.intent.providerAttemptId, organizationId: input.integration.organizationId } },
          data: {
            status: "PENDING_VERIFICATION",
            providerFactorId: input.providerFactorId,
            rrn: input.rrn,
            callbackEvidence: {
              provider: "INOTI_USSD",
              evidenceType: "CALLBACK_UNTRUSTED",
            },
            callbackReceivedAt: new Date(),
            verificationStartedAt: new Date(),
          },
        });
      }
    });
  }

  async markPaymentVerificationFailed(input: Parameters<UssdIntegrationRepository["markPaymentVerificationFailed"]>[0]) {
    await prisma.$transaction(async (tx) => {
      await tx.ussdPaymentIntent.updateMany({
        where: {
          id: input.intent.id,
          integrationId: input.integration.id,
          organizationId: input.integration.organizationId,
          status: { not: "SETTLED" },
        },
        data: {
          status: "REJECTED",
          providerResult: input.reason.slice(0, 64),
        },
      });
      if (input.intent.paymentRequestId) {
        await tx.paymentRequest.update({
          where: { id_organizationId: { id: input.intent.paymentRequestId, organizationId: input.integration.organizationId } },
          data: { status: "FAILED", failedAt: new Date() },
        });
      }
      if (input.intent.providerAttemptId) {
        await tx.paymentProviderAttempt.update({
          where: { id_organizationId: { id: input.intent.providerAttemptId, organizationId: input.integration.organizationId } },
          data: {
            status: "FAILED",
            failureReason: input.reason.slice(0, 256),
          },
        });
      }
    });
  }

  async settleVerifiedPayment(input: PaymentSettlementInput): Promise<PaymentSettlementResult> {
    try {
      return await prisma.$transaction(async (tx) => {
      const priorEvent = await tx.ussdCallbackEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (priorEvent) return { kind: "DUPLICATE", notification: null };

      const intent = await tx.ussdPaymentIntent.findFirst({
        where: {
          id: input.intent.id,
          integrationId: input.integration.id,
          organizationId: input.integration.organizationId,
        },
        include: {
          order: {
            include: {
              guestCustomer: { select: { phone: true } },
            },
          },
        },
      });
      if (!intent) throw new Error("PAYMENT_INTENT_NOT_FOUND");

      if (intent.status === "SETTLED") {
        await tx.ussdCallbackEvent.create({
          data: {
            organizationId: input.integration.organizationId,
            integrationId: input.integration.id,
            paymentIntentId: intent.id,
            idempotencyKey: input.idempotencyKey,
            sessionIdHash: input.sessionIdHash,
            mobileHash: input.mobileHash,
            callHash: input.callHash,
            rrnHash: input.rrnHash,
            outcome: "DUPLICATE",
          },
        });
        return { kind: "DUPLICATE", notification: null };
      }

      const previousStatus = intent.order.paymentStatus;
      await tx.ussdPaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: "SETTLED",
          providerFactorId: input.providerFactorId,
          rrn: input.rrn,
          providerResult: input.providerResult.slice(0, 64),
          verifiedAt: new Date(),
          settledAt: new Date(),
        },
      });
      if (intent.paymentRequestId) {
        await tx.paymentRequest.update({
          where: { id_organizationId: { id: intent.paymentRequestId, organizationId: input.integration.organizationId } },
          data: {
            status: "PAID",
            providerReference: input.providerFactorId,
            paidAt: new Date(),
          },
        });
      }
      if (intent.providerAttemptId) {
        await tx.paymentProviderAttempt.update({
          where: { id_organizationId: { id: intent.providerAttemptId, organizationId: input.integration.organizationId } },
          data: {
            status: "VERIFIED",
            providerFactorId: input.providerFactorId,
            rrn: input.rrn,
            providerResult: input.providerResult.slice(0, 64),
            verificationEvidence: {
              provider: "INOTI_USSD",
              verification: "GetPayments",
              amountRial: intent.amountRial.toString(),
            },
            verifiedAt: new Date(),
          },
        });
      }
      await tx.order.update({
        where: { id: intent.orderId },
        data: {
          paymentStatus: "COMPLETED",
          paymentMethod: "BANK_TRANSFER",
          paymentId: input.providerFactorId,
          paidAt: new Date(),
          payment: {
            upsert: {
              create: {
                amount: intent.order.total,
                method: "BANK_TRANSFER",
                status: "COMPLETED",
                transactionId: input.providerFactorId,
                metadata: { provider: "INOTI_USSD", merchantFactorId: intent.merchantFactorId },
              },
              update: {
                status: "COMPLETED",
                method: "BANK_TRANSFER",
                transactionId: input.providerFactorId,
                metadata: { provider: "INOTI_USSD", merchantFactorId: intent.merchantFactorId },
              },
            },
          },
        },
      });
      if (previousStatus !== "COMPLETED") {
        await tx.paymentEvent.create({
          data: {
            orderId: intent.orderId,
            previousStatus,
            newStatus: "COMPLETED",
            method: "BANK_TRANSFER",
            amount: intent.order.total,
            transactionId: input.providerFactorId,
            note: "Verified iNoti USSD payment",
          },
        });
      }
      await tx.ussdCallbackEvent.create({
        data: {
          organizationId: input.integration.organizationId,
          integrationId: input.integration.id,
          paymentIntentId: intent.id,
          idempotencyKey: input.idempotencyKey,
          sessionIdHash: input.sessionIdHash,
          mobileHash: input.mobileHash,
          callHash: input.callHash,
          rrnHash: input.rrnHash,
          outcome: "ACCEPTED",
        },
      });
      await tx.auditLog.create({
        data: {
          action: "CHANGE_STATUS",
          entityType: "UssdPaymentIntent",
          entityId: intent.id,
          description: "iNoti USSD payment verified and settled",
          previousValue: { paymentStatus: previousStatus },
          newValue: { paymentStatus: "COMPLETED", provider: "INOTI_USSD", merchantFactorId: intent.merchantFactorId },
          organizationId: input.integration.organizationId,
          organizationSlug: input.integration.organizationSlug,
        },
      });

      return {
        kind: "SETTLED",
        notification: previousStatus === "COMPLETED" ? null : {
          intentId: intent.id,
          organizationId: input.integration.organizationId,
          orderId: intent.order.id,
          orderNumber: intent.order.orderNumber,
          previousStatus,
          customerId: intent.order.customerId,
          guestCustomerId: intent.order.guestCustomerId,
          guestPhone: intent.order.guestCustomer?.phone ?? null,
        },
        };
      }, { maxWait: 10_000, timeout: 10_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await prisma.ussdCallbackEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (winner) return { kind: "DUPLICATE", notification: null };
      }
      throw error;
    }
  }

  async markNotificationAttempted(intentId: string) {
    await prisma.ussdPaymentIntent.update({ where: { id: intentId }, data: { notificationAttemptedAt: new Date() } });
  }
}

export const prismaUssdIntegrationRepository = new PrismaUssdIntegrationRepository();
