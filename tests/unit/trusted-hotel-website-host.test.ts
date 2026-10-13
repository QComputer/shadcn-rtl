import assert from "node:assert/strict";
import { test } from "node:test";
import { trustedHotelWebsiteHost } from "@/lib/hotel/trusted-website-host";

test("custom-domain Hotel rendering uses only the proxy-resolved tenant host", () => {
  assert.equal(trustedHotelWebsiteHost({
    requestHost: "localhost:3000",
    isCustomDomain: "true",
    tenantDomain: "hotel.example",
  }), "hotel.example");
});

test("platform requests do not accept an untrusted tenant-domain header", () => {
  assert.equal(trustedHotelWebsiteHost({
    requestHost: "localhost:3000",
    isCustomDomain: null,
    tenantDomain: "attacker.example",
  }), "localhost:3000");
});

test("custom-domain context fails closed when trusted host metadata is missing", () => {
  assert.equal(trustedHotelWebsiteHost({
    requestHost: "localhost:3000",
    isCustomDomain: "true",
    tenantDomain: null,
  }), null);
});
