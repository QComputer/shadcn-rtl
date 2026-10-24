import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, mock, test } from "node:test";

let blobCalls = 0;
class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }
mock.module("@/lib/api-guards", { namedExports: { ApiError: TestApiError } });
mock.module("@/lib/blob-storage", { namedExports: {
  uploadToBlob: async () => { blobCalls += 1; throw new Error("Blob upload must not run in persistent-disk mode"); },
  deleteFromBlob: async () => { blobCalls += 1; throw new Error("Blob deletion must not run in persistent-disk mode"); },
} });

let writeStoredImage: typeof import("../../lib/media-storage").writeStoredImage;
let deleteStoredImage: typeof import("../../lib/media-storage").deleteStoredImage;
let readTenantDiskImage: typeof import("../../lib/storage/tenant-image-storage.server").readTenantDiskImage;
let root: string;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "tenant-image-storage-"));
  process.env.MEDIA_STORAGE_ROOT = root;
  process.env.APPLICATION_STORAGE_ADAPTER = "persistent-disk";
  ({ writeStoredImage, deleteStoredImage } = await import("../../lib/media-storage"));
  ({ readTenantDiskImage } = await import("../../lib/storage/tenant-image-storage.server"));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

test("persistent-disk image writes retain tenant namespace and legacy uploads alias reads same bytes", async () => {
  const stored = await writeStoredImage("logo.png", png, "PUBLIC", "org-a");
  assert.equal(stored.pathname, "logo.png");
  assert.equal(stored.url, "/api/media/org-a/tenants/org-a/uploads/logo.png");
  const aliasRead = await readTenantDiskImage("org-a", "logo.png");
  assert.deepEqual(aliasRead?.buffer, png);
  assert.equal(aliasRead?.metadata.organizationId, "org-a");
  assert.equal(aliasRead?.metadata.access, "public");
  assert.equal(aliasRead?.metadata.key, "tenants/org-a/uploads/logo.png");
});

test("private images stay private, cross-tenant reads cannot reach them, and deletion is tenant-scoped/idempotent", async () => {
  await writeStoredImage("private.png", png, "PRIVATE", "org-a");
  const crossTenant = await readTenantDiskImage("org-b", "private.png");
  assert.equal(crossTenant, null);
  assert.equal((await readTenantDiskImage("org-a", "private.png"))?.metadata.access, "private");
  await deleteStoredImage("private.png", "org-b");
  assert.ok(await readTenantDiskImage("org-a", "private.png"));
  await deleteStoredImage("private.png", "org-a");
  await deleteStoredImage("private.png", "org-a");
  assert.equal(await readTenantDiskImage("org-a", "private.png"), null);
});

test("platform images use the isolated platform namespace and disk mode never calls Blob", async () => {
  const stored = await writeStoredImage("platform.png", png, "PUBLIC");
  assert.equal(stored.url, "/api/media/__platform__/tenants/__platform__/uploads/platform.png");
  const data = await readTenantDiskImage("__platform__", "platform.png");
  assert.deepEqual(data?.buffer, png);
  assert.equal(blobCalls, 0);
});
