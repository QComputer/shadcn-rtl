import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, mock, test } from "node:test";

const blobCalls: Array<{ operation: string; key: string; access?: string }> = [];
const receiptPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const environmentKeys = ["MEDIA_STORAGE_ROOT", "APPLICATION_STORAGE_ADAPTER", "RETAIL_RECEIPT_TEST_STORAGE", "RETAIL_RECEIPT_LOCAL_ROOT", "CI", "VERCEL", "BLOB_READ_WRITE_TOKEN"] as const;
const originalEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));

class TestApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown) => new Response(JSON.stringify({ error: error instanceof TestApiError ? error.message : "Internal server error" }), { status: error instanceof TestApiError ? error.status : 500 }),
  requireAuthSession: async () => { throw new TestApiError(401, "Unauthorized"); },
  requireOrgAccess: async () => { throw new TestApiError(403, "Forbidden"); },
  requireRole: () => { throw new TestApiError(403, "Forbidden"); },
} });
mock.module("@/lib/db", { namedExports: { prisma: {} , default: {} } });

mock.module("@/lib/storage/vercel-blob-storage", { namedExports: {
  uploadVercelBlobObject: async (input: { key: string; access: string }) => {
    blobCalls.push({ operation: "put", key: input.key, access: input.access });
    return { url: `https://blob.example.invalid/${input.key}`, access: input.access };
  },
  getVercelBlobObject: async (key: string) => {
    blobCalls.push({ operation: "get", key });
    return { stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(receiptPng)); controller.close(); } }) };
  },
  deleteVercelBlobObject: async (key: string) => { blobCalls.push({ operation: "del", key }); },
} });

let temporaryRoot = "";
let storeRetailReceipt: typeof import("@/lib/retail/receipt-storage.server").storeRetailReceipt;
let readRetailReceipt: typeof import("@/lib/retail/receipt-storage.server").readRetailReceipt;
let removeRetailReceipt: typeof import("@/lib/retail/receipt-storage.server").removeRetailReceipt;
let readPersistentDiskAsset: typeof import("@/lib/storage/persistent-disk-storage").readPersistentDiskAsset;
let getMedia: typeof import("@/app/api/media/[organizationId]/[...key]/route").GET;

before(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "runflare-receipt-storage-"));
  process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
  process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
  process.env.RETAIL_RECEIPT_TEST_STORAGE = "0";
  process.env.RETAIL_RECEIPT_LOCAL_ROOT = "";
  process.env.CI = "false";
  delete process.env.VERCEL;
  process.env.BLOB_READ_WRITE_TOKEN = "unit-test-token";

  ({ storeRetailReceipt, readRetailReceipt, removeRetailReceipt } = await import("@/lib/retail/receipt-storage.server"));
  ({ readPersistentDiskAsset } = await import("@/lib/storage/persistent-disk-storage"));
  ({ GET: getMedia } = await import("@/app/api/media/[organizationId]/[...key]/route"));
});

after(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
  for (const [key, value] of originalEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("Runflare receipts stay tenant-scoped and private on disk and use private-only Blob calls", async () => {
  const tenantA = "org_receipt_a";
  const tenantB = "org_receipt_b";
  const key = await storeRetailReceipt(receiptPng, "image/png", tenantA);
  assert.match(key, /^retail-payment\/[0-9a-f-]{36}\.png$/);
  assert.ok(!key.startsWith("https://"), "the receipt reference must not expose a public URL");

  const diskKey = `retail-payment/${tenantA}/${key.slice("retail-payment/".length)}`;
  const asset = await readPersistentDiskAsset({ organizationId: tenantA, key: diskKey });
  assert.ok(asset);
  assert.equal(asset.metadata.access, "private");
  assert.equal(asset.metadata.organizationId, tenantA);
  assert.deepEqual(asset.buffer, receiptPng);
  assert.deepEqual(blobCalls, [], "persistent-disk receipt writes and reads must not contact Blob");

  assert.deepEqual(await readRetailReceipt(key, tenantA), { buffer: receiptPng, contentType: "image/png" });
  await assert.rejects(readRetailReceipt(key, tenantB), (error: unknown) => Boolean(error && typeof error === "object" && "status" in error && error.status === 404));
  await removeRetailReceipt(key, tenantB);
  assert.ok(await readPersistentDiskAsset({ organizationId: tenantA, key: diskKey }), "a cross-tenant remove must preserve the owner’s receipt");

  const directPublic = await getMedia(new Request("https://app.example.test"), {
    params: Promise.resolve({ organizationId: tenantA, key: ["retail-payment", tenantA, key.slice("retail-payment/".length)] }),
  });
  assert.equal(directPublic.status, 404, "receipt content must remain behind the audited merchant route");

  await removeRetailReceipt(key, tenantA);
  await assert.rejects(readRetailReceipt(key, tenantA), (error: unknown) => Boolean(error && typeof error === "object" && "status" in error && error.status === 404));

  process.env.APPLICATION_STORAGE_ADAPTER = "vercel-blob";
  const blobKey = await storeRetailReceipt(receiptPng, "image/png", tenantB);
  assert.match(blobKey, /^retail-payment\/[0-9a-f-]{36}\.png$/);
  assert.equal(blobCalls.at(-1)?.operation, "put");
  assert.equal(blobCalls.at(-1)?.access, "private", "receipt uploads must request private Blob access");
  assert.deepEqual(await readRetailReceipt(blobKey, tenantB), { buffer: receiptPng, contentType: "image/png" });
  assert.equal(blobCalls.at(-1)?.operation, "get");
  await removeRetailReceipt(blobKey, tenantB);
  assert.equal(blobCalls.at(-1)?.operation, "del");
});
