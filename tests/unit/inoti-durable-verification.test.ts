import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  correlationFingerprint,
  decryptPaymentCorrelation,
  encryptPaymentCorrelation,
} from "@/lib/integrations/inoti-ussd/correlation-envelope";
import { durableRetryDecision } from "@/lib/integrations/inoti-ussd/durable-retry-policy";

const correlation = {
  sessionId: "session-123",
  mobile: "09121234567",
  call: "*1*2*factor*provider#",
  rrn: "rrn-123",
  merchantFactorId: `BZ${"a".repeat(32)}`,
  providerFactorId: "provider-123",
};
const context = { organizationId: "org-a", integrationId: "integration-a", paymentIntentId: "intent-a" };
const env = {
  INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION: "7",
  INOTI_PAYMENT_CORRELATION_KEY_V7: Buffer.alloc(32, 19).toString("base64"),
} as unknown as NodeJS.ProcessEnv;

describe("durable iNoti verification", () => {
  it("round-trips a versioned authenticated envelope without plaintext", () => {
    const envelope = encryptPaymentCorrelation(correlation, context, env);
    assert.equal(envelope.keyVersion, 7);
    assert.equal(JSON.stringify(envelope).includes(correlation.mobile), false);
    assert.deepEqual(decryptPaymentCorrelation(envelope, context, env), correlation);
  });

  it("fails closed on ciphertext or tenant-context tampering", () => {
    const envelope = encryptPaymentCorrelation(correlation, context, env);
    assert.throws(() => decryptPaymentCorrelation({ ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}AA` }, context, env));
    assert.throws(() => decryptPaymentCorrelation(envelope, { ...context, organizationId: "org-b" }, env));
  });

  it("uses stable correlation identity without exposing raw values", () => {
    const fingerprint = correlationFingerprint(correlation, env);
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(fingerprint.includes(correlation.rrn), false);
    assert.equal(fingerprint, correlationFingerprint({ ...correlation }, env));
  });

  it("retries transient failures with bounded backoff and exhausts", () => {
    assert.deepEqual(durableRetryDecision("NOT_FOUND", 1), {
      failureClass: "TEMPORARY_NOT_FOUND", status: "RETRY", retryAfterSeconds: 30,
    });
    assert.equal(durableRetryDecision("TIMEOUT", 4).retryAfterSeconds, 1800);
    assert.equal(durableRetryDecision("PROVIDER_ERROR", 5).status, "EXHAUSTED");
  });

  it("routes ambiguous and mismatched evidence directly to manual review", () => {
    assert.equal(durableRetryDecision("AMBIGUOUS_MATCH", 1).status, "MANUAL_REVIEW");
    assert.equal(durableRetryDecision("CORRELATION_MISMATCH", 1).status, "MANUAL_REVIEW");
  });
});
