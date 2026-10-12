import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server";

let publicationEnabled = true;
let propertyResult: unknown = { source: "PUBLISHED", locale: "fa", property: { slug: "damoon", name: "Persisted", description: null, localizedText: null, timezone: "Asia/Tehran", currency: "TOMAN", checkInTime: "14:00", checkOutTime: "11:00", minStayNights: 1, maxStayNights: 30 } };
const categoriesResult: unknown = { source: "PUBLISHED", locale: "fa", property: { slug: "damoon" }, roomCategories: [] };
const policiesResult: unknown = { source: "PUBLISHED", locale: "fa", property: { slug: "damoon" }, roomCategory: { slug: "standard" }, cancellationPolicies: [] };
let failPropertyRead = false;
const calls: Array<{ operation: string; input: unknown }> = [];

mock.module(pathToFileURL(resolve("lib/hotel/services/public-catalog.service.ts")).href, { namedExports: {
  getPublishedHotelProperty: async (input: unknown) => { calls.push({ operation: "property", input }); if (failPropertyRead) throw new Error("private database details"); return propertyResult; },
  listPublishedHotelRoomCategories: async (input: unknown) => { calls.push({ operation: "roomCategories", input }); return categoriesResult; },
  listPublishedHotelRoomPolicies: async (input: unknown) => { calls.push({ operation: "roomPolicies", input }); return policiesResult; },
} });
mock.module(pathToFileURL(resolve("lib/hotel/services/public-publication-gate.ts")).href, { namedExports: {
  isApprovedHotelPublicationAvailable: () => publicationEnabled,
  HOTEL_PUBLICATION_GATE_MESSAGE: "internal gate details must not be returned",
} });

let propertyGET: typeof import("../../app/api/hotel/v1/properties/[propertySlug]/route").GET;
let categoriesGET: typeof import("../../app/api/hotel/v1/properties/[propertySlug]/room-types/route").GET;
let policiesGET: typeof import("../../app/api/hotel/v1/properties/[propertySlug]/room-types/[roomTypeSlug]/policies/route").GET;
before(async () => {
  ({ GET: propertyGET } = await import("../../app/api/hotel/v1/properties/[propertySlug]/route"));
  ({ GET: categoriesGET } = await import("../../app/api/hotel/v1/properties/[propertySlug]/room-types/route"));
  ({ GET: policiesGET } = await import("../../app/api/hotel/v1/properties/[propertySlug]/room-types/[roomTypeSlug]/policies/route"));
});

function request(path: string) {
  return new NextRequest(`https://damoon.example${path}`, { headers: { host: "damoon.example" } });
}

test("published property route passes the trusted host and requested locale with no-store response", { concurrency: false }, async () => {
  calls.length = 0; publicationEnabled = true; failPropertyRead = false;
  const response = await propertyGET(request("/api/hotel/v1/properties/damoon?locale=ar"), { params: Promise.resolve({ propertySlug: "damoon" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(await response.json(), propertyResult);
  assert.deepEqual(calls, [{ operation: "property", input: { host: "damoon.example", propertySlug: "damoon", locale: "ar" } }]);
});

test("room-category route returns the published response contract and defaults to Persian", { concurrency: false }, async () => {
  calls.length = 0; publicationEnabled = true;
  const response = await categoriesGET(request("/api/hotel/v1/properties/damoon/room-types"), { params: Promise.resolve({ propertySlug: "damoon" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(await response.json(), categoriesResult);
  assert.deepEqual(calls, [{ operation: "roomCategories", input: { host: "damoon.example", propertySlug: "damoon", locale: "fa" } }]);
});

test("room-policy route passes both slugs and locale through the current publication gate", { concurrency: false }, async () => {
  calls.length = 0; publicationEnabled = true;
  const response = await policiesGET(request("/api/hotel/v1/properties/damoon/room-types/standard/policies?locale=en"), { params: Promise.resolve({ propertySlug: "damoon", roomTypeSlug: "standard" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(await response.json(), policiesResult);
  assert.deepEqual(calls, [{ operation: "roomPolicies", input: { host: "damoon.example", propertySlug: "damoon", roomTypeSlug: "standard", locale: "en" } }]);
});

test("disabled publication gate and invalid request values fail before data is read", { concurrency: false }, async () => {
  calls.length = 0;
  publicationEnabled = false;
  const disabled = await propertyGET(request("/api/hotel/v1/properties/damoon"), { params: Promise.resolve({ propertySlug: "damoon" }) });
  assert.equal(disabled.status, 503);
  assert.deepEqual(await disabled.json(), { error: "PUBLICATION_DISABLED" });

  publicationEnabled = true;
  const badLocale = await propertyGET(request("/api/hotel/v1/properties/damoon?locale=de"), { params: Promise.resolve({ propertySlug: "damoon" }) });
  assert.equal(badLocale.status, 400);
  const badSlug = await categoriesGET(request("/api/hotel/v1/properties/x/room-types"), { params: Promise.resolve({ propertySlug: "x" }) });
  assert.equal(badSlug.status, 400);
  assert.deepEqual(calls, []);
});

test("missing publication and unexpected failures have generic public errors", { concurrency: false }, async () => {
  calls.length = 0; publicationEnabled = true;
  propertyResult = null;
  const missing = await propertyGET(request("/api/hotel/v1/properties/missing"), { params: Promise.resolve({ propertySlug: "missing" }) });
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "NOT_FOUND" });

  failPropertyRead = true;
  const failed = await propertyGET(request("/api/hotel/v1/properties/damoon"), { params: Promise.resolve({ propertySlug: "damoon" }) });
  assert.equal(failed.status, 500);
  const failedBody = await failed.text();
  assert.deepEqual(JSON.parse(failedBody), { error: "UNAVAILABLE" });
  assert.equal(failedBody.includes("private database details"), false);

  failPropertyRead = false;
  propertyResult = { source: "PUBLISHED", locale: "fa", property: { slug: "damoon", name: "Persisted", description: null, localizedText: null, timezone: "Asia/Tehran", currency: "TOMAN", checkInTime: "14:00", checkOutTime: "11:00", minStayNights: 1, maxStayNights: 30 } };
});
