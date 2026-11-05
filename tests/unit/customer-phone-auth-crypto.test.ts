import test from "node:test";
import assert from "node:assert/strict";
import { createCustomerAccessToken, customerAuthDigest, decryptCustomerAuthPayload, encryptCustomerAuthPayload } from "../../lib/customer-auth/crypto";

const secret = "test-only-customer-auth-secret-32-bytes-minimum";
test("tokens are opaque, randomized and digests are secret-bound", () => {
  const token = createCustomerAccessToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(createCustomerAccessToken(), token);
  assert.notEqual(customerAuthDigest(token, secret), customerAuthDigest(token, `${secret}!`));
  assert.throws(() => customerAuthDigest(token, "short"));
});
test("encrypted outbox hides URL and phone; authentication binds ciphertext to link", () => {
  const payload = { phone: "09123456789", url: `https://example.test/customer-auth/consume#token=${createCustomerAccessToken()}` };
  const encrypted = encryptCustomerAuthPayload(payload, secret, "link-a");
  assert(!encrypted.includes(payload.phone));
  assert(!encrypted.includes(payload.url));
  assert.deepEqual(decryptCustomerAuthPayload(encrypted, secret, "link-a"), payload);
  assert.throws(() => decryptCustomerAuthPayload(encrypted, secret, "link-b"));
  assert.throws(() => decryptCustomerAuthPayload(encrypted, `${secret}!`, "link-a"));
  const parts = encrypted.split(".");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  assert.throws(() => decryptCustomerAuthPayload(parts.join("."), secret, "link-a"));
});
