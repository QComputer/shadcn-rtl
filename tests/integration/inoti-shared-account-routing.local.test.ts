import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { createPaymentRequest } from "@/lib/payments/payment-request.service";
import { InotiPaymentLifecycleService } from "@/lib/payments/inoti-payment-lifecycle.service";
import { PrismaUssdIntegrationRepository } from "@/lib/integrations/inoti-ussd/repository";
import { InotiUssdWorkflow } from "@/lib/integrations/inoti-ussd/workflow";
import { resolveInotiPaymentAccount, setOrganizationInotiPaymentRouting } from "@/lib/integrations/inoti-ussd/account-routing.server";
import type {
  InotiCredentialProfile,
  InotiPaymentVerificationQuery,
  InotiVerificationResult,
  InotiMerchantAccountKey,
  UssdProvider,
} from "@/lib/integrations/inoti-ussd/types";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isDisposable = /(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(databaseUrl);

class FixtureProvider implements UssdProvider {
  calls: Array<{ profileKey: string | null; query: InotiPaymentVerificationQuery }> = [];

  getReadiness() {
    return { ready: true, transportSecure: true, code: "READY" as const };
  }

  async verifyPayment(profile: InotiCredentialProfile | null, query: InotiPaymentVerificationQuery): Promise<InotiVerificationResult> {
    this.calls.push({ profileKey: profile?.profileKey ?? null, query });
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
      },
    };
  }
}

function fixtureProfile(accountKey: InotiMerchantAccountKey): InotiCredentialProfile {
  const platform = accountKey === "PLATFORM_OWNER";
  return {
    organizationId: platform ? "__fixture_platform__" : "__fixture_cafe_leo__",
    profileKey: platform ? "fixture:platform-owner" : "fixture:cafe-leo",
    username: "fixture-user",
    password: "fixture-password",
    endpoint: "https://fixture.invalid/GetPayments",
    ussdCodeName: platform ? "owner" : "cafe",
    ussdDialString: platform ? "*6655*owner#" : "*6655*cafe#",
  };
}

const credentialProvider = {
  async resolveProfile(organizationId: string, profileKey: string | null) {
    return {
      ...fixtureProfile("PLATFORM_OWNER"),
      organizationId,
      profileKey: profileKey ?? "fixture:legacy",
    };
  },
  async resolvePaymentAccount(accountKey: InotiMerchantAccountKey) {
    return fixtureProfile(accountKey);
  },
};

function callbackParams(input: { codeName: string; sessionId: string; factor: string; providerFactor: string; rrn: string; mobile: string }) {
  return new URLSearchParams({
    mobile: input.mobile,
    sessionid: input.sessionId,
    call: `6655*${input.codeName}*payment*request*${input.factor}*${input.providerFactor}`,
    RRN: input.rrn,
  });
}

function collectErrorText(value: unknown, seen = new Set<object>()): string {
  if (typeof value !== "object" || value === null) return String(value ?? "");
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  return Object.getOwnPropertyNames(value).map((key) => {
    let nested: unknown;
    try { nested = (value as Record<string, unknown>)[key]; } catch { nested = "[unreadable]"; }
    return `${key}:${collectErrorText(nested, seen)}`;
  }).join(" ");
}

