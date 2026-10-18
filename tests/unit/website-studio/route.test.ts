import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { ZodError } from "zod";

type Actor = { userId: string; role: "MANAGER" | "ADMIN" | "SUPER_ADMIN"; organizationId: string };
let session: { user: { id: string; role: Actor["role"]; organizationId: string } } | null = {
  user: { id: "manager-1", role: "MANAGER", organizationId: "org-1" },
};
let calls: Array<{ name: string; actor: Actor; organizationId: string; body?: unknown }> = [];
let serviceError: unknown = null;

class TestApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown, fallback: string) => Response.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: error instanceof TestApiError ? error.status : 500 },
  ),
  requireAuthSession: async () => {
    if (!session) throw new TestApiError(401, "Unauthorized");
    return session;
  },
  requireSameOriginMutation: (request: Request) => {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      throw new TestApiError(403, "Cross-origin request rejected");
    }
  },
} });

mock.module("@/lib/website-studio/retail.service", { namedExports: {
  RetailWebsiteService: class {
    async load(actor: Actor, organizationId: string) {
      calls.push({ name: "load", actor, organizationId });
      if (serviceError) throw serviceError;
      return { revision: { id: "revision-1" }, content: { sections: [] } };
    }
    async save(actor: Actor, organizationId: string, body: unknown) {
      calls.push({ name: "save", actor, organizationId, body });
      if (serviceError) throw serviceError;
      return { revision: { id: "revision-2" }, content: body };
    }
  },
} });

let GET: typeof import("../../../app/api/organizations/[id]/website/route").GET;
let POST: typeof import("../../../app/api/organizations/[id]/website/route").POST;
before(async () => {
  ({ GET, POST } = await import("../../../app/api/organizations/[id]/website/route"));
});

const context = { params: Promise.resolve({ id: "org-route" }) };
function request(method: "GET" | "POST", body?: string, headers: Record<string, string> = { origin: "https://app.example" }) {
  return new NextRequest("https://app.example/api/organizations/org-route/website", {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body }),
  });
}

function chunkedRequest(body: string, headers: Record<string, string>) {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const first = Math.floor(bytes.length / 3);
      const second = Math.floor((bytes.length * 2) / 3);
      controller.enqueue(bytes.slice(0, first));
      controller.enqueue(bytes.slice(first, second));
      controller.enqueue(bytes.slice(second));
      controller.close();
    },
  });
  return new Request("https://app.example/api/organizations/org-route/website", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: stream,
    duplex: "half",
  });
}

test("website API requires authentication for reads and writes and returns private no-store responses", async () => {
  calls = [];
  session = null;
  const read = await GET(request("GET"), context);
  assert.equal(read.status, 401);
  assert.equal(read.headers.get("cache-control"), "private, no-store, max-age=0");
  const write = await POST(request("POST", "{}"), context);
  assert.equal(write.status, 401);
  assert.equal(write.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.equal(calls.length, 0);
  session = { user: { id: "manager-1", role: "MANAGER", organizationId: "org-1" } };
});

test("website API rejects cross-origin, malformed, and oversized draft requests before service access", async () => {
  calls = [];
  assert.equal((await POST(request("POST", "{}", { origin: "https://attacker.example" }), context)).status, 403);
  assert.equal((await POST(request("POST", "{"), context)).status, 400);
  assert.equal((await POST(request("POST", "x".repeat(200_001)), context)).status, 413);
  assert.equal(calls.length, 0);
});

test("website API enforces the byte limit across chunks when content length is absent or understated", async () => {
  calls = [];
  const body = `{"text":"${"ا".repeat(100_001)}"}`;
  assert.ok(body.length < 200_000, "fixture stays below the limit by JavaScript character count");
  assert.ok(new TextEncoder().encode(body).byteLength > 200_000, "fixture exceeds the limit by UTF-8 byte count");

  const withoutLength = chunkedRequest(body, { origin: "https://app.example" });
  assert.equal(withoutLength.headers.get("content-length"), null);
  assert.equal((await POST(withoutLength, context)).status, 413);

  const understatedLength = chunkedRequest(body, { origin: "https://app.example", "content-length": "12" });
  assert.equal((await POST(understatedLength, context)).status, 413);
  assert.equal(calls.length, 0);
});

test("website API binds service calls to the authenticated actor and route organization", async () => {
  calls = [];
  const read = await GET(request("GET"), context);
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("cache-control"), "private, no-store, max-age=0");
  const body = { sections: [{ key: "hero", kind: "HERO" }] };
  const write = await POST(request("POST", JSON.stringify(body)), context);
  assert.equal(write.status, 201);
  assert.equal(write.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(calls.map(({ name, actor, organizationId }) => ({ name, actor, organizationId })), [
    { name: "load", actor: { userId: "manager-1", role: "MANAGER", organizationId: "org-1" }, organizationId: "org-route" },
    { name: "save", actor: { userId: "manager-1", role: "MANAGER", organizationId: "org-1" }, organizationId: "org-route" },
  ]);
  assert.deepEqual(calls[1].body, body);
});

test("website API converts service validation errors to uncached 422 responses", async () => {
  serviceError = new ZodError([]);
  const response = await POST(request("POST", "{}"), context);
  serviceError = null;
  assert.equal(response.status, 422);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
});
