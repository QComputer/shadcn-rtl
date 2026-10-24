import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, mock, test } from "node:test";

class TestApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

let session: { user?: { id?: string } } | null = null;
const guardCalls: string[] = [];
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => new Response(JSON.stringify({ error: error instanceof TestApiError && error.status < 500 ? error.message : "Internal server error" }), { status: error instanceof TestApiError ? error.status : 500, headers: { "content-type": "application/json" } }),
  requireAuthSession: async () => { guardCalls.push("auth"); if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
  requireOrgAccess: async (value: typeof session, organizationId: string, roles: string[]) => { guardCalls.push(`org:${organizationId}:${roles.join(",")}`); if (!value) throw new TestApiError(401, "Unauthorized"); if (organizationId !== "org-a" || !roles.includes("ADMIN")) throw new TestApiError(403, "Forbidden"); },
  requireRole: (value: typeof session, roles: string[]) => { guardCalls.push(`role:${roles.join(",")}`); if (!value || !roles.includes("SUPER_ADMIN")) throw new TestApiError(403, "Forbidden"); },
} });

let GET: (request: Request, context: { params: Promise<{ organizationId: string; key: string[] }> }) => Promise<Response>;
let getPersistentDiskAssetMetadata: typeof import("../../lib/storage/persistent-disk-storage").getPersistentDiskAssetMetadata;
let storeTenantDiskImage: typeof import("../../lib/storage/tenant-image-storage.server").storeTenantDiskImage;
let root: string;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "runflare-media-route-"));
  process.env.MEDIA_STORAGE_ROOT = root;
  process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
  ({ GET } = await import("../../app/api/media/[organizationId]/[...key]/route"));
  ({ getPersistentDiskAssetMetadata } = await import("../../lib/storage/persistent-disk-storage"));
  ({ storeTenantDiskImage } = await import("../../lib/storage/tenant-image-storage.server"));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

async function seed(filename: string, access: "public" | "private" = "public", org = "org-a") {
  return storeTenantDiskImage({ organizationId: org, filename, buffer: png, mimeType: "image/png", access });
}
function get(org: string, key: string[]) {
  return GET(new Request("https://app.example.test"), { params: Promise.resolve({ organizationId: org, key }) });
}

test("public tenant image returns bytes and immutable public cache headers", async () => {
  const saved = await seed("public.png", "public");
  const response = await get("org-a", ["tenants", "org-a", "uploads", "public.png"]);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("cache-control"), "public, max-age=86400, immutable");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-disposition"), "inline");
  assert.equal(response.headers.get("etag"), `"${saved.checksumSha256}"`);
});

test("private tenant asset requires authentication and same-organization admin access", async () => {
  await seed("private.png", "private");
  session = null;
  const anonymous = await get("org-a", ["tenants", "org-a", "uploads", "private.png"]);
  assert.equal(anonymous.status, 401);
  assert.equal(guardCalls.at(-1), "auth");
  session = { user: { id: "admin-a" } };
  const allowed = await get("org-a", ["tenants", "org-a", "uploads", "private.png"]);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("cache-control"), "private, no-store");
  assert.ok(guardCalls.includes("org:org-a:ADMIN,MANAGER"));
});

test("cross-organization private access is denied", async () => {
  await seed("cross.png", "private", "org-b");
  session = { user: { id: "admin-a" } };
  const response = await get("org-b", ["tenants", "org-b", "uploads", "cross.png"]);
  assert.equal(response.status, 403);
  assert.equal(guardCalls.at(-1), "org:org-b:ADMIN,MANAGER");
});

test("receipt namespace stays hidden from merchant route even for authenticated admins", async () => {
  const key = "retail-payment/org-a/receipt.png";
  await (await import("../../lib/storage/persistent-disk-storage")).createPersistentDiskApplicationStorage().store({
    organizationId: "org-a", key, buffer: png, mimeType: "image/png", access: "private", purpose: "receipt", checksumSha256: (await getPersistentDiskAssetMetadata({ organizationId: "org-a", key }))?.checksumSha256 ?? (await import("node:crypto")).createHash("sha256").update(png).digest("hex"), width: null, height: null,
  });
  session = { user: { id: "admin-a" } };
  const response = await get("org-a", ["retail-payment", "org-a", "receipt.png"]);
  assert.equal(response.status, 404);
});

test("traversal, organization-key mismatch, missing asset, and disabled adapter return not found", async () => {
  await seed("safe.png", "public");
  assert.equal((await get("org-a", ["tenants", "org-b", "uploads", "safe.png"])).status, 404);
  assert.equal((await get("org-a", ["tenants", "org-a", "uploads", "..", "safe.png"])).status, 404);
  assert.equal((await get("org-a", ["tenants", "org-a"])).status, 404);
  assert.equal((await get("org-a", ["tenants", "org-a", "uploads", "missing.png"])).status, 404);
  process.env.APPLICATION_STORAGE_ADAPTER = "vercel-blob";
  assert.equal((await get("org-a", ["tenants", "org-a", "uploads", "safe.png"])).status, 404);
  process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
});

test("corrupt bytes fail closed with 500 and no response body", async () => {
  await seed("corrupt.png", "public");
  const file = path.join(root, "tenants", "org-a", "uploads", "corrupt.png");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from("tampered"));
  const response = await get("org-a", ["tenants", "org-a", "uploads", "corrupt.png"]);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Internal server error" });
});