async function assertRejected(operation: () => Promise<unknown>, validate: (error: unknown) => void | Promise<void>) {
  let rejected = false;
  let caught: unknown;
  try { await operation(); } catch (error) { rejected = true; caught = error; }
  assert.equal(rejected, true, "expected database operation to reject");
  await validate(caught);
}
async function assertDatabaseTrigger(error: unknown, name: string) {
  const diagnostic = collectErrorText(error);
  assert.match(diagnostic, /P2004|23514/, `expected PostgreSQL check/trigger SQLSTATE for ${name}; received ${diagnostic}`);
  const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
    SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname = ${name}
  `;
  assert.equal(triggers.length, 1, `expected exact database trigger ${name}`);
}

async function assertUniqueConflict(error: unknown, ...expectedFields: string[]) {
  const diagnostic = collectErrorText(error);
  assert.match(diagnostic, /P2002|23505/, `expected a unique-index conflict; received ${diagnostic}`);
  const fields = expectedFields.length ? expectedFields : ["merchantAccountKey", "merchantFactorId"];
  const indexes = await prisma.$queryRaw<Array<{ indexdef: string }>>`
    SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexdef ILIKE '%CREATE UNIQUE INDEX%'
  `;
  assert.ok(indexes.some(({ indexdef }) => fields.every((field) => indexdef.includes(`"${field}"`))),
    `expected a unique index covering ${fields.join(", ")}`);
}
describe("R5 shared iNoti merchant-account routing on disposable PostgreSQL", { skip: !isDisposable }, () => {
const suffix = randomUUID().replace(/-/g, "");
  const sessionA = String(100000000 + (Number.parseInt(suffix.slice(0, 8), 16) % 900000000));
  const sessionB = String(100000000 + (Number.parseInt(suffix.slice(8, 16), 16) % 900000000));
  const sessionCafe = String(100000000 + (Number.parseInt(suffix.slice(16, 24), 16) % 900000000));
  const repository = new PrismaUssdIntegrationRepository();
  const provider = new FixtureProvider();
  let organizationA: Awaited<ReturnType<typeof prisma.organization.create>> | null = null;
  let organizationB: Awaited<ReturnType<typeof prisma.organization.create>> | null = null;
  let cafeOrganization: Awaited<ReturnType<typeof prisma.organization.create>> | null = null;
  let integrationA: Awaited<ReturnType<typeof prisma.organizationIntegration.create>> | null = null;
  let integrationB: Awaited<ReturnType<typeof prisma.organizationIntegration.create>> | null = null;
  let cafeIntegration: Awaited<ReturnType<typeof prisma.organizationIntegration.create>> | null = null;
  const priorCorrelationVersion = process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION;
  const priorCorrelationKey997 = process.env.INOTI_PAYMENT_CORRELATION_KEY_V997;

  before(async () => {
    // Force this test through the injected fixture provider, never the durable worker.
    process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION = "997";
    delete process.env.INOTI_PAYMENT_CORRELATION_KEY_V997;

    organizationA = await prisma.organization.create({ data: { type: "SHOP", name: `R5 Shared A ${suffix}`, slug: `r5-shared-a-${suffix}` } });
    organizationB = await prisma.organization.create({ data: { type: "SHOP", name: `R5 Shared B ${suffix}`, slug: `r5-shared-b-${suffix}` } });
    const priorCafeOrgId = process.env.INOTI_CAFE_LEO_ORGANIZATION_ID;
    process.env.INOTI_CAFE_LEO_ORGANIZATION_ID = "unverified-cafe-organization";
    await assert.rejects(
      setOrganizationInotiPaymentRouting({ organizationId: organizationA.id, merchantAccountKey: "CAFE_LEO", actorUserId: "unused-unverified-test-actor", reason: "R5 negative organization identity check" }),
      /CAFE_LEO_ORGANIZATION_ID_MISMATCH/,
    );
    if (priorCafeOrgId === undefined) delete process.env.INOTI_CAFE_LEO_ORGANIZATION_ID;
    else process.env.INOTI_CAFE_LEO_ORGANIZATION_ID = priorCafeOrgId;
    integrationA = await prisma.organizationIntegration.create({
      data: { organizationId: organizationA.id, provider: "INOTI_USSD", status: "ACTIVE", codeName: "owner", configuration: { paymentEnabled: true, orderStatusEnabled: true } },
    });
    integrationB = await prisma.organizationIntegration.create({
      data: { organizationId: organizationB.id, provider: "INOTI_USSD", status: "ACTIVE", codeName: "owner", configuration: { paymentEnabled: true, orderStatusEnabled: true } },
    });
    // On a seeded local DB, leave the existing organization untouched and skip this synthetic subcase.

    const existingCafe = await prisma.organization.findUnique({ where: { slug: "cafe-leo" }, select: { id: true } });
    if (!existingCafe) {
      cafeOrganization = await prisma.organization.create({ data: { type: "SHOP", name: `R5 Cafe Leo ${suffix}`, slug: "cafe-leo" } });
      await prisma.organizationInotiPaymentRouting.update({
        where: { organizationId: cafeOrganization.id },
        data: { merchantAccountKey: "CAFE_LEO" },
      });
      cafeIntegration = await prisma.organizationIntegration.create({
        data: { organizationId: cafeOrganization.id, provider: "INOTI_USSD", status: "ACTIVE", codeName: "cafe", configuration: { paymentEnabled: true, orderStatusEnabled: true } },
      });
    }
  });

  after(async () => {
    const organizationIds = [organizationA?.id, organizationB?.id, cafeOrganization?.id].filter((id): id is string => Boolean(id));
    if (organizationIds.length) {
      await prisma.ussdPaymentVerificationJob.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.ussdCallbackEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.ussdPaymentIntent.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.paymentProviderAttempt.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.paymentRequest.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.ussdEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.ussdSession.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.businessEvent.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (priorCorrelationVersion === undefined) delete process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION;
    else process.env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION = priorCorrelationVersion;
    if (priorCorrelationKey997 === undefined) delete process.env.INOTI_PAYMENT_CORRELATION_KEY_V997;
    else process.env.INOTI_PAYMENT_CORRELATION_KEY_V997 = priorCorrelationKey997;
    await prisma.$disconnect();
  });

  it("settles two tenants through the shared platform account without crossing tenant records", async () => {
    assert.ok(organizationA && organizationB && integrationA && integrationB);
    const [requestA, requestB] = await Promise.all([
      createPaymentRequest({ organizationId: organizationA.id, providerIntegrationId: integrationA.id, amountToman: BigInt(220000), purpose: "R5_SHARED_A" }),
      createPaymentRequest({ organizationId: organizationB.id, providerIntegrationId: integrationB.id, amountToman: BigInt(330000), purpose: "R5_SHARED_B" }),
    ]);
    const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentialProvider, () => true);
    const [initiatedA, initiatedB] = await Promise.all([
      lifecycle.initiate({ publicIntegrationId: integrationA.publicId, organizationId: organizationA.id, paymentRequestId: requestA.id, sessionId: sessionA, mobile: "09123456789" }),
      lifecycle.initiate({ publicIntegrationId: integrationB.publicId, organizationId: organizationB.id, paymentRequestId: requestB.id, sessionId: sessionB, mobile: "09123456780" }),
    ]);
    const replayA = await lifecycle.initiate({
      publicIntegrationId: integrationA.publicId,
      organizationId: organizationA.id,
      paymentRequestId: requestA.id,
      sessionId: sessionA,
      mobile: "09123456789",
    });
    assert.equal(replayA.merchantFactorId, initiatedA.merchantFactorId, "same payment request and evidence must reuse the original factor");
    await assert.rejects(
      lifecycle.initiate({
        publicIntegrationId: integrationA.publicId,
        organizationId: organizationA.id,
        paymentRequestId: requestA.id,
        sessionId: sessionA,
        mobile: "09123456788",
      }),
      /USSD_PAYMENT_INTENT_IDEMPOTENCY_CONFLICT/,
    );
    assert.match(initiatedA.merchantFactorId, /^\d{9}$/);
    assert.match(initiatedB.merchantFactorId, /^\d{9}$/);
    assert.notEqual(initiatedA.merchantFactorId, initiatedB.merchantFactorId);

    const [intentA, intentB] = await Promise.all([
      prisma.ussdPaymentIntent.findUniqueOrThrow({ where: { paymentRequestId_organizationId: { paymentRequestId: requestA.id, organizationId: organizationA.id } } }),
      prisma.ussdPaymentIntent.findUniqueOrThrow({ where: { paymentRequestId_organizationId: { paymentRequestId: requestB.id, organizationId: organizationB.id } } }),
    ]);
    assert.equal(intentA.merchantAccountKey, "PLATFORM_OWNER");
    assert.equal(intentB.merchantAccountKey, "PLATFORM_OWNER");
    assert.equal(intentA.merchantFactorId, initiatedA.merchantFactorId);
    assert.equal(intentB.merchantFactorId, initiatedB.merchantFactorId);
    assert.equal(intentA.credentialProfileKeySnapshot, "fixture:platform-owner");
    assert.equal(intentB.credentialProfileKeySnapshot, "fixture:platform-owner");
    assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: requestA.id } })).merchantAccountKey, "PLATFORM_OWNER");
    assert.equal((await prisma.paymentProviderAttempt.findUniqueOrThrow({ where: { id: initiatedA.providerAttemptId! } })).merchantAccountKey, "PLATFORM_OWNER");

    await prisma.organizationInotiPaymentRouting.delete({ where: { organizationId: organizationA.id } });
    assert.equal(await resolveInotiPaymentAccount(organizationA.id, credentialProvider), null, "missing policy fails closed");
    await prisma.organizationInotiPaymentRouting.upsert({
      where: { organizationId: organizationA.id },
      create: { organizationId: organizationA.id, merchantAccountKey: "PLATFORM_OWNER" },
      update: { merchantAccountKey: "PLATFORM_OWNER" },
    });

    const workflow = new InotiUssdWorkflow(repository, provider, credentialProvider, async () => undefined, () => true, () => true);
    const responseA = await workflow.handle(integrationA.publicId, null, callbackParams({
      codeName: "owner", sessionId: sessionA, factor: initiatedA.merchantFactorId,
      providerFactor: `provider-a-${suffix.slice(0, 8)}`, rrn: `rrn-a-${suffix.slice(0, 8)}`, mobile: "09123456789",
    }));
    assert.equal(responseA, "پرداخت تایید شد");
    assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: requestA.id } })).status, "PAID");
    assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: requestB.id } })).status, "AWAITING_CUSTOMER");

    const responseB = await workflow.handle(integrationB.publicId, null, callbackParams({
      codeName: "owner", sessionId: sessionB, factor: initiatedB.merchantFactorId,
      providerFactor: `provider-b-${suffix.slice(0, 8)}`, rrn: `rrn-b-${suffix.slice(0, 8)}`, mobile: "09123456780",
    }));
    assert.equal(responseB, "پرداخت تایید شد");
    assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: requestB.id } })).status, "PAID");
    assert.deepEqual(provider.calls.map((call) => call.profileKey), ["fixture:platform-owner", "fixture:platform-owner"]);
    assert.deepEqual(provider.calls.map((call) => call.query.merchantFactorId), [initiatedA.merchantFactorId, initiatedB.merchantFactorId]);

    await assertRejected(
      () => prisma.ussdPaymentIntent.update({ where: { id: intentA.id }, data: { merchantAccountKey: "CAFE_LEO" } }),
      (error) => assertDatabaseTrigger(error, "UssdPaymentIntent_inoti_account_binding_immutable"),
    );
    await assertRejected(
      () => prisma.ussdPaymentIntent.create({
        data: {
          organizationId: organizationB.id,
          integrationId: integrationB.id,
          merchantAccountKey: "PLATFORM_OWNER",
          credentialProfileKeySnapshot: "fixture:platform-owner",
          merchantCodeName: "owner",
          merchantFactorId: intentA.merchantFactorId,
          amountRial: BigInt(1),
          sessionIdHash: "a".repeat(64),
          mobileHash: "b".repeat(64),
          mobileMasked: "0912***6780",
        },
      }),
      assertUniqueConflict,
    );
    await assertRejected(
      () => prisma.paymentProviderAttempt.create({
        data: {
          organizationId: organizationB.id,
          paymentRequestId: requestB.id,
          providerIntegrationId: integrationB.id,
          merchantAccountKey: "PLATFORM_OWNER",
          credentialProfileKeySnapshot: "fixture:platform-owner",
          merchantCodeName: "owner",
          provider: "INOTI_USSD",
          amountToman: BigInt(330000),
          merchantFactorId: intentA.merchantFactorId,
          idempotencyKey: `R5_DUPLICATE_FACTOR_${suffix}`,
        },
      }),
      assertUniqueConflict,
    );
  });

  it("uses Cafe Leo's account policy and keeps an intent bound after integration configuration changes", async (testContext) => {
    if (!cafeOrganization || !cafeIntegration) {
      testContext.skip("Cafe Leo already exists in the guarded database; leave seeded tenant data untouched");
      return;
    }
    const resolvedBefore = await resolveInotiPaymentAccount(cafeOrganization.id, credentialProvider);
    assert.equal(resolvedBefore?.merchantAccountKey, "CAFE_LEO");
    assert.equal(resolvedBefore?.profile.profileKey, "fixture:cafe-leo");
    await assertRejected(
      () => prisma.organizationInotiPaymentRouting.update({ where: { organizationId: organizationA!.id }, data: { merchantAccountKey: "CAFE_LEO" } }),
      (error) => assertUniqueConflict(error, "merchantAccountKey"),
    );

    const request = await createPaymentRequest({ organizationId: cafeOrganization.id, providerIntegrationId: cafeIntegration.id, amountToman: BigInt(12500), purpose: "R5_CAFE_SNAPSHOT" });
    const lifecycle = new InotiPaymentLifecycleService(repository, provider, credentialProvider, () => true);
    const sessionId = sessionCafe;
    const initiated = await lifecycle.initiate({ publicIntegrationId: cafeIntegration.publicId, organizationId: cafeOrganization.id, paymentRequestId: request.id, sessionId, mobile: "09123456781" });
    const intent = await prisma.ussdPaymentIntent.findUniqueOrThrow({ where: { paymentRequestId_organizationId: { paymentRequestId: request.id, organizationId: cafeOrganization.id } } });
    assert.equal(intent.merchantAccountKey, "CAFE_LEO");
    assert.equal(intent.credentialProfileKeySnapshot, "fixture:cafe-leo");
    assert.equal(intent.merchantCodeName, "cafe");

    await prisma.organizationIntegration.update({ where: { id: cafeIntegration.id }, data: {
      credentialProfileKey: "fixture:platform-owner",
    } });

    const workflow = new InotiUssdWorkflow(repository, provider, credentialProvider, async () => undefined, () => true, () => true);
    const response = await workflow.handle(cafeIntegration.publicId, null, callbackParams({
      codeName: "cafe", sessionId, factor: initiated.merchantFactorId,
      providerFactor: `provider-cafe-${suffix.slice(0, 8)}`, rrn: `rrn-cafe-${suffix.slice(0, 8)}`, mobile: "09123456781",
    }));
    assert.equal(response, "پرداخت تایید شد");
    assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "PAID");
    assert.equal(provider.calls.at(-1)?.profileKey, "fixture:cafe-leo");
    assert.equal(provider.calls.at(-1)?.query.codeName, "cafe");
    assert.equal((await prisma.ussdPaymentIntent.findUniqueOrThrow({ where: { id: intent.id } })).merchantAccountKey, "CAFE_LEO");
  });
});
