import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { PrismaUssdIntegrationRepository } from "@/lib/integrations/inoti-ussd/repository";
import type { ResolvedInotiIntegration } from "@/lib/integrations/inoti-ussd/types";

const localDatabaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(localDatabaseUrl.hostname),
  "inoti-ussd.local.test.ts refuses to run against a non-local database",
);

describe("iNoti USSD integration on disposable local PostgreSQL", () => {
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
        amountRial: BigInt(12500),
      });
      const sameIntent = await repository.createOrGetPaymentIntent({
        integration,
        order: scopedOrder,
        sessionIdHash: "s".repeat(64),
        mobileHash: "m".repeat(64),
        mobileMasked: "0912***6789",
        amountRial: BigInt(12500),
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
      await prisma.organizationIntegration.update({ where: { id: integration.id }, data: { status: "ACTIVE", disabledAt: null } });
      assert.equal((await repository.resolveIntegration(integration.publicId))?.status, "ACTIVE");
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
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: [orderA.id, orderB.id] } } });
      await prisma.paymentEvent.deleteMany({ where: { orderId: { in: [orderA.id, orderB.id] } } });
      await prisma.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id] } } });
      await prisma.organizationIntegration.deleteMany({ where: { organizationId: { in: [organizationA.id, organizationB.id] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    }
  });
});
