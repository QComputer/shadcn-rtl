import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCustomerLoginCallback } from "../../lib/customer-auth/login-callback";

describe("resolveCustomerLoginCallback", () => {
  it("allows internal hotel portal callbacks and preserves safe stay query values", () => {
    const target = "/fa/hotel/org-123/property-456?checkIn=2027-02-01&checkOut=2027-02-03&adults=2&children=2&childAges=,9";
    assert.equal(resolveCustomerLoginCallback(target, "fa"), target);
  });

  it("rejects absolute and protocol-relative destinations", () => {
    assert.equal(resolveCustomerLoginCallback("https://evil.example/fa", "en"), "/en");
    assert.equal(resolveCustomerLoginCallback("//evil.example/fa", "en"), "/en");
  });

  it("rejects raw and encoded backslash or authority-like path normalization", () => {
    assert.equal(resolveCustomerLoginCallback("/\\evil.example/fa", "ar"), "/ar");
    assert.equal(resolveCustomerLoginCallback("/%2f%2fevil.example/fa", "ar"), "/ar");
    assert.equal(resolveCustomerLoginCallback("/%5cevil.example/fa", "ar"), "/ar");
  });

  it("rejects token-bearing query strings and fragments", () => {
    assert.equal(resolveCustomerLoginCallback("/fa/hotel/x/y?token=secret", "fa"), "/fa");
    assert.equal(resolveCustomerLoginCallback("/fa/hotel/x/y#TOKEN=secret", "fa"), "/fa");
  });

  it("falls back to a supported locale root for invalid input", () => {
    assert.equal(resolveCustomerLoginCallback(undefined, "fr"), "/fa");
    assert.equal(resolveCustomerLoginCallback("/fa/%E0%A4%A", "fa"), "/fa");
  });
});
