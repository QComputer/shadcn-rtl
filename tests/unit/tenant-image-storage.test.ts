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

test("production media operations succeed without any Vercel token configured", async () => {
  const { storeTenantDiskImage, readTenantDiskImage, removeTenantDiskImage, usesPersistentMedia } = await import("../../lib/storage/tenant-image-storage.server");
  // Ensure no Vercel token is configured for this production simulation
  delete process.env.BLOB_READ_WRITE_TOKEN;
  assert.equal(usesPersistentMedia(), true, "persistent-disk adapter selected without token");

  // Upload
  const stored = await storeTenantDiskImage({ organizationId: "org_prod", filename: "production.png", buffer: png, mimeType: "image/png", access: "public" });
  assert.equal(stored.organizationId, "org_prod");
  assert.equal(stored.access, "public");
  assert.equal(stored.key, "tenants/org_prod/uploads/production.png");
  assert.equal(stored.url, "/api/media/org_prod/tenants/org_prod/uploads/production.png");

  // Read back
  const read = await readTenantDiskImage("org_prod", "production.png");
  assert.ok(read, "stored asset is readable");
  assert.deepEqual(read.buffer, png);
  assert.equal(read.metadata.access, "public");

  // Private upload and read
  await storeTenantDiskImage({ organizationId: "org_prod", filename: "private.png", buffer: png, mimeType: "image/png", access: "private" });
  const privateRead = await readTenantDiskImage("org_prod", "private.png");
  assert.equal(privateRead?.metadata.access, "private");

  // Cross-tenant read of private file returns null
  const crossRead = await readTenantDiskImage("org_other", "private.png");
  assert.equal(crossRead, null);

  // Delete
  await removeTenantDiskImage("org_prod", "production.png");
  assert.equal(await readTenantDiskImage("org_prod", "production.png"), null);

  // Idempotent delete
  await removeTenantDiskImage("org_prod", "production.png");
  assert.equal(await readTenantDiskImage("org_prod", "production.png"), null);

  // Blob calls must be zero throughout
  assert.equal(blobCalls, 0, "no Blob calls made during production media operations");
});
