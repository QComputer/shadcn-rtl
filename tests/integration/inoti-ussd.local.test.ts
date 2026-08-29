import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { connectInotiServices } from "@/lib/integrations/inoti-account-management";
import { PrismaUssdIntegrationRepository } from "@/lib/integrations/inoti-ussd/repository";
import { buildInotiUssdCallbackUrl } from "@/lib/integrations/inoti-ussd/callback-url";
import { INOTI_PLATFORM_ORGANIZATION_SLUG } from "@/lib/integrations/inoti-ussd/credentials";
import { SEEDED_INOTI_USSD_PUBLIC_ID_BY_SLUG } from "@/lib/integrations/inoti-ussd/seed-fixture-public-ids";
import type { ResolvedInotiIntegration } from "@/lib/integrations/inoti-ussd/types";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "inoti-ussd.local.test.ts refuses to run against a non-local database",
);

const seededSlugs = [INOTI_PLATFORM_ORGANIZATION_SLUG, "aka-shoes", "cafe-leo", "italiano-13"] as const;

async function readSeededUssdPublicIds() {
  const rows = await prisma.organizationIntegration.findMany({
    where: {
      provider: "INOTI_USSD",
      organization: { slug: { in: [...seededSlugs] } },
    },
    select: {
      publicId: true,
      organization: { select: { slug: true } },
    },
    orderBy: [{ organization: { slug: "asc" } }],
  });
  return Object.fromEntries(rows.map((row) => [row.organization.slug, row.publicId]));
}

