import assert from "node:assert/strict";
import { test } from "node:test";
import { isDamoonDemoBookingRequest } from "../../../lib/hotel/services/damoon-demo-booking";

test("demo booking identity is restricted to the Damoon host, organization and isolated property", () => {
  const request = { host: "www.damoon-hotel.ir:443", organizationSlug: "damoon-hotel", propertySlug: "damoon-demo" };
  assert.equal(isDamoonDemoBookingRequest(request), true);
  assert.equal(isDamoonDemoBookingRequest({ ...request, host: "damoon-hotel.ir.evil.test" }), false);
  assert.equal(isDamoonDemoBookingRequest({ ...request, organizationSlug: "another-hotel" }), false);
  assert.equal(isDamoonDemoBookingRequest({ ...request, propertySlug: "damoon-hotel" }), false);
});

test("synthetic CI tenant identity requires the isolated E2E marker", () => {
  const environment = process.env as Record<string, string | undefined>;
  const original = environment.DAMOON_E2E_ENABLED;
  const originalNodeEnv = environment.NODE_ENV;
  try {
    environment.NODE_ENV = "test";
    delete environment.DAMOON_E2E_ENABLED;
    const request = { host: "damoon-hotel.ir", organizationSlug: "damoon-e2e-0123456789abcdef-a", propertySlug: "damoon-demo" };
    assert.equal(isDamoonDemoBookingRequest(request), false);
    environment.DAMOON_E2E_ENABLED = "1";
    assert.equal(isDamoonDemoBookingRequest(request), true);
    assert.equal(isDamoonDemoBookingRequest({ ...request, organizationSlug: "damoon-e2e-0123456789abcdef-b" }), false);
  } finally {
    if (original === undefined) delete environment.DAMOON_E2E_ENABLED;
    else environment.DAMOON_E2E_ENABLED = original;
    if (originalNodeEnv === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = originalNodeEnv;
  }
});
