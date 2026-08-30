import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { prisma } from "@/lib/db";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isDisposable = /(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(databaseUrl);

function migrateDeploy() {
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}

describe("BB-P1 money migration acceptance", { skip: !isDisposable }, () => {
  it("converts legacy request/attempt Rial exactly once and preserves provider Rial evidence", async () => {
    const suffix = randomUUID().replace(/-/g, "");
    const organization = await prisma.organization.create({ data: { type: "SHOP", name: `Migration ${suffix}`, slug: `migration-${suffix}` } });
    const integration = await prisma.organizationIntegration.create({
      data: { organizationId: organization.id, provider: "INOTI_USSD", status: "ACTIVE", codeName: "migration", configuration: { paymentEnabled: true } },
    });
    const requestAmounts = [BigInt(220000), BigInt(1), BigInt("900719925474099")];
    const requests = await Promise.all(requestAmounts.map((amountToman, index) => prisma.paymentRequest.create({
      data: { organizationId: organization.id, providerIntegrationId: integration.id, amountToman, purpose: `MIGRATION_ACCEPTANCE_${index}`, status: "PENDING_VERIFICATION" },
    })));
    const request = requests[0];
    const attempt = await prisma.paymentProviderAttempt.create({
      data: { organizationId: organization.id, paymentRequestId: request.id, providerIntegrationId: integration.id, provider: "INOTI_USSD", status: "PENDING_VERIFICATION", amountToman: BigInt(220000), merchantFactorId: `BZ${suffix.slice(0, 32)}`, providerFactorId: `provider-${suffix}`, rrn: `rrn-${suffix}` },
    });
    const intent = await prisma.ussdPaymentIntent.create({
      data: { organizationId: organization.id, integrationId: integration.id, paymentRequestId: request.id, providerAttemptId: attempt.id, merchantFactorId: attempt.merchantFactorId!, amountRial: BigInt(2200000), sessionIdHash: "s".repeat(64), mobileHash: "m".repeat(64), mobileMasked: "0912***6789", status: "VERIFYING", providerFactorId: attempt.providerFactorId, rrn: attempt.rrn },
    });

    try {
      await prisma.$executeRawUnsafe('ALTER TABLE "PaymentRequest" DROP CONSTRAINT "PaymentRequest_amountToman_positive", DROP CONSTRAINT "PaymentRequest_currency_toman"');
      await prisma.$executeRawUnsafe('ALTER TABLE "PaymentProviderAttempt" DROP CONSTRAINT "PaymentProviderAttempt_amountToman_positive"');
      await prisma.$executeRawUnsafe('ALTER TABLE "PaymentRequest" RENAME COLUMN "amountToman" TO "amountRial"');
      await prisma.$executeRawUnsafe('ALTER TABLE "PaymentProviderAttempt" RENAME COLUMN "amountToman" TO "amountRial"');
      await prisma.$executeRawUnsafe('UPDATE "PaymentRequest" SET "amountRial" = "amountRial" * 10, "currency" = \'IRR\'');
      await prisma.$executeRawUnsafe('UPDATE "PaymentProviderAttempt" SET "amountRial" = "amountRial" * 10');
      await prisma.$executeRawUnsafe('ALTER TABLE "PaymentRequest" ALTER COLUMN "currency" SET DEFAULT \'IRR\'');
      await prisma.$executeRawUnsafe('DELETE FROM "_prisma_migrations" WHERE migration_name = \'20260830000100_reconcile_payment_money_semantics\'');
      await prisma.$disconnect();

      migrateDeploy();
      const [convertedRequests, convertedAttempt, preservedIntent, preservedOrganization] = await Promise.all([
        prisma.paymentRequest.findMany({ where: { id: { in: requests.map(({ id }) => id) } }, orderBy: { purpose: "asc" } }),
        prisma.paymentProviderAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
        prisma.ussdPaymentIntent.findUniqueOrThrow({ where: { id: intent.id } }),
        prisma.organization.findUniqueOrThrow({ where: { id: organization.id } }),
      ]);
      assert.deepEqual(convertedRequests.map(({ amountToman }) => amountToman), requestAmounts);
      assert.ok(convertedRequests.every(({ currency }) => currency === "TOMAN"));
      assert.ok(convertedRequests.every(({ status }) => status === "PENDING_VERIFICATION"));
      assert.equal(convertedAttempt.amountToman, BigInt(220000));
      assert.equal(convertedAttempt.providerFactorId, attempt.providerFactorId);
      assert.equal(convertedAttempt.rrn, attempt.rrn);
      assert.equal(preservedIntent.amountRial, BigInt(2200000));
      assert.equal(preservedIntent.sessionIdHash, "s".repeat(64));
      assert.equal(preservedOrganization.name, `Migration ${suffix}`);

      migrateDeploy();
      assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: request.id } })).amountToman, BigInt(220000));
    } finally {
      await prisma.ussdPaymentIntent.deleteMany({ where: { id: intent.id } });
      await prisma.paymentProviderAttempt.deleteMany({ where: { id: attempt.id } });
      await prisma.paymentRequest.deleteMany({ where: { id: { in: requests.map(({ id }) => id) } } });
      await prisma.organizationIntegration.deleteMany({ where: { id: integration.id } });
      await prisma.organization.deleteMany({ where: { id: organization.id } });
      await prisma.$disconnect();
    }
  });
});