describe("iNoti USSD integration on disposable local PostgreSQL", () => {
  it("keeps platform and pilot public callback identities distinct and local", async () => {
    const integrations = await prisma.organizationIntegration.findMany({
      where: {
        provider: "INOTI_USSD",
        organization: {
          slug: { in: [INOTI_PLATFORM_ORGANIZATION_SLUG, "aka-shoes", "cafe-leo", "italiano-13"] },
        },
      },
      select: {
        publicId: true,
        organization: { select: { slug: true, isPlatformOwner: true } },
      },
    });
    const bySlug = new Map(integrations.map((integration) => [integration.organization.slug, integration]));
    for (const slug of [INOTI_PLATFORM_ORGANIZATION_SLUG, "aka-shoes", "cafe-leo"]) {
      assert.ok(bySlug.get(slug), `${slug} has a local INOTI_USSD integration`);
      assert.match(bySlug.get(slug)!.publicId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.equal(buildInotiUssdCallbackUrl(bySlug.get(slug)!.publicId), `https://bazarbaaz.ir/api/integrations/inoti/ussd/${bySlug.get(slug)!.publicId}`);
    }
    if (bySlug.has("italiano-13")) {
      assert.match(bySlug.get("italiano-13")!.publicId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.equal(buildInotiUssdCallbackUrl(bySlug.get("italiano-13")!.publicId), `https://bazarbaaz.ir/api/integrations/inoti/ussd/${bySlug.get("italiano-13")!.publicId}`);
    }
    assert.equal(bySlug.get(INOTI_PLATFORM_ORGANIZATION_SLUG)?.organization.isPlatformOwner, true);
    assert.equal(new Set(integrations.map((integration) => integration.publicId)).size, integrations.length);
    for (const slug of seededSlugs) {
      if (bySlug.has(slug)) {
        assert.equal(bySlug.get(slug)!.publicId, SEEDED_INOTI_USSD_PUBLIC_ID_BY_SLUG[slug]);
      }
    }
  });

  it("keeps seeded public callback identities stable across repeated seed runs", async () => {
    execSync("pnpm db:seed", {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
      windowsHide: true,
    });
    const before = await readSeededUssdPublicIds();
    for (const slug of seededSlugs) {
      assert.equal(before[slug], SEEDED_INOTI_USSD_PUBLIC_ID_BY_SLUG[slug]);
    }

    execSync("pnpm db:seed", {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
      windowsHide: true,
    });

    const after = await readSeededUssdPublicIds();
    assert.deepEqual(after, before);
  });

  it("activates platform USSD with the explicit provider CodeName without rotating publicIntegrationId", async () => {
    const originalEnvironment = {
      username: process.env.INOTI_PLATFORM_USERNAME,
      password: process.env.INOTI_PLATFORM_PASSWORD,
      codeName: process.env.INOTI_PLATFORM_USSD_CODE_NAME,
    };
    process.env.INOTI_PLATFORM_USERNAME = "platform-user";
    process.env.INOTI_PLATFORM_PASSWORD = "platform-pass";
    process.env.INOTI_PLATFORM_USSD_CODE_NAME = "87788778";

    try {
      const platformOrg = await prisma.organization.findUniqueOrThrow({
        where: { slug: INOTI_PLATFORM_ORGANIZATION_SLUG },
        select: { id: true },
      });
      const before = await prisma.organizationIntegration.findUniqueOrThrow({
        where: { organizationId_provider: { organizationId: platformOrg.id, provider: "INOTI_USSD" } },
        select: { publicId: true, codeName: true },
      });

      await connectInotiServices({
        organizationId: platformOrg.id,
        credentialProfileKey: "local-env:inoti:platform",
        services: ["USSD"],
      });

      const after = await prisma.organizationIntegration.findUniqueOrThrow({
        where: { organizationId_provider: { organizationId: platformOrg.id, provider: "INOTI_USSD" } },
        select: { publicId: true, codeName: true, status: true },
      });
      assert.equal(after.status, "ACTIVE");
      assert.equal(after.codeName, "87788778");
      assert.equal(after.publicId, before.publicId);
      assert.notEqual(after.publicId, after.codeName);

      await connectInotiServices({
        organizationId: platformOrg.id,
        credentialProfileKey: "local-env:inoti:platform",
        services: ["USSD"],
      });

      const rerun = await prisma.organizationIntegration.findUniqueOrThrow({
        where: { organizationId_provider: { organizationId: platformOrg.id, provider: "INOTI_USSD" } },
        select: { publicId: true, codeName: true, status: true },
      });
      assert.deepEqual(rerun, after);
    } finally {
      for (const [key, value] of Object.entries({
        INOTI_PLATFORM_USERNAME: originalEnvironment.username,
        INOTI_PLATFORM_PASSWORD: originalEnvironment.password,
        INOTI_PLATFORM_USSD_CODE_NAME: originalEnvironment.codeName,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("fails closed when a real USSD activation has no explicit provider CodeName", async () => {
    const originalEnvironment = {
      username: process.env.INOTI_PLATFORM_USERNAME,
      password: process.env.INOTI_PLATFORM_PASSWORD,
      codeName: process.env.INOTI_PLATFORM_USSD_CODE_NAME,
    };
    process.env.INOTI_PLATFORM_USERNAME = "platform-user";
    process.env.INOTI_PLATFORM_PASSWORD = "platform-pass";
    delete process.env.INOTI_PLATFORM_USSD_CODE_NAME;

    try {
      const platformOrg = await prisma.organization.findUniqueOrThrow({
        where: { slug: INOTI_PLATFORM_ORGANIZATION_SLUG },
        select: { id: true },
      });
      await assert.rejects(
        connectInotiServices({
          organizationId: platformOrg.id,
          credentialProfileKey: "local-env:inoti:platform",
          services: ["USSD"],
        }),
        /explicit provider CodeName/,
      );
    } finally {
      for (const [key, value] of Object.entries({
        INOTI_PLATFORM_USERNAME: originalEnvironment.username,
        INOTI_PLATFORM_PASSWORD: originalEnvironment.password,
        INOTI_PLATFORM_USSD_CODE_NAME: originalEnvironment.codeName,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("enforces public callback identity uniqueness and runtime IDs stay generated", async () => {
    const suffix = randomUUID().replace(/-/g, "");
    const organization = await prisma.organization.create({
      data: { type: "SHOP", name: `USSD duplicate ${suffix}`, slug: `ussd-duplicate-${suffix}` },
    });
    try {
      await assert.rejects(
        prisma.organizationIntegration.create({
          data: {
            organizationId: organization.id,
            provider: "INOTI_USSD",
            publicId: SEEDED_INOTI_USSD_PUBLIC_ID_BY_SLUG[INOTI_PLATFORM_ORGANIZATION_SLUG],
            status: "DRAFT",
            codeName: `duplicate-${suffix.slice(0, 8)}`,
            configuration: {},
          },
        }),
        (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002",
      );

      const runtimeIntegration = await prisma.organizationIntegration.create({
        data: {
          organizationId: organization.id,
          provider: "INOTI_USSD",
          status: "DRAFT",
          codeName: `runtime-${suffix.slice(0, 8)}`,
          configuration: {},
        },
      });
      assert.match(runtimeIntegration.publicId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      const seededPublicIds: readonly string[] = Object.values(SEEDED_INOTI_USSD_PUBLIC_ID_BY_SLUG);
      assert.equal(seededPublicIds.includes(runtimeIntegration.publicId), false);
      assert.equal(runtimeIntegration.publicId.includes(organization.id.slice(0, 8)), false);
    } finally {
      await prisma.organizationIntegration.deleteMany({ where: { organizationId: organization.id } });
      await prisma.organization.deleteMany({ where: { id: organization.id } });
    }
  });

  it("enforces tenant FKs/uniqueness, preserves disabled data, and settles exactly once", async () => {
    const suffix = randomUUID().replace(/-/g, "");
    const repository = new PrismaUssdIntegrationRepository();
    const organizationA = await prisma.organization.create({
      data: { type: "SHOP", name: `USSD A ${suffix}`, slug: `ussd-a-${suffix}` },
    });
    const organizationB = await prisma.organization.create({
      data: { type: "SHOP", name: `USSD B ${suffix}`, slug: `ussd-b-${suffix}` },
    });
    const integrationRow = await prisma.organizationIntegration.create({
      data: {
        organizationId: organizationA.id,
        provider: "INOTI_USSD",
        status: "ACTIVE",
        codeName: "alpha",
        credentialProfileKey: "INOTI_DEFAULT",
        configuration: { orderStatusEnabled: true, paymentEnabled: true },
      },
    });
    const originalPublicId = integrationRow.publicId;
    assert.match(originalPublicId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(
      buildInotiUssdCallbackUrl(originalPublicId),
      `https://bazarbaaz.ir/api/integrations/inoti/ussd/${originalPublicId}`,
    );
    const orderA = await prisma.order.create({
      data: {
        orderNumber: `USSD-A-${suffix}`,
        type: "PICK_UP",
        subtotal: 1250,
        total: 1250,
        organizationSlug: organizationA.slug,
        publicTrackingToken: `track-a-${suffix}`,
      },
    });
    const orderB = await prisma.order.create({
      data: {
        orderNumber: `USSD-B-${suffix}`,
        type: "PICK_UP",
        subtotal: 2500,
        total: 2500,
        organizationSlug: organizationB.slug,
        publicTrackingToken: `track-b-${suffix}`,
      },
    });
    const integration: ResolvedInotiIntegration = {
      id: integrationRow.id,
      publicId: integrationRow.publicId,
      organizationId: organizationA.id,
      organizationSlug: organizationA.slug,
      status: "ACTIVE",
      codeName: integrationRow.codeName,
      credentialProfileKey: integrationRow.credentialProfileKey,
      callbackOrigin: integrationRow.callbackOrigin,
      config: { orderStatusEnabled: true, paymentEnabled: true },
    };

    try {
      assert.equal(await repository.findOrderByTrackingToken(integration, orderB.publicTrackingToken!), null);
      const scopedOrder = await repository.findOrderByTrackingToken(integration, orderA.publicTrackingToken!);
      assert.ok(scopedOrder);

      await assert.rejects(
        prisma.ussdPaymentIntent.create({
          data: {
            organizationId: organizationA.id,
            integrationId: integration.id,
            orderId: orderB.id,
            merchantFactorId: `BZ${suffix.slice(0, 32)}`,
            amountRial: BigInt(25000),
            sessionIdHash: "x".repeat(64),
            mobileHash: "y".repeat(64),
            mobileMasked: "0912***0000",
          },
        }),
        (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003",
      );

      const intent = await repository.createOrGetPaymentIntent({
        integration,
        order: scopedOrder,
        sessionIdHash: "s".repeat(64),
        mobileHash: "m".repeat(64),
        mobileMasked: "0912***6789",
        amountToman: BigInt(1250),
      });
      const sameIntent = await repository.createOrGetPaymentIntent({
        integration,
        order: scopedOrder,
        sessionIdHash: "s".repeat(64),
        mobileHash: "m".repeat(64),
        mobileMasked: "0912***6789",
        amountToman: BigInt(1250),
      });
      assert.equal(sameIntent.id, intent.id);

      await assert.rejects(
        prisma.ussdCallbackEvent.create({
          data: {
            organizationId: organizationB.id,
            integrationId: integration.id,
            paymentIntentId: intent.id,
            idempotencyKey: `cross-${suffix}`,
            sessionIdHash: "s".repeat(64),
            mobileHash: "m".repeat(64),
            callHash: "c".repeat(64),
            outcome: "REJECTED",
          },
        }),
      );

      await prisma.organizationIntegration.update({ where: { id: integration.id }, data: { status: "DISABLED", disabledAt: new Date() } });
      assert.equal((await repository.resolveIntegration(integration.publicId))?.status, "DISABLED");
      assert.equal(await prisma.ussdPaymentIntent.count({ where: { id: intent.id } }), 1);
      assert.equal((await prisma.organizationIntegration.findUniqueOrThrow({ where: { id: integration.id } })).publicId, originalPublicId);
      await prisma.organizationIntegration.update({
        where: { id: integration.id },
        data: {
          codeName: "alpha2",
          credentialProfileKey: "local-env:inoti:aka-shoes",
          healthStatus: "DEGRADED",
          healthMetadata: { readOnlyVerification: "NO_CREDENTIALS", realPaymentExecution: false },
        },
      });
      assert.equal((await prisma.organizationIntegration.findUniqueOrThrow({ where: { id: integration.id } })).publicId, originalPublicId);
      await prisma.organizationIntegration.update({ where: { id: integration.id }, data: { status: "ACTIVE", disabledAt: null } });
      assert.equal((await repository.resolveIntegration(integration.publicId))?.status, "ACTIVE");
      assert.equal((await prisma.organizationIntegration.findUniqueOrThrow({ where: { id: integration.id } })).publicId, originalPublicId);
      assert.equal(await prisma.ussdPaymentIntent.count({ where: { id: intent.id } }), 1);

      const settlementInput = {
        integration,
        intent,
        idempotencyKey: `settle-${suffix}`,
        sessionIdHash: "s".repeat(64),
        mobileHash: "m".repeat(64),
        callHash: "c".repeat(64),
        rrnHash: "r".repeat(64),
        rrn: `rrn-${suffix}`,
        providerFactorId: `provider-${suffix}`,
        providerResult: "true",
      };
      const concurrentSettlements = await Promise.all([
        repository.settleVerifiedPayment(settlementInput),
        repository.settleVerifiedPayment(settlementInput),
      ]);
      assert.deepEqual(concurrentSettlements.map((result) => result.kind).sort(), ["DUPLICATE", "SETTLED"]);

      const [settledOrder, settledIntent, paymentEventCount, callbackCount] = await Promise.all([
        prisma.order.findUniqueOrThrow({ where: { id: orderA.id } }),
        prisma.ussdPaymentIntent.findUniqueOrThrow({ where: { id: intent.id } }),
        prisma.paymentEvent.count({ where: { orderId: orderA.id, newStatus: "COMPLETED" } }),
        prisma.ussdCallbackEvent.count({ where: { paymentIntentId: intent.id, outcome: "ACCEPTED" } }),
      ]);
      assert.equal(settledOrder.paymentStatus, "COMPLETED");
      assert.equal(settledIntent.status, "SETTLED");
      assert.equal(settledIntent.amountRial, BigInt(12500));
      assert.equal(paymentEventCount, 1);
      assert.equal(callbackCount, 1);
    } finally {
      await prisma.ussdCallbackEvent.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.ussdPaymentIntent.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.paymentProviderAttempt.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.paymentRequest.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: [orderA.id, orderB.id] } } });
      await prisma.paymentEvent.deleteMany({ where: { orderId: { in: [orderA.id, orderB.id] } } });
      await prisma.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id] } } });
      await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    }
  });
});
