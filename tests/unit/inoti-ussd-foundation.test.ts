import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tomanDecimalToRial } from "@/lib/integrations/inoti-ussd/currency";
import { normalizeIranianMobile, parseUssdQuery, UssdParseError } from "@/lib/integrations/inoti-ussd/parser";
import { InotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { InotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { parseProviderRialAmount } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { buildInotiUssdCallbackUrl, isValidInotiUssdPublicIntegrationId } from "@/lib/integrations/inoti-ussd/callback-url";
import { inotiPlainTextResponse } from "@/lib/integrations/inoti-ussd/response";
import { InotiSmsProvider } from "@/lib/integrations/inoti-sms/provider";
import { classifyFetchError, classifyProviderTimeout, latencyBucket, secretDiagnostics } from "@/lib/integrations/inoti-diagnostics";
import { updateInotiUssdIntegrationSchema } from "@/lib/validators/inoti-ussd";
import { describeSessionIdSyntax, sessionIdParseFailureReason } from "@/lib/integrations/inoti-ussd/session-syntax";
import type {
  InotiCredentialProfile,
  InotiPaymentVerificationQuery,
  InotiVerificationResult,
  PaymentSettlementInput,
  PaymentSettlementResult,
  ResolvedInotiIntegration,
  UssdIntegrationRepository,
  UssdOrderProjection,
  UssdPaymentIntentProjection,
  UssdProvider,
} from "@/lib/integrations/inoti-ussd/types";

const integrationA: ResolvedInotiIntegration = {
  id: "integration-a",
  publicId: "11111111-1111-4111-8111-111111111111",
  organizationId: "tenant-a",
  organizationSlug: "tenant-a",
  status: "ACTIVE",
  codeName: "alpha",
  credentialProfileKey: "INOTI_DEFAULT",
  callbackOrigin: null,
  config: { orderStatusEnabled: true, paymentEnabled: true },
};
const integrationB: ResolvedInotiIntegration = {
  ...integrationA,
  id: "integration-b",
  publicId: "22222222-2222-4222-8222-222222222222",
  organizationId: "tenant-b",
  organizationSlug: "tenant-b",
  codeName: "beta",
};
const factor = `BZ${"a".repeat(32)}`;

describe("iNoti public integration identity", () => {
  it("builds canonical BazarBaaz callback URLs from stable UUID public IDs", () => {
    assert.equal(isValidInotiUssdPublicIntegrationId(integrationA.publicId), true);
    assert.equal(isValidInotiUssdPublicIntegrationId("tenant-a"), false);
    assert.equal(
      buildInotiUssdCallbackUrl(integrationA.publicId),
      `https://bazarbaaz.ir/api/integrations/inoti/ussd/${integrationA.publicId}`,
    );
    assert.throws(() => buildInotiUssdCallbackUrl("tenant-a"));
  });
});

describe("iNoti live read-only provider probes", () => {
  it("normalizes diagnostics without leaking secret contents", () => {
    assert.deepEqual(classifyFetchError(new DOMException("aborted", "AbortError")), "REQUEST_TIMEOUT");
    assert.equal(classifyProviderTimeout({
      providerCode: "TIMEOUT",
      dns: "RESOLVED",
      tcp: "TCP_CONNECTED",
      tls: "TLS_SUCCEEDED",
    }), "PROVIDER_RESPONSE_TIMEOUT");
    assert.equal(classifyProviderTimeout({
      providerCode: "TIMEOUT",
      dns: "DNS_ERROR",
      tcp: "TCP_ERROR",
      tls: "TLS_ERROR",
    }), "DNS_ERROR");
    assert.equal(latencyBucket(250), "FAST");
    assert.equal(latencyBucket(2_500), "NORMAL");
    assert.equal(latencyBucket(6_000), "SLOW");
    assert.equal(latencyBucket(9_000), "TIMEOUT");
    assert.deepEqual(secretDiagnostics(" secret\n"), {
      present: true,
      nonEmpty: true,
      length: 8,
      trimmedEqualsOriginal: false,
      containsWhitespace: true,
    });
  });

  it("parses SMS ActiveLines without exposing sender numbers", async () => {
    const originalFetch = globalThis.fetch;
    let body = "";
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({
        ObjActiveLinesOutput: [
          { LineNumber: "300012345", LineType: "SERVICE", PriceEn: 1, PriceFa: 2 },
          { LineNumber: "300067890", LineType: "OTP", PriceEn: 1, PriceFa: 2 },
        ],
        Status: 1,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    try {
      const result = await new InotiSmsProvider().activeLinesReadOnly({
        organizationId: "tenant-a",
        profileKey: "local-env:inoti:aka-shoes",
        username: "user",
        password: "pass",
        endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx",
        smsToken: "secret-token",
      });
      assert.equal(result.ok, true);
      assert.equal(result.ok && result.activeLineCount, 2);
      assert.deepEqual(result.ok && result.lineTypes, ["OTP", "SERVICE"]);
      assert.match(body, /"Token":"secret-token"/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses a narrow GetPayments read-only probe with IsAll=false and a single merchant factor", async () => {
    const originalFetch = globalThis.fetch;
    let requestBody = "";
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body ?? "");
      return new Response(
        `<?xml version="1.0"?><soap:Envelope><soap:Body><GetPaymentsResponse><GetPaymentsResult>[]</GetPaymentsResult></GetPaymentsResponse></soap:Body></soap:Envelope>`,
        { status: 200, headers: { "content-type": "text/xml" } },
      );
    }) as typeof fetch;
    try {
      const result = await new InotiUssdProvider().probeReadOnlyPayments({
        credentialProfile: {
          organizationId: "tenant-a",
          profileKey: "local-env:inoti:cafe-leo",
          username: "user",
          password: "pass",
          endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx",
          ussdCodeName: "09126511010",
        },
        codeName: "09126511010",
        merchantFactorId: `BZ${"b".repeat(32)}`,
      });
      assert.deepEqual(result, { ok: true, code: "VERIFIED_READ_ONLY" });
      assert.match(requestBody, /<IsAll>false<\/IsAll>/);
      assert.match(requestBody, /<YourFactorID>BZbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb<\/YourFactorID>/);
      assert.match(requestBody, /<CodeName>09126511010<\/CodeName>/);
      assert.doesNotMatch(requestBody, /<Mobile>09/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("classifies YourFactorID provider validation separately from SOAP contract failures", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(
      `<?xml version="1.0"?><soap:Envelope><soap:Body><GetPaymentsResponse><GetPaymentsResult>YourFactorID Error</GetPaymentsResult></GetPaymentsResponse></soap:Body></soap:Envelope>`,
      { status: 200, headers: { "content-type": "text/xml" } },
    )) as typeof fetch;
    try {
      assert.deepEqual(await new InotiUssdProvider().probeReadOnlyPayments({
        credentialProfile: {
          organizationId: "tenant-a",
          profileKey: "local-env:inoti:cafe-leo",
          username: "user",
          password: "pass",
          endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx",
          ussdCodeName: "09126511010",
        },
        codeName: "09126511010",
        merchantFactorId: `BZ${"c".repeat(32)}`,
      }), { ok: false, code: "PROVIDER_VALIDATION_ERROR" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

class FakeCredentialProvider {
  async resolveProfile(): Promise<InotiCredentialProfile | null> {
    return {
      organizationId: "_organizationId",
      profileKey: "INOTI_DEFAULT",
      username: "x",
      password: "y",
      endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx",
    };
  }
}

function order(tenant: "a" | "b", overrides: Partial<UssdOrderProjection> = {}): UssdOrderProjection {
  return {
    id: `order-${tenant}`,
    orderNumber: `ORDER-${tenant.toUpperCase()}`,
    publicTrackingToken: `track-${tenant}`,
    status: "PREPARING",
    paymentStatus: "PENDING",
    paymentMethod: null,
    totalToman: "1250",
    customerId: `customer-${tenant}`,
    guestCustomerId: null,
    guestPhone: null,
    ...overrides,
  };
}

class FakeRepository implements UssdIntegrationRepository {
  integrations = new Map([[integrationA.publicId, integrationA], [integrationB.publicId, integrationB]]);
  orders = new Map([[`${integrationA.id}:track-a`, order("a")], [`${integrationB.id}:track-b`, order("b")]]);
  intents = new Map<string, UssdPaymentIntentProjection>();
  events: Array<{ outcome: string; errorCode?: string | null }> = [];
  settlementKeys = new Set<string>();
  notificationMarks = 0;

  async resolveIntegration(publicId: string) { return this.integrations.get(publicId) ?? null; }
  async touchIntegration() {}
  sessions = new Map<string, { lastSeenAt: Date; lastAction: string; status: string }>();
  async touchUssdSession(input: { integrationId: string; sessionIdHash: string; lastAction: string; status?: string }) {
    const key = `${input.integrationId}:${input.sessionIdHash}`;
    const existing = this.sessions.get(key);
    const now = new Date();
    this.sessions.set(key, {
      lastSeenAt: existing ? new Date(Math.min(existing.lastSeenAt.getTime(), now.getTime())) : now,
      lastAction: input.lastAction,
      status: input.status ?? "STARTED",
    });
  }
  async findUssdSession(integrationId: string, sessionIdHash: string) {
    const key = `${integrationId}:${sessionIdHash}`;
    const session = this.sessions.get(key);
    return session ? { lastSeenAt: session.lastSeenAt } : null;
  }
  ussdEvents: Array<{ eventType: string; sessionIdHash: string; metadata?: unknown }> = [];
  async recordUssdEvent(input: { sessionIdHash: string; eventType: string; metadata?: unknown }) {
    this.ussdEvents.push({ eventType: input.eventType, sessionIdHash: input.sessionIdHash, metadata: input.metadata });
  }
  async findOrderByTrackingToken(integration: ResolvedInotiIntegration, token: string) {
    return this.orders.get(`${integration.id}:${token}`) ?? null;
  }
  async createOrGetPaymentIntent(input: {
    integration: ResolvedInotiIntegration;
    order: UssdOrderProjection;
    sessionIdHash: string;
    mobileHash: string;
    mobileMasked: string;
    amountRial: bigint;
  }) {
    const key = `${input.integration.id}:${input.order.id}:${input.sessionIdHash}`;
    const existing = this.intents.get(key);
    if (existing) return existing;
    const intent: UssdPaymentIntentProjection = {
      id: `intent-${this.intents.size + 1}`,
      organizationId: input.integration.organizationId,
      integrationId: input.integration.id,
      orderId: input.order.id,
      paymentRequestId: null,
      providerAttemptId: null,
      merchantFactorId: factor,
      amountRial: input.amountRial,
      sessionIdHash: input.sessionIdHash,
      mobileHash: input.mobileHash,
      mobileMasked: input.mobileMasked,
      status: "REQUESTED",
      providerFactorId: null,
      rrn: null,
    };
    this.intents.set(key, intent);
    return intent;
  }
  async findPaymentIntent(integrationId: string, merchantFactorId: string) {
    return [...this.intents.values()].find((intent) => intent.integrationId === integrationId && intent.merchantFactorId === merchantFactorId) ?? null;
  }
  async recordCallbackEvent(input: { outcome: string; errorCode?: string | null }) {
    this.events.push({ outcome: input.outcome, errorCode: input.errorCode });
  }
  async markPaymentVerificationStarted() {}
  async markPaymentVerificationFailed() {}
  async settleVerifiedPayment(input: PaymentSettlementInput): Promise<PaymentSettlementResult> {
    if (this.settlementKeys.has(input.idempotencyKey) || input.intent.status === "SETTLED") {
      return { kind: "DUPLICATE", notification: null };
    }
    this.settlementKeys.add(input.idempotencyKey);
    input.intent.status = "SETTLED";
    input.intent.providerFactorId = input.providerFactorId;
    input.intent.rrn = input.rrn;
    return {
      kind: "SETTLED",
      notification: {
        intentId: input.intent.id,
        organizationId: input.integration.organizationId,
        orderId: input.intent.orderId,
        orderNumber: "ORDER-A",
        previousStatus: "PENDING",
        customerId: "customer-a",
        guestCustomerId: null,
        guestPhone: null,
      },
    };
  }
  async markNotificationAttempted() { this.notificationMarks += 1; }
}

class FakeProvider implements UssdProvider {
  ready = true;
  mode: "SUCCESS" | "TIMEOUT" | "MALFORMED" | "NOT_FOUND" = "SUCCESS";
  overrides: Partial<{
    sessionId: string; mobile: string; amountRial: bigint; merchantFactorId: string;
    providerFactorId: string; rrn: string; result: string; successful: boolean;
  }> = {};
  calls = 0;
  getReadiness(profile: InotiCredentialProfile | null) {
    void profile;
    return this.ready
      ? { ready: true, transportSecure: true, code: "READY" as const }
      : { ready: false, transportSecure: true, code: "CONFIG_DISABLED" as const };
  }
  async verifyPayment(profile: InotiCredentialProfile | null, query: InotiPaymentVerificationQuery): Promise<InotiVerificationResult> {
    void profile;
    this.calls += 1;
    if (this.mode === "TIMEOUT") return { ok: false, code: "TIMEOUT" };
    if (this.mode === "MALFORMED") return { ok: false, code: "MALFORMED_RESPONSE" };
    if (this.mode === "NOT_FOUND") return { ok: false, code: "NOT_FOUND" };
    return {
      ok: true,
      record: {
        sessionId: query.sessionId,
        mobile: query.mobile,
        amountRial: query.amountRial,
        merchantFactorId: query.merchantFactorId,
        providerFactorId: query.providerFactorId,
        rrn: query.rrn,
        result: "true",
        successful: true,
        ...this.overrides,
      },
    };
  }
}

function query(call: string, extras: Record<string, string> = {}) {
  return new URLSearchParams({ mobile: "09123456789", sessionid: "123456", call, ...extras });
}

describe("iNoti callback parser", () => {
  it("normalizes Persian/Arabic digits and common Iranian mobile forms", () => {
    assert.equal(normalizeIranianMobile("+۹۸ ۹۱۲-۳۴۵-۶۷۸۹"), "09123456789");
    const parsed = parseUssdQuery(new URLSearchParams({
      mobile: "۰۹۱۲۳۴۵۶۷۸۹", sessionid: "١٢٣٤", call: "*۶۶۵۵*alpha*۱*track-a#",
    }), "alpha");
    assert.equal(parsed.sessionId, "1234");
    assert.deepEqual(parsed.segments, ["6655", "alpha", "1", "track-a"]);
  });

  it("rejects missing, duplicate, malformed, wrong-scope, and oversized values", () => {
    for (const params of [
      new URLSearchParams({ sessionid: "1", call: "6655*alpha" }),
      new URLSearchParams("mobile=09123456789&mobile=09120000000&sessionid=1&call=6655*alpha"),
      query("6655*beta"),
      query(`6655*alpha*${"x".repeat(260)}`),
      new URLSearchParams({ mobile: "invalid", sessionid: "abc", call: "6655*alpha" }),
    ]) {
      assert.throws(() => parseUssdQuery(params, "alpha"), UssdParseError);
    }
  });

  it("treats 6655 as the provider prefix and matches organization CodeName on an exact segment boundary", () => {
    assert.deepEqual(parseUssdQuery(query("6655*12"), "12").segments, ["6655", "12"]);
    assert.deepEqual(parseUssdQuery(query("6655*87788778"), "87788778").segments, ["6655", "87788778"]);
    assert.throws(() => parseUssdQuery(query("6655*87788778"), "ussd-cmt666ew"), UssdParseError);
    assert.throws(() => parseUssdQuery(query("6655*123"), "12"), UssdParseError);
    assert.throws(() => parseUssdQuery(query("6655*12"), "123"), UssdParseError);
  });
});

describe("iNoti session syntax telemetry", () => {
  it("describes representative provider-safe syntax without retaining identity", () => {
    const cases = [
      { value: "123456789012345", shape: "DIGITS", flags: { sessionidDigitsOnlyRaw: true } },
      { value: "123e4567-e89b-12d3-a456-426614174000", shape: "UUID", flags: { sessionidUuidLike: true, sessionidContainsHyphen: true } },
      { value: "Qx9Zp7K2Lm", shape: "ALPHANUMERIC", flags: { sessionidAlphanumericLike: true, sessionidContainsAsciiLetters: true } },
      { value: "abc-123", shape: "MIXED_ASCII", flags: { sessionidContainsHyphen: true } },
      { value: "۱۲۳۴", shape: "NORMALIZED_DIGITS", flags: { sessionidContainsNonAscii: true, sessionidDigitsOnlyAfterNormalization: true } },
      { value: "١٢٣٤", shape: "NORMALIZED_DIGITS", flags: { sessionidContainsNonAscii: true, sessionidDigitsOnlyAfterNormalization: true } },
      { value: "  12345 \t", shape: "NORMALIZED_DIGITS", flags: { sessionidContainsWhitespace: true, sessionidDigitsOnlyRaw: false } },
      { value: "deadBEEF12", shape: "HEX", flags: { sessionidHexLike: true } },
      { value: "U2Vzc2lvbklEMTIzNA==", shape: "BASE64_LIKE", flags: { sessionidBase64Like: true, sessionidContainsEquals: true } },
      { value: "abc.def_1", shape: "MIXED_ASCII", flags: { sessionidContainsDot: true, sessionidContainsUnderscore: true } },
      { value: "abc:12/+=", shape: "MIXED_ASCII", flags: { sessionidContainsColon: true, sessionidContainsSlash: true, sessionidContainsPlus: true, sessionidContainsEquals: true } },
      { value: "شناسه", shape: "NON_ASCII", flags: { sessionidContainsNonAscii: true } },
    ] as const;

    for (const testCase of cases) {
      const metadata = describeSessionIdSyntax(new URLSearchParams({ sessionid: testCase.value }));
      assert.equal(metadata.sessionidShape, testCase.shape);
      assert.equal(metadata.sessionidCount, 1);
      assert.equal(metadata.sessionidRawLength, testCase.value.length);
      for (const [key, expected] of Object.entries(testCase.flags)) {
        assert.equal(metadata[key as keyof typeof metadata], expected, `${testCase.shape}:${key}`);
      }
      const serialized = JSON.stringify(metadata);
      assert.equal(serialized.includes(testCase.value), false);
      if (testCase.value.length >= 8) {
        assert.equal(serialized.includes(testCase.value.slice(0, 6)), false);
        assert.equal(serialized.includes(testCase.value.slice(-6)), false);
      }
    }
  });

  it("distinguishes empty, overlong, NUL, control, missing, and duplicate session IDs", () => {
    const empty = describeSessionIdSyntax(new URLSearchParams({ sessionid: "" }));
    assert.equal(empty.sessionidState, "EMPTY");
    assert.equal(empty.sessionidEmptyRaw, true);
    assert.equal(sessionIdParseFailureReason("INVALID_SESSIONID", empty), "SESSIONID_EMPTY");

    const overlong = describeSessionIdSyntax(new URLSearchParams({ sessionid: "a".repeat(65) }));
    assert.equal(overlong.sessionidTrimmedLength, 65);
    assert.equal(sessionIdParseFailureReason("INVALID_SESSIONID", overlong), "SESSIONID_TOO_LONG");

    const nul = describeSessionIdSyntax(new URLSearchParams({ sessionid: "abc\0def" }));
    assert.equal(nul.sessionidContainsNul, true);
    assert.equal(nul.sessionidContainsControlCharacter, true);
    assert.equal(sessionIdParseFailureReason("INVALID_SESSIONID", nul), "SESSIONID_NUL");

    const control = describeSessionIdSyntax(new URLSearchParams({ sessionid: "abc\u0001def" }));
    assert.equal(control.sessionidContainsControlCharacter, true);
    assert.equal(sessionIdParseFailureReason("INVALID_SESSIONID", control), "SESSIONID_NOT_NUMERIC_AFTER_NORMALIZATION");

    const missing = describeSessionIdSyntax(new URLSearchParams());
    assert.equal(missing.sessionidShape, "MISSING");
    assert.equal(sessionIdParseFailureReason("INVALID_SESSIONID", missing), "SESSIONID_COUNT_INVALID");

    const duplicateParams = new URLSearchParams();
    duplicateParams.append("sessionid", "first-private-value");
    duplicateParams.append("sessionid", "second-private-value");
    const duplicate = describeSessionIdSyntax(duplicateParams);
    assert.equal(duplicate.sessionidShape, "DUPLICATE");
    assert.equal(duplicate.sessionidRawLength, null);
    assert.doesNotMatch(JSON.stringify(duplicate), /first-private-value|second-private-value/);
  });

  it("keeps parser acceptance unchanged while real call reaches session validation", () => {
    assert.deepEqual(parseUssdQuery(query("6655*87788778", { sessionid: "۱۲۳۴" }), "87788778").segments, ["6655", "87788778"]);
    assert.throws(
      () => parseUssdQuery(query("6655*87788778", { sessionid: "provider-session-A" }), "87788778"),
      (error: unknown) => error instanceof UssdParseError && error.code === "INVALID_SESSIONID",
    );
  });
});

describe("iNoti amount conversion", () => {
  it("converts Decimal toman to integer rial without floating point", () => {
    assert.equal(tomanDecimalToRial("1250.00"), BigInt(12500));
    assert.equal(tomanDecimalToRial("0.1"), BigInt(1));
  });

  it("rejects zero, negative, fractional-rial, malformed, and extreme amounts", () => {
    for (const value of ["0", "-1", "0.01", "1e6", "1000000000000000000"]) {
      assert.throws(() => tomanDecimalToRial(value));
    }
  });

  it("canonicalizes provider double-shaped Price without using floating point", () => {
    assert.equal(parseProviderRialAmount("100000"), BigInt(100000));
    assert.equal(parseProviderRialAmount("100000.0"), BigInt(100000));
    assert.equal(parseProviderRialAmount("100000.000"), BigInt(100000));
    assert.equal(parseProviderRialAmount("100000.5"), null);
    assert.equal(parseProviderRialAmount("not-a-price"), null);
    assert.equal(parseProviderRialAmount("1000000000000000000"), null);
  });
});

describe("iNoti public response and admin metadata boundaries", () => {
  it("emits exact UTF-8 plain-text bytes without BOM, HTML, JSON quoting, or edge newlines", async () => {
    const expected = `9900|${factor}|100000`;
    const response = inotiPlainTextResponse(`\n${expected}\r\n`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(Buffer.from(bytes).toString("utf8"), expected);
    assert.notDeepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(Buffer.from(bytes).includes(Buffer.from("<html")), false);
    assert.notEqual(bytes[0], 0x22);
    assert.notEqual(bytes[0], 0x0a);
    assert.notEqual(bytes[bytes.length - 1], 0x0a);
  });

  it("rejects credential fields at the strict admin API validation boundary", () => {
    const safe = {
      codeName: "alpha", status: "ACTIVE", credentialProfileKey: "INOTI_DEFAULT",
      orderStatusEnabled: true, paymentEnabled: false,
    } as const;
    assert.equal(updateInotiUssdIntegrationSchema.safeParse(safe).success, true);
    assert.equal(updateInotiUssdIntegrationSchema.safeParse({ ...safe, username: "must-be-rejected" }).success, false);
    assert.equal(updateInotiUssdIntegrationSchema.safeParse({ ...safe, password: "must-be-rejected" }).success, false);
    assert.equal(updateInotiUssdIntegrationSchema.safeParse({ ...safe, encryptedSecret: "must-be-rejected" }).success, false);
  });
});

describe("iNoti SOAP provider adapter", () => {
  it("requires HTTPS/readiness and normalizes valid, missing, malformed, HTTP-error, and timeout responses", async () => {
    const originalFetch = globalThis.fetch;
    const originalEnvironment = {
      endpoint: process.env.INOTI_USSD_GET_PAYMENTS_URL,
      enabled: process.env.INOTI_USSD_LIVE_VERIFICATION_ENABLED,
      username: process.env.INOTI_USSD_USERNAME,
      password: process.env.INOTI_USSD_PASSWORD,
      timeout: process.env.INOTI_USSD_TIMEOUT_MS,
    };
    const provider = new InotiUssdProvider();
    const verificationQuery: InotiPaymentVerificationQuery = {
      codeName: "alpha",
      sessionId: "123456",
      mobile: "09123456789",
      amountRial: BigInt(12500),
      merchantFactorId: factor,
      providerFactorId: "provider1",
      rrn: "rrn1",
    };
    const soap = (value: string) => new Response(
      `<soap:Envelope><soap:Body><GetPaymentsResponse><GetPaymentsResult>${value}</GetPaymentsResult></GetPaymentsResponse></soap:Body></soap:Envelope>`,
      { status: 200 },
    );
    try {
      process.env.INOTI_USSD_LIVE_VERIFICATION_ENABLED = "true";
      process.env.INOTI_USSD_USERNAME = "x";
      process.env.INOTI_USSD_PASSWORD = "y";
      process.env.INOTI_USSD_GET_PAYMENTS_URL = "http://login.inoti.com/_services/ExternalUssdPay.asmx";
      assert.equal(provider.getReadiness({ organizationId: "tenant-a", profileKey: "INOTI_DEFAULT", username: "x", password: "y", endpoint: "http://login.inoti.com/_services/ExternalUssdPay.asmx" }).code, "BLOCKED_INSECURE_PROVIDER_TRANSPORT");

      process.env.INOTI_USSD_GET_PAYMENTS_URL = "https://login.inoti.com/_services/ExternalUssdPay.asmx";
      const validJson = JSON.stringify([{
        SessionID: "123456", Mobile: "09123456789", Price: 12500, Result: true,
        iNotiFactorID: "provider1", YourFactorID: factor, RRN: "rrn1",
      }]).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      globalThis.fetch = async () => soap(validJson);
      const valid = await provider.verifyPayment({ organizationId: "tenant-a", profileKey: "INOTI_DEFAULT", username: "x", password: "y", endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx" }, verificationQuery);
      assert.equal(valid.ok, true);

      const unknownStatusJson = JSON.stringify([{
        SessionID: "123456", Mobile: "09123456789", Price: "12500.0", Result: "paid",
        iNotiFactorID: "provider1", YourFactorID: factor, RRN: "rrn1",
      }]).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      globalThis.fetch = async () => soap(unknownStatusJson);
      const unknownStatus = await provider.verifyPayment({ organizationId: "tenant-a", profileKey: "INOTI_DEFAULT", username: "x", password: "y", endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx" }, verificationQuery);
      assert.equal(unknownStatus.ok && unknownStatus.record.successful, false);

      globalThis.fetch = async () => soap("[]");
      assert.deepEqual(await provider.verifyPayment({ organizationId: "tenant-a", profileKey: "INOTI_DEFAULT", username: "x", password: "y", endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx" }, verificationQuery), { ok: false, code: "NOT_FOUND" });
      globalThis.fetch = async () => soap("not-json");
      assert.deepEqual(await provider.verifyPayment({ organizationId: "tenant-a", profileKey: "INOTI_DEFAULT", username: "x", password: "y", endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx" }, verificationQuery), { ok: false, code: "MALFORMED_RESPONSE" });
      globalThis.fetch = async () => new Response("failure", { status: 503 });
      assert.deepEqual(await provider.verifyPayment({ organizationId: "tenant-a", profileKey: "INOTI_DEFAULT", username: "x", password: "y", endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx" }, verificationQuery), { ok: false, code: "PROVIDER_ERROR" });

      process.env.INOTI_USSD_TIMEOUT_MS = "1000";
      globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
      assert.deepEqual(await provider.verifyPayment({ organizationId: "tenant-a", profileKey: "INOTI_DEFAULT", username: "x", password: "y", endpoint: "https://login.inoti.com/_services/ExternalUssdPay.asmx" }, verificationQuery), { ok: false, code: "TIMEOUT" });
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries({
        INOTI_USSD_GET_PAYMENTS_URL: originalEnvironment.endpoint,
        INOTI_USSD_LIVE_VERIFICATION_ENABLED: originalEnvironment.enabled,
        INOTI_USSD_USERNAME: originalEnvironment.username,
        INOTI_USSD_PASSWORD: originalEnvironment.password,
        INOTI_USSD_TIMEOUT_MS: originalEnvironment.timeout,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

describe("iNoti tenant-scoped workflow", () => {
  it("returns a safe menu and never resolves tenant from organizationId query input", async () => {
    const repository = new FakeRepository();
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);
    const result = await workflow.handle(integrationA.publicId, null, query("6655*alpha", { organizationId: "tenant-b" }));
    assert.equal(result, "1-وضعیت سفارش\n2-پرداخت سفارش");
  });

  it("accepts the real provider CodeName and rejects the proven generated placeholder mismatch", async () => {
    const realIntegration: ResolvedInotiIntegration = {
      ...integrationA,
      codeName: "87788778",
      config: { orderStatusEnabled: true, paymentEnabled: false },
    };
    const repository = new FakeRepository();
    repository.integrations.set(realIntegration.publicId, realIntegration);
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);

    assert.equal(await workflow.handle(realIntegration.publicId, null, query("6655*87788778")), "1-وضعیت سفارش");
    assert.equal(repository.ussdEvents[0]?.eventType, "USSD_SESSION_STARTED");
    assert.equal(repository.ussdEvents[1]?.eventType, "USSD_MENU_SHOWN");

    repository.integrations.set(realIntegration.publicId, { ...realIntegration, codeName: "ussd-cmt666ew" });
    assert.equal(await workflow.handle(realIntegration.publicId, null, query("6655*87788778")), "درخواست نامعتبر است");
  });

  it("records a sanitized parse-failure diagnostic without persisting mobile or session values", async () => {
    const repository = new FakeRepository();
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);
    const mobile = "09123456789";
    const sessionid = "987654321";
    const params = new URLSearchParams({ mobile, sessionid, call: "*87788778#", extra: "ignored", RRN: "rrn-present" });

    assert.equal(
      await workflow.handle(integrationA.publicId, "bazarbaaz.ir", params, { method: "GET", startedAtMs: Date.now() - 5 }),
      "درخواست نامعتبر است",
    );
    assert.equal(repository.sessions.size, 0);
    assert.equal(repository.ussdEvents.length, 1);
    assert.equal(repository.ussdEvents[0]?.eventType, "USSD_ERROR");
    assert.notEqual(repository.ussdEvents[0]?.sessionIdHash, sessionid);

    const metadata = repository.ussdEvents[0]?.metadata as Record<string, unknown>;
    assert.equal(metadata.reason, "REQUEST_PARSE_REJECTED");
    assert.equal(metadata.parseErrorCode, "INVALID_CALL_SCOPE");
    assert.equal(metadata.requestMethod, "GET");
    assert.deepEqual(metadata.parameterNames, ["RRN", "call", "extra", "mobile", "sessionid"]);
    assert.equal(metadata.call, "*87788778#");
    assert.equal(metadata.callState, "EXACT_INITIAL");
    assert.equal(metadata.mobilePresent, true);
    assert.equal(metadata.sessionidPresent, true);
    assert.equal(metadata.rrnPresent, true);
    assert.equal(metadata.responseStatus, 200);
    assert.equal(metadata.responseContentType, "text/plain; charset=utf-8");
    assert.equal(metadata.responseBody, "درخواست نامعتبر است");
    assert.equal(typeof metadata.responseLatencyMs, "number");
    assert.doesNotMatch(JSON.stringify(metadata), new RegExp(`${mobile}|${sessionid}|rrn-present`));

    const userInputCall = query("6655*alpha*1*sensitive-tracking-token", { mobile: "invalid" });
    await workflow.handle(integrationA.publicId, null, userInputCall);
    const protectedMetadata = repository.ussdEvents[1]?.metadata as Record<string, unknown>;
    assert.equal(protectedMetadata.call, null);
    assert.equal(protectedMetadata.callState, "SUPPRESSED_USER_INPUT_OR_UNSAFE");
    assert.doesNotMatch(JSON.stringify(protectedMetadata), /sensitive-tracking-token/);

    const emptyCall = query("");
    await workflow.handle(integrationA.publicId, null, emptyCall);
    const emptyMetadata = repository.ussdEvents[2]?.metadata as Record<string, unknown>;
    assert.equal(emptyMetadata.call, "");
    assert.equal(emptyMetadata.callState, "EMPTY");
  });

  it("fails closed for unknown, disabled, wrong-code, and cross-tenant tracking tokens", async () => {
    const repository = new FakeRepository();
    repository.integrations.set(integrationB.publicId, { ...integrationB, status: "DISABLED" });
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);
    assert.equal(await workflow.handle("33333333-3333-4333-8333-333333333333", null, query("6655*alpha")), "سرویس در دسترس نیست");
    assert.equal(await workflow.handle(integrationB.publicId, null, query("6655*beta")), "سرویس در دسترس نیست");
    assert.equal(await workflow.handle(integrationA.publicId, null, query("6655*beta")), "درخواست نامعتبر است");
    assert.equal(await workflow.handle(integrationA.publicId, null, query("6655*alpha*1*track-b")), "سفارش یافت نشد");
  });

  it("returns order status through a tenant-scoped public tracking token", async () => {
    const workflow = new InotiUssdWorkflow(new FakeRepository(), new FakeProvider(), new FakeCredentialProvider(), async () => undefined);
    assert.equal(await workflow.handle(integrationA.publicId, null, query("6655*alpha*1*track-a")), "وضعیت سفارش: در حال آماده‌سازی");
  });

  it("creates an idempotent payment request in provider rial format only when ready", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);
    const first = await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    const second = await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    assert.equal(first, `9900|${factor}|12500`);
    assert.equal(second, first);
    assert.equal(repository.intents.size, 1);
    provider.ready = false;
    assert.equal(await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a")), "پرداخت در دسترس نیست");
  });

  it("settles only after strict provider verification and notifies the correct tenant recipient once", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const notifications: Array<{ organizationId: string; customerId?: string | null }> = [];
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async (input) => { notifications.push(input); });
    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" });

    const originalLivePayments = process.env.INOTI_ALLOW_LIVE_PAYMENTS;
    const originalRuntimeMutations = process.env.INOTI_RUNTIME_MUTATIONS_APPROVED;
    process.env.INOTI_ALLOW_LIVE_PAYMENTS = "true";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "true";

    try {
    assert.equal(await workflow.handle(integrationA.publicId, null, callback), "پرداخت تایید شد");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.organizationId, "tenant-a");
    assert.equal(notifications[0]?.customerId, "customer-a");
    assert.equal(repository.notificationMarks, 1);
    assert.equal(await workflow.handle(integrationA.publicId, null, callback), "پرداخت تایید شد");
    assert.equal(notifications.length, 1);
    } finally {
      process.env.INOTI_ALLOW_LIVE_PAYMENTS = originalLivePayments;
      process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = originalRuntimeMutations;
    }
    assert.equal(provider.calls, 1);
  });

  it("keeps settlement committed when notification generation throws after provider verification", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(
      repository,
      provider,
      new FakeCredentialProvider(),
      async () => { throw new Error("notification service down"); },
    );
    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" });

    const originalLivePayments2 = process.env.INOTI_ALLOW_LIVE_PAYMENTS;
    const originalRuntimeMutations2 = process.env.INOTI_RUNTIME_MUTATIONS_APPROVED;
    process.env.INOTI_ALLOW_LIVE_PAYMENTS = "true";
    process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = "true";

    try {
      const firstResult = await workflow.handle(integrationA.publicId, null, callback);
    assert.equal(firstResult, "پرداخت تایید شد");
    const intent = [...repository.intents.values()].find((i) => i.merchantFactorId === factor);
    assert.ok(intent);
    assert.equal(provider.calls, 1);
    const failedEvents = repository.events.filter((e) => e.outcome === "FAILED");
    assert.equal(failedEvents.length, 1);
    assert.equal(failedEvents[0]?.errorCode, "NOTIFICATION_FAILED");
    } finally {
      process.env.INOTI_ALLOW_LIVE_PAYMENTS = originalLivePayments2;
      process.env.INOTI_RUNTIME_MUTATIONS_APPROVED = originalRuntimeMutations2;
    }
  });

  it("fails closed on every provider identity mismatch, unsuccessful result, timeout, and malformed response", async () => {
    const mismatchCases: Array<FakeProvider["overrides"]> = [
      { sessionId: "other" }, { mobile: "09120000000" }, { amountRial: BigInt(999) },
      { merchantFactorId: `BZ${"b".repeat(32)}` }, { providerFactorId: "other" },
      { rrn: "other" }, { successful: false, result: "false" },
    ];
    for (const overrides of mismatchCases) {
      const repository = new FakeRepository();
      const provider = new FakeProvider();
      provider.overrides = overrides;
      const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);
      await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
      assert.equal(
        await workflow.handle(integrationA.publicId, null, query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" })),
        "تایید پرداخت ناموفق بود",
      );
      assert.equal(repository.settlementKeys.size, 0);
    }
    for (const mode of ["TIMEOUT", "MALFORMED"] as const) {
      const repository = new FakeRepository();
      const provider = new FakeProvider();
      provider.mode = mode;
      const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);
      await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
      assert.equal(
        await workflow.handle(integrationA.publicId, null, query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" })),
        "تایید پرداخت ناموفق بود",
      );
    }
  });

  it("never treats RRN alone as proof of payment", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);
    assert.equal(await workflow.handle(integrationA.publicId, null, query("6655*alpha", { RRN: "rrn1" })), "تایید پرداخت ناموفق بود");
    assert.equal(provider.calls, 0);
    assert.equal(repository.settlementKeys.size, 0);
  });

  it("treats the public locator and all callback parameters as forgeable, with no financial mutation before provider proof", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    provider.mode = "NOT_FOUND";
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => assert.fail("forged callback must not notify"));
    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a", { organizationId: "tenant-b" }));
    const forged = query(`6655*alpha*2*track-a*${factor}*provider1`, {
      RRN: "attacker-rrn",
      organizationId: "tenant-b",
    });
    assert.equal(await workflow.handle(integrationA.publicId, null, forged), "تایید پرداخت ناموفق بود");
    assert.equal(repository.settlementKeys.size, 0);
    assert.equal(repository.notificationMarks, 0);
  });

  it("tracks lightweight session state and rejects expired sessions", async () => {
    const repository = new FakeRepository();
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);

    assert.equal(await workflow.handle(integrationA.publicId, null, query("6655*alpha")), "1-وضعیت سفارش\n2-پرداخت سفارش");
    assert.equal(repository.sessions.size, 1);

    const sessionKey = `${integrationA.id}:${repository.sessions.keys().next().value.split(":")[1]}`;
    const session = repository.sessions.get(sessionKey);
    assert.ok(session);
    assert.equal(session?.lastAction, "MENU");
    assert.equal(session?.status, "ACTIVE");

    const expiredSession = repository.sessions.get(sessionKey);
    if (expiredSession) {
      expiredSession.lastSeenAt = new Date(Date.now() - 31 * 60 * 1000);
    }

    assert.equal(await workflow.handle(integrationA.publicId, null, query("6655*alpha*1*track-a")), "جلسه منقضی شده است");
    const updated = repository.sessions.get(sessionKey);
    assert.ok(updated);
    assert.equal(updated?.status, "EXPIRED");
    assert.equal(updated?.lastAction, "EXPIRED");
  });

  it("records USSD observability events for menu and payment flows", async () => {
    const repository = new FakeRepository();
    const provider = new FakeProvider();
    const workflow = new InotiUssdWorkflow(repository, provider, new FakeCredentialProvider(), async () => undefined);

    await workflow.handle(integrationA.publicId, null, query("6655*alpha"));
    assert.equal(repository.ussdEvents.length, 2);
    assert.equal(repository.ussdEvents[0]?.eventType, "USSD_SESSION_STARTED");
    assert.equal(repository.ussdEvents[1]?.eventType, "USSD_MENU_SHOWN");

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*1*track-a"));
    assert.equal(repository.ussdEvents.length, 3);
    assert.equal(repository.ussdEvents[2]?.eventType, "USSD_ORDER_STATUS_REQUESTED");

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    assert.equal(repository.ussdEvents.length, 5);
    assert.equal(repository.ussdEvents[3]?.eventType, "USSD_PAYMENT_SELECTED");
    assert.equal(repository.ussdEvents[4]?.eventType, "USSD_PAYMENT_CREATED");

    const callback = query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" });
    await workflow.handle(integrationA.publicId, null, callback);
    assert.equal(repository.ussdEvents.length, 8);
    assert.equal(repository.ussdEvents[5]?.eventType, "USSD_CALLBACK_RECEIVED");
    assert.equal(repository.ussdEvents[6]?.eventType, "USSD_PROVIDER_VERIFICATION_STARTED");
    assert.equal(repository.ussdEvents[7]?.eventType, "USSD_SETTLEMENT_BLOCKED");
  });

  it("records observability events without exposing secrets", async () => {
    const repository = new FakeRepository();
    const workflow = new InotiUssdWorkflow(repository, new FakeProvider(), new FakeCredentialProvider(), async () => undefined);

    await workflow.handle(integrationA.publicId, null, query("6655*alpha*2*track-a"));
    await workflow.handle(integrationA.publicId, null, query(`6655*alpha*2*track-a*${factor}*provider1`, { RRN: "rrn1" }));

    for (const event of repository.ussdEvents) {
      const metadata = event.metadata as Record<string, unknown> | undefined;
      assert.ok(!metadata?.password);
      assert.ok(!metadata?.token);
      assert.ok(!metadata?.pepper);
    }
  });
});
