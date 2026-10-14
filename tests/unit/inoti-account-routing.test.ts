import assert from "node:assert/strict";
import test from "node:test";
import { generateBazarBaazFactorId } from "@/lib/payments/payment-request.service";
import { resolveBoundInotiPaymentAccount } from "@/lib/integrations/inoti-ussd/account-routing.server";
import { buildInotiUssdPaymentDialPrefix } from "@/lib/integrations/inoti-ussd/callback-url";
import type { InotiCredentialProfile, InotiMerchantAccountKey } from "@/lib/integrations/inoti-ussd/types";

const profileFor = (accountKey: InotiMerchantAccountKey): InotiCredentialProfile => ({
  organizationId: accountKey === "PLATFORM_OWNER" ? "__platform__" : "__cafe_leo_payment_account__",
  profileKey: accountKey === "PLATFORM_OWNER" ? "local-env:inoti:platform" : "local-env:inoti:cafe-leo",
  username: "fixture-user",
  password: "fixture-password",
  endpoint: "https://fixture.invalid/ExternalUssdPay.asmx",
  ussdCodeName: accountKey === "PLATFORM_OWNER" ? "platform-code" : "cafe-code",
  ussdDialString: "*6655*fixture*2*1#",
});

test("allocates only numeric 9-digit factors", () => {
  const factors = Array.from({ length: 100 }, () => generateBazarBaazFactorId());
  for (const factor of factors) assert.match(factor, /^[1-9]\d{8}$/);
});

test("builds the payment CodeName prefix and leaves the final public order code to the checkout flow", () => {
  assert.equal(buildInotiUssdPaymentDialPrefix("owner-code"), "*6655*owner-code*2");
  assert.throws(() => buildInotiUssdPaymentDialPrefix("bad*code"));
});

test("resolves verification credentials from the immutable account snapshot", async () => {
  const calls: InotiMerchantAccountKey[] = [];
  const credentialProvider = {
    async resolveProfile() { assert.fail("bound payments must not re-resolve a tenant profile"); },
    async resolvePaymentAccount(accountKey: InotiMerchantAccountKey) {
      calls.push(accountKey);
      return profileFor(accountKey);
    },
  };

  const platform = await resolveBoundInotiPaymentAccount({
    organizationId: "tenant-a",
    merchantAccountKey: "PLATFORM_OWNER",
    credentialProfileKey: "local-env:inoti:platform",
    merchantCodeName: "platform-code",
    credentialProvider,
  });
  const cafe = await resolveBoundInotiPaymentAccount({
    organizationId: "tenant-cafe",
    merchantAccountKey: "CAFE_LEO",
    credentialProfileKey: "local-env:inoti:cafe-leo",
    merchantCodeName: "cafe-code",
    credentialProvider,
  });

  assert.equal(platform?.profileKey, "local-env:inoti:platform");
  assert.equal(cafe?.profileKey, "local-env:inoti:cafe-leo");
  assert.deepEqual(calls, ["PLATFORM_OWNER", "CAFE_LEO"]);
});

test("rejects a mismatched account profile or CodeName snapshot", async () => {
  const credentialProvider = { async resolvePaymentAccount(key: InotiMerchantAccountKey) { return profileFor(key); } };
  assert.equal(await resolveBoundInotiPaymentAccount({
    organizationId: "tenant-a",
    merchantAccountKey: "PLATFORM_OWNER",
    credentialProfileKey: "local-env:inoti:cafe-leo",
    merchantCodeName: "platform-code",
    credentialProvider,
  }), null);
  assert.equal(await resolveBoundInotiPaymentAccount({
    organizationId: "tenant-a",
    merchantAccountKey: "PLATFORM_OWNER",
    credentialProfileKey: "local-env:inoti:platform",
    merchantCodeName: "changed-code",
    credentialProvider,
  }), null);
  assert.equal(await resolveBoundInotiPaymentAccount({
    organizationId: "tenant-a",
    merchantAccountKey: "UNTRUSTED",
    credentialProfileKey: "local-env:inoti:platform",
    merchantCodeName: "platform-code",
    credentialProvider,
  }), null);
});
