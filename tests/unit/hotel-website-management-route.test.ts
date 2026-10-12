import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

let session: { user: { id: string; role: "ADMIN" | "MANAGER" | "SUPER_ADMIN"; organizationId: string } } | null = { user: { id: "author-1", role: "MANAGER", organizationId: "org-1" } };
let calls: Array<{ name: string; args: unknown[] }> = [];
let conflictOnSubmit = false;

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
class TestAuthorizationError extends Error {}
class TestValidationError extends Error {}
class TestConflictError extends Error {}
class TestNotFoundError extends Error {}

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => Response.json({ error: error instanceof TestApiError ? error.message : "Internal server error" }, { status: error instanceof TestApiError ? error.status : 500 }),
  requireAuthSession: async () => { if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
  requireSameOriginMutation: (request: Request) => { if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected"); },
} });
mock.module("@/lib/hotel/content/hotel-website-content.service", { namedExports: { HotelWebsiteContentAuthorizationError: TestAuthorizationError, HotelWebsiteContentValidationError: TestValidationError } });
mock.module("@/lib/hotel/content/hotel-website-management.service", { namedExports: {
  HotelWebsiteManagementConflictError: TestConflictError,
  HotelWebsiteManagementNotFoundError: TestNotFoundError,
  HotelWebsiteManagementService: class {
    createDraft(...args: unknown[]) { calls.push({ name: "createDraft", args }); return Promise.resolve({ result: { revisionId: "revision-1" }, replayed: false }); }
    listRevisions(...args: unknown[]) { calls.push({ name: "listRevisions", args }); return Promise.resolve([]); }
    submit(...args: unknown[]) { calls.push({ name: "submit", args }); if (conflictOnSubmit) throw new TestConflictError(); return Promise.resolve({ result: { status: "IN_REVIEW" }, replayed: false }); }
    preview(...args: unknown[]) { calls.push({ name: "preview", args }); return Promise.resolve({ mode: "PREVIEW", locale: args[3], revisionId: "revision-1" }); }
  },
} });

let createDraft: typeof import("../../app/api/organizations/[organizationId]/hotels/[propertyId]/website/revisions/route").POST;
let submit: typeof import("../../app/api/organizations/[organizationId]/hotels/[propertyId]/website/revisions/[revisionId]/submit/route").POST;
let list: typeof import("../../app/api/organizations/[organizationId]/hotels/[propertyId]/website/revisions/route").GET;
let preview: typeof import("../../app/api/organizations/[organizationId]/hotels/[propertyId]/website/revisions/[revisionId]/preview/route").GET;
before(async () => {
  ({ POST: createDraft, GET: list } = await import("../../app/api/organizations/[organizationId]/hotels/[propertyId]/website/revisions/route"));
  ({ POST: submit } = await import("../../app/api/organizations/[organizationId]/hotels/[propertyId]/website/revisions/[revisionId]/submit/route"));
  ({ GET: preview } = await import("../../app/api/organizations/[organizationId]/hotels/[propertyId]/website/revisions/[revisionId]/preview/route"));
});

const routeContext = { params: Promise.resolve({ organizationId: "org-1", propertyId: "property-1", revisionId: "revision-1" }) };
function request(body: unknown = {}, headers: Record<string, string> = { origin: "https://app.example", "idempotency-key": "website-key-0001" }) {
  return new NextRequest("https://app.example/api/website", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

test("mutation routes require a trusted authenticated session, same origin, and idempotency key", async () => {
  calls = [];
  assert.equal((await createDraft(request({}, { "idempotency-key": "website-key-0001" }), routeContext)).status, 403);
  session = null;
  assert.equal((await createDraft(request(), routeContext)).status, 401);
  session = { user: { id: "author-1", role: "MANAGER", organizationId: "org-1" } };
  assert.equal((await createDraft(request({}, { origin: "https://app.example" }), routeContext)).status, 400);
  assert.equal((await createDraft(request({}, { origin: "https://app.example", "idempotency-key": "short" }), routeContext)).status, 400);
  assert.equal((await createDraft(request({}, { origin: "https://app.example", "idempotency-key": `x${"a".repeat(128)}` }), routeContext)).status, 400);
  assert.equal(calls.length, 0);
});

test("draft and submit handlers take actor identity from session and tenant/property from route", async () => {
  calls = [];
  const created = await createDraft(request({ content: {}, media: [] }), routeContext);
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "private, no-store, max-age=0");
  const call = calls[0];
  assert.equal(call.name, "createDraft");
  assert.deepEqual(call.args.slice(0, 2), [
    { userId: "author-1", role: "MANAGER", organizationId: "org-1" },
    { organizationId: "org-1", propertyId: "property-1" },
  ]);
  assert.equal(call.args[3], "website-key-0001");
  assert.equal((await submit(request({ note: "review this" }), routeContext)).status, 200);
  assert.equal(calls[1].name, "submit");
  assert.deepEqual(calls[1].args.slice(0, 3), [
    { userId: "author-1", role: "MANAGER", organizationId: "org-1" },
    { organizationId: "org-1", propertyId: "property-1" },
    "revision-1",
  ]);
  conflictOnSubmit = true;
  const conflict = await submit(request({ note: "review this" }), routeContext);
  conflictOnSubmit = false;
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, "Hotel website state conflict");
});

test("authenticated revision reads are uncached", async () => {
  session = { user: { id: "admin-1", role: "ADMIN", organizationId: "org-1" } };
  const response = await list(new NextRequest("https://app.example/api/website"), routeContext);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  const previewResponse = await preview(new NextRequest("https://app.example/api/website?locale=ar"), routeContext);
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(await previewResponse.json(), { mode: "PREVIEW", locale: "ar", revisionId: "revision-1" });
  assert.equal((await preview(new NextRequest("https://app.example/api/website?locale=de"), routeContext)).status, 400);
});
