import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { requireSameOriginMutation } from "@/lib/api-guards";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://hotel.example.test/api/management", {
    method: "PATCH",
    headers,
  });
}

test("same-origin mutation with matching Origin is accepted", () => {
  assert.doesNotThrow(() => requireSameOriginMutation(request({
    origin: "https://hotel.example.test",
    "sec-fetch-site": "same-origin",
  })));
});

test("cross-origin, absent, malformed, and cross-site metadata are rejected", () => {
  assert.throws(() => requireSameOriginMutation(request({ origin: "https://evil.example" })));
  assert.throws(() => requireSameOriginMutation(request()));
  assert.throws(() => requireSameOriginMutation(request({ origin: "null" })));
  assert.throws(() => requireSameOriginMutation(request({
    origin: "https://hotel.example.test",
    "sec-fetch-site": "cross-site",
  })));
});

test("forwarded-host headers cannot change the trusted expected origin", () => {
  assert.throws(() => requireSameOriginMutation(request({
    origin: "https://attacker.example",
    "x-forwarded-host": "hotel.example.test",
    "x-forwarded-proto": "https",
  })));
});
