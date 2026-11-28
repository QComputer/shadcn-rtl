import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { isWholeTomanAmount, retailProductPriceForPaymentMethod, snappPayInstallmentProductPrice } from "@/lib/retail/snappay-installment-pricing";
import { retailPaymentPolicyInput, saveRetailPaymentPolicy } from "@/lib/retail/payment-policy.server";
import { SnappPayBlockedAdapter } from "@/lib/integrations/runtime/adapters";

describe("SnappPay installment price", () => {
  it("adds exactly eleven percent with decimal arithmetic", () => {
    assert.equal(snappPayInstallmentProductPrice(new Prisma.Decimal("1000")).toString(), "1110");
    assert.equal(snappPayInstallmentProductPrice(new Prisma.Decimal("125.50")).toString(), "139.305");
    assert.equal(snappPayInstallmentProductPrice(new Prisma.Decimal("0.01")).toString(), "0.0111");
    for (const method of [undefined, "CASH", "BANK_TRANSFER", "INOTI_USSD"] as const) {
      assert.equal(retailProductPriceForPaymentMethod(new Prisma.Decimal("125.50"), method).toString(), "125.5");
    }
    assert.equal(retailProductPriceForPaymentMethod(new Prisma.Decimal("125.50"), "SNAPPPAY_INSTALLMENT").toString(), "139.305");
  });

  it("rejects invalid ordinary amounts and fractional SnappPay totals", () => {
    assert.throws(() => snappPayInstallmentProductPrice(new Prisma.Decimal("-1")), RangeError);
    assert.equal(isWholeTomanAmount(new Prisma.Decimal("1110")), true);
    assert.equal(isWholeTomanAmount(new Prisma.Decimal("1110.5")), false);
    assert.equal(isWholeTomanAmount(new Prisma.Decimal("0")), false);
  });

  it("defaults the new tenant setting off and rejects enabling it before readiness gates", async () => {
    const legacyPolicy = retailPaymentPolicyInput.parse({
      bankTransferEnabled: true, cashEnabled: false, inotiUssdEnabled: false,
      bankCardNumber: "6037990000000000", bankAccountOwner: "Synthetic Merchant",
      cashModes: ["COUNTER"], cashBeforeConfirmation: true,
      paymentDeadlinesMinutes: { bankTransfer: 1440, cash: 2880, inotiUssd: 15 },
    });
    assert.equal(legacyPolicy.snappPayInstallmentsEnabled, false);
    assert.equal(legacyPolicy.bankTransferEnabled, true);
    await assert.rejects(() => saveRetailPaymentPolicy("synthetic-shop", "synthetic-org", "synthetic-user", {
      ...legacyPolicy, snappPayInstallmentsEnabled: true,
    }), { status: 409 });
  });

  it("keeps provider health blocked without making a provider request", async () => {
    const adapter = new SnappPayBlockedAdapter();
    const health = await adapter.checkHealth({
      organizationId: "synthetic-organization", integrationId: "synthetic-integration",
      provider: "SNAPPPAY", status: "ACTIVE", codeName: "synthetic", credentialProfileKey: "synthetic-profile",
      configuration: {}, capabilityKeys: ["SHOP"],
    });
    assert.equal(health.connected, false);
    assert.equal(health.status, "BLOCKED");
    assert.equal(health.errorCode, "SNAPPPAY_PROVIDER_READINESS_REQUIRED");
  });
});
