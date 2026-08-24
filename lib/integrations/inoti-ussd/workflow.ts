import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { customerOrderLifecycleRouter } from "@/lib/notifications/customer-order-lifecycle-router";
import { tomanDecimalToRial } from "@/lib/integrations/inoti-ussd/currency";
import { parseUssdQuery, UssdParseError } from "@/lib/integrations/inoti-ussd/parser";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import {
  prismaUssdIntegrationRepository,
  type UssdIntegrationRepository,
} from "@/lib/integrations/inoti-ussd/repository";
import { isValidInotiUssdPublicIntegrationId } from "@/lib/integrations/inoti-ussd/callback-url";
import type {
  ParsedUssdRequest,
  ResolvedInotiIntegration,
  UssdProvider,
  InotiCredentialProfile,
} from "@/lib/integrations/inoti-ussd/types";
import { environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import { inotiLivePaymentsAllowed } from "@/lib/integrations/inoti-runtime-safety";
import { describeSessionIdSyntax, sessionIdParseFailureReason } from "@/lib/integrations/inoti-ussd/session-syntax";
import { diagnosticCall, safeParameterNames } from "@/lib/integrations/inoti-ussd/request-diagnostics";

const INVALID_RESPONSE = "درخواست نامعتبر است";
const UNAVAILABLE_RESPONSE = "سرویس در دسترس نیست";
const PAYMENT_FAILED_RESPONSE = "تایید پرداخت ناموفق بود";
const EXPIRED_SESSION_RESPONSE = "جلسه منقضی شده است";
const USSD_SESSION_TTL_MS = 30 * 60 * 1000;

type UssdRequestContext = {
  method?: string;
  startedAtMs?: number;
};

function getHashPepper() {
  const pepper = process.env.INOTI_USSD_HASH_PEPPER;
  if (pepper) return pepper;
  if (process.env.NODE_ENV === "production") throw new Error("INOTI_USSD_HASH_PEPPER_REQUIRED");
  return process.env.NEXTAUTH_SECRET || "inoti-ussd-local-test-pepper";
}

function hashSensitive(value: string) {
  return createHash("sha256").update(getHashPepper()).update("\0").update(value).digest("hex");
}

function sameText(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function maskMobile(mobile: string) {
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}

function paymentCallbackIdentity(integrationId: string, request: ParsedUssdRequest) {
  return hashSensitive([integrationId, request.sessionId, request.mobile, request.call, request.rrn ?? ""].join("|"));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "در انتظار بررسی",
    PLACED: "ثبت شده",
    ACCEPTED: "پذیرفته شده",
    PREPARING: "در حال آماده‌سازی",
    READY: "آماده",
    PICKED_UP: "تحویل پیک",
    DELIVERED: "ارسال شده",
    RECEIVED: "تحویل شده",
    CANCELLED: "لغو شده",
    REFUNDED: "بازپرداخت شده",
  };
  return labels[status] ?? "در حال بررسی";
}

function limitsAllow(integrationId?: string, sessionHash?: string) {
  if (!integrationId && !sessionHash && !checkRateLimit({ key: "inoti:global", limit: 600, windowMs: 60_000 }).allowed) return false;
  if (integrationId && !checkRateLimit({ key: `inoti:integration:${integrationId}`, limit: 120, windowMs: 60_000 }).allowed) return false;
  if (sessionHash && !checkRateLimit({ key: `inoti:session:${sessionHash}`, limit: 30, windowMs: 60_000 }).allowed) return false;
  return true;
}

function normalizeHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

function hostsMatch(requestHost: string, callbackOrigin: string): boolean {
  const normalizedRequestHost = normalizeHost(requestHost);
  const normalizedCallbackHost = normalizeHost(new URL(callbackOrigin).host);
  return normalizedRequestHost === normalizedCallbackHost;
}

function parseFailureSessionHash(searchParams: URLSearchParams, integrationId: string) {
  const values = searchParams.getAll("sessionid");
  const rawSessionId = values.length === 1 ? values[0] ?? "" : "";
  return hashSensitive(rawSessionId && rawSessionId.length <= 512 ? rawSessionId : `invalid-session:${integrationId}`);
}

function parseFailureMetadata(searchParams: URLSearchParams, error: UssdParseError, context?: UssdRequestContext) {
  const parameterNames = safeParameterNames(searchParams);
  const callDiagnostic = diagnosticCall(searchParams);
  const sessionSyntax = describeSessionIdSyntax(searchParams);
  return {
    reason: "REQUEST_PARSE_REJECTED",
    parseErrorCode: error.code,
    requestMethod: context?.method ?? "UNKNOWN",
    parameterNames,
    parameterNameCount: parameterNames.length,
    ...callDiagnostic,
    callValueCount: searchParams.getAll("call").length,
    mobilePresent: searchParams.has("mobile"),
    mobileValueCount: searchParams.getAll("mobile").length,
    ...sessionSyntax,
    sessionidValidationReason: sessionIdParseFailureReason(error.code, sessionSyntax),
    rrnPresent: searchParams.has("RRN") || searchParams.has("rrn"),
    rrnValueCount: searchParams.getAll("RRN").length + searchParams.getAll("rrn").length,
    responseStatus: 200,
    responseContentType: "text/plain; charset=utf-8",
    responseBody: INVALID_RESPONSE,
    responseLatencyMs: Math.max(0, Date.now() - (context?.startedAtMs ?? Date.now())),
  };
}

export class InotiUssdWorkflow {
  constructor(
    private readonly repository: UssdIntegrationRepository,
    private readonly provider: UssdProvider,
    private readonly credentialProvider: { resolveProfile(organizationId: string, profileKey: string | null): Promise<InotiCredentialProfile | null> },
    private readonly notifyPayment: typeof customerOrderLifecycleRouter.notifyPaymentStatusChangedSafe =
      customerOrderLifecycleRouter.notifyPaymentStatusChangedSafe.bind(customerOrderLifecycleRouter),
  ) {}

  async handle(
    publicIntegrationId: string,
    requestHost: string | null,
    searchParams: URLSearchParams,
    context?: UssdRequestContext,
  ): Promise<string> {
    if (!limitsAllow()) return UNAVAILABLE_RESPONSE;
    if (!isValidInotiUssdPublicIntegrationId(publicIntegrationId)) {
      return INVALID_RESPONSE;
    }

    const integration = await this.repository.resolveIntegration(publicIntegrationId);
    if (!integration || integration.status !== "ACTIVE") return UNAVAILABLE_RESPONSE;

    if (integration.callbackOrigin && requestHost && !hostsMatch(requestHost, integration.callbackOrigin)) {
      return INVALID_RESPONSE;
    }

    let request: ParsedUssdRequest;
    try {
      request = parseUssdQuery(searchParams, integration.codeName);
    } catch (error) {
      if (error instanceof UssdParseError) {
        await this.recordEvent(
          integration,
          parseFailureSessionHash(searchParams, integration.id),
          "USSD_ERROR",
          parseFailureMetadata(searchParams, error, context),
        );
        return INVALID_RESPONSE;
      }
      return UNAVAILABLE_RESPONSE;
    }

    const sessionIdHash = hashSensitive(request.sessionId);
    if (!limitsAllow(integration.id, sessionIdHash)) return UNAVAILABLE_RESPONSE;

    const existingSession = await this.repository.findUssdSession(integration.id, sessionIdHash);
    const isNewSession = !existingSession;
    if (existingSession && existingSession.lastSeenAt.getTime() < Date.now() - USSD_SESSION_TTL_MS) {
      await this.repository.touchUssdSession({
        integrationId: integration.id,
        organizationId: integration.organizationId,
        sessionIdHash,
        lastAction: "EXPIRED",
        status: "EXPIRED",
      });
      await this.recordEvent(integration, sessionIdHash, "USSD_ERROR", { reason: "SESSION_EXPIRED" });
      return EXPIRED_SESSION_RESPONSE;
    }

    const action = request.rrn ? "CALLBACK" : request.segments.length === 2 ? "MENU" : request.segments[2];
    await this.repository.touchIntegration(integration.id);
    await this.repository.touchUssdSession({
      integrationId: integration.id,
      organizationId: integration.organizationId,
      sessionIdHash,
      lastAction: action,
      status: "ACTIVE",
    });

    if (isNewSession) {
      await this.recordEvent(integration, sessionIdHash, "USSD_SESSION_STARTED");
    }

    if (request.rrn) {
      await this.recordEvent(integration, sessionIdHash, "USSD_CALLBACK_RECEIVED");
      return this.handlePaymentCallback(integration, request, sessionIdHash);
    }
    if (request.segments.length === 2) {
      await this.recordEvent(integration, sessionIdHash, "USSD_MENU_SHOWN");
      const choices = [
        integration.config.orderStatusEnabled ? "1-وضعیت سفارش" : null,
        integration.config.paymentEnabled ? "2-پرداخت سفارش" : null,
      ].filter((value): value is string => Boolean(value));
      return choices.length ? choices.join("\n") : UNAVAILABLE_RESPONSE;
    }
    if (request.segments.length !== 4) return INVALID_RESPONSE;

    const command = request.segments[2];
    const trackingToken = request.segments[3];
    if (!trackingToken || trackingToken.length > 64) return INVALID_RESPONSE;
    if (command === "1") {
      await this.recordEvent(integration, sessionIdHash, "USSD_ORDER_STATUS_REQUESTED", { trackingToken });
      return this.handleOrderStatus(integration, trackingToken);
    }
    if (command === "2") {
      await this.recordEvent(integration, sessionIdHash, "USSD_PAYMENT_SELECTED", { trackingToken });
      return this.handlePaymentRequest(integration, request, trackingToken, sessionIdHash);
    }
    return INVALID_RESPONSE;
  }

  private async recordEvent(
    integration: ResolvedInotiIntegration,
    sessionIdHash: string,
    eventType: "USSD_SESSION_STARTED" | "USSD_MENU_SHOWN" | "USSD_ORDER_STATUS_REQUESTED" | "USSD_PAYMENT_SELECTED" | "USSD_PAYMENT_CREATED" | "USSD_CALLBACK_RECEIVED" | "USSD_PROVIDER_VERIFICATION_STARTED" | "USSD_PROVIDER_VERIFICATION_FAILED" | "USSD_SETTLEMENT_BLOCKED" | "USSD_ERROR",
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.repository.recordUssdEvent({
        organizationId: integration.organizationId,
        integrationId: integration.id,
        sessionIdHash,
        eventType,
        metadata: metadata as any,
      });
    } catch {
      // observability must not break USSD flow
    }
  }

  private async handleOrderStatus(integration: ResolvedInotiIntegration, trackingToken: string) {
    if (!integration.config.orderStatusEnabled) return UNAVAILABLE_RESPONSE;
    const order = await this.repository.findOrderByTrackingToken(integration, trackingToken);
    return order ? `وضعیت سفارش: ${statusLabel(order.status)}` : "سفارش یافت نشد";
  }

  private async handlePaymentRequest(
    integration: ResolvedInotiIntegration,
    request: ParsedUssdRequest,
    trackingToken: string,
    sessionIdHash: string,
  ) {
    if (!integration.config.paymentEnabled) {
      return "پرداخت در دسترس نیست";
    }
    const credentialProfile = await this.credentialProvider.resolveProfile(integration.organizationId, integration.credentialProfileKey);
    const readiness = this.provider.getReadiness(credentialProfile);
    if (!readiness.ready) {
      return "پرداخت در دسترس نیست";
    }

    const order = await this.repository.findOrderByTrackingToken(integration, trackingToken);
    if (!order) return "سفارش یافت نشد";
    if (order.paymentStatus === "COMPLETED") return "سفارش قبلا پرداخت شده است";

    let amountRial: bigint;
    try {
      amountRial = tomanDecimalToRial(order.totalToman);
    } catch {
      return "مبلغ سفارش نامعتبر است";
    }
    const intent = await this.repository.createOrGetPaymentIntent({
      integration,
      order,
      sessionIdHash,
      mobileHash: hashSensitive(request.mobile),
      mobileMasked: maskMobile(request.mobile),
      amountRial,
    });
    if (intent.status === "SETTLED") return "سفارش قبلا پرداخت شده است";
    if (intent.amountRial !== amountRial) return "مبلغ سفارش نامعتبر است";
    await this.recordEvent(integration, sessionIdHash, "USSD_PAYMENT_CREATED", {
      intentId: intent.id,
      merchantFactorId: intent.merchantFactorId,
      amountRial: intent.amountRial.toString(),
    });
    return `9900|${intent.merchantFactorId}|${intent.amountRial.toString()}`;
  }

  private async handlePaymentCallback(
    integration: ResolvedInotiIntegration,
    request: ParsedUssdRequest,
    sessionIdHash: string,
  ) {
    const credentialProfile = await this.credentialProvider.resolveProfile(integration.organizationId, integration.credentialProfileKey);
    const readiness = this.provider.getReadiness(credentialProfile);
    const mobileHash = hashSensitive(request.mobile);
    const callHash = hashSensitive(request.call);
    const rrnHash = hashSensitive(request.rrn ?? "");
    const idempotencyKey = paymentCallbackIdentity(integration.id, request);
    const factors = request.segments.slice(-2);
    const merchantFactorId = factors[0] ?? "";
    const providerFactorId = factors[1] ?? "";

    if (
      !integration.config.paymentEnabled ||
      !readiness.ready ||
      !/^BZ[A-Fa-f0-9]{32}$/.test(merchantFactorId) ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(providerFactorId)
    ) {
      await this.repository.recordCallbackEvent({
        integration, idempotencyKey, sessionIdHash, mobileHash, callHash, rrnHash,
        outcome: "REJECTED", errorCode: readiness.ready ? "INVALID_PAYMENT_CALLBACK" : readiness.code,
      });
      return PAYMENT_FAILED_RESPONSE;
    }

    const intent = await this.repository.findPaymentIntent(integration.id, merchantFactorId);
    if (!intent || !sameText(intent.sessionIdHash, sessionIdHash) || !sameText(intent.mobileHash, mobileHash)) {
      await this.repository.recordCallbackEvent({
        integration, paymentIntentId: intent?.id, idempotencyKey, sessionIdHash, mobileHash, callHash, rrnHash,
        outcome: "REJECTED", errorCode: "INTENT_CONTEXT_MISMATCH",
      });
      return PAYMENT_FAILED_RESPONSE;
    }

    if (intent.status === "SETTLED") {
      const exactReplay = intent.providerFactorId && intent.rrn &&
        sameText(intent.providerFactorId, providerFactorId) &&
        sameText(intent.rrn, request.rrn ?? "");
      await this.repository.recordCallbackEvent({
        integration, paymentIntentId: intent.id, idempotencyKey, sessionIdHash, mobileHash, callHash, rrnHash,
        outcome: exactReplay ? "DUPLICATE" : "REJECTED",
        errorCode: exactReplay ? null : "SETTLED_INTENT_REPLAY_MISMATCH",
      });
      return exactReplay ? "پرداخت تایید شد" : PAYMENT_FAILED_RESPONSE;
    }

    await this.repository.markPaymentVerificationStarted({
      integration,
      intent,
      providerFactorId,
      rrn: request.rrn ?? "",
    });
    await this.recordEvent(integration, sessionIdHash, "USSD_PROVIDER_VERIFICATION_STARTED", {
      intentId: intent.id,
      merchantFactorId: intent.merchantFactorId,
    });

    const verification = await this.provider.verifyPayment(credentialProfile, {
      codeName: integration.codeName,
      sessionId: request.sessionId,
      mobile: request.mobile,
      amountRial: intent.amountRial,
      merchantFactorId,
      providerFactorId,
      rrn: request.rrn ?? "",
    });
    if ("code" in verification) {
      await this.repository.markPaymentVerificationFailed({ integration, intent, reason: `PROVIDER_${verification.code}` });
      await this.repository.recordCallbackEvent({
        integration, paymentIntentId: intent.id, idempotencyKey, sessionIdHash, mobileHash, callHash, rrnHash,
        outcome: "FAILED", errorCode: `PROVIDER_${verification.code}`,
      });
      await this.recordEvent(integration, sessionIdHash, "USSD_PROVIDER_VERIFICATION_FAILED", {
        intentId: intent.id,
        code: verification.code,
      });
      return PAYMENT_FAILED_RESPONSE;
    }

    const record = verification.record;
    const verified = record.successful &&
      sameText(record.sessionId, request.sessionId) &&
      sameText(record.mobile, request.mobile) &&
      record.amountRial === intent.amountRial &&
      sameText(record.merchantFactorId, merchantFactorId) &&
      sameText(record.providerFactorId, providerFactorId) &&
      sameText(record.rrn, request.rrn ?? "");
    if (!verified) {
      await this.repository.markPaymentVerificationFailed({ integration, intent, reason: "PROVIDER_RECORD_MISMATCH" });
      await this.repository.recordCallbackEvent({
        integration, paymentIntentId: intent.id, idempotencyKey, sessionIdHash, mobileHash, callHash, rrnHash,
        outcome: "REJECTED", errorCode: "PROVIDER_RECORD_MISMATCH",
      });
      return PAYMENT_FAILED_RESPONSE;
    }

    if (!inotiLivePaymentsAllowed()) {
      await this.repository.recordCallbackEvent({
        integration, paymentIntentId: intent.id, idempotencyKey, sessionIdHash, mobileHash, callHash, rrnHash,
        outcome: "REJECTED", errorCode: "PAYMENT_SETTLEMENT_DISABLED",
      });
      await this.recordEvent(integration, sessionIdHash, "USSD_SETTLEMENT_BLOCKED", {
        intentId: intent.id,
        merchantFactorId: intent.merchantFactorId,
      });
      return PAYMENT_FAILED_RESPONSE;
    }

    try {
      const settlement = await this.repository.settleVerifiedPayment({
        integration,
        intent,
        idempotencyKey,
        sessionIdHash,
        mobileHash,
        callHash,
        rrnHash,
        rrn: record.rrn,
        providerFactorId: record.providerFactorId,
        providerResult: record.result,
      });
      if (settlement.notification) {
        try {
          await this.notifyPayment({
            organizationId: settlement.notification.organizationId,
            orderId: settlement.notification.orderId,
            orderNumber: settlement.notification.orderNumber,
            previousStatus: settlement.notification.previousStatus,
            newStatus: "COMPLETED",
            customerId: settlement.notification.customerId,
            guestCustomerId: settlement.notification.guestCustomerId,
            guestPhone: settlement.notification.guestPhone,
            actorUserId: null,
          });
          await this.repository.markNotificationAttempted(settlement.notification.intentId);
        } catch {
          await this.repository.recordCallbackEvent({
            integration,
            paymentIntentId: settlement.notification.intentId,
            idempotencyKey,
            sessionIdHash,
            mobileHash,
            callHash,
            rrnHash,
            outcome: "FAILED",
            errorCode: "NOTIFICATION_FAILED",
          });
        }
      }
      return "پرداخت تایید شد";
    } catch {
      return PAYMENT_FAILED_RESPONSE;
    }
  }
}

export const inotiUssdWorkflow = new InotiUssdWorkflow(prismaUssdIntegrationRepository, inotiUssdProvider, environmentInotiCredentialProvider);
