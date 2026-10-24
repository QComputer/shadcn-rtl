import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  createPersistentDiskApplicationStorage,
  getPersistentDiskAssetMetadata,
  readPersistentDiskAsset,
} from "@/lib/storage/persistent-disk-storage";

const ORIGINAL_ROOT = process.env.MEDIA_STORAGE_ROOT;
let temporaryRoot = "";
let storage: ReturnType<typeof createPersistentDiskApplicationStorage>;

function createInput(overrides: Partial<Parameters<typeof storage.store>[0]> = {}) {
  const buffer = Buffer.alloc(25);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(1, 16);
  buffer.writeUInt32BE(1, 20);
  return {
    organizationId: "org_alpha",
    key: "creative-studio/org_alpha/profile/asset.png",
    buffer,
    mimeType: "image/png",
    purpose: "profile",
    access: "public" as const,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    width: 12,
    height: 9,
    ...overrides,
  };
}

beforeEach(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "application-storage-"));
  process.env.MEDIA_STORAGE_ROOT = temporaryRoot;
  storage = createPersistentDiskApplicationStorage();
});

afterEach(async () => {
  if (ORIGINAL_ROOT === undefined) delete process.env.MEDIA_STORAGE_ROOT;
  else process.env.MEDIA_STORAGE_ROOT = ORIGINAL_ROOT;
  await fs.rm(temporaryRoot, { recursive: true, force: true });
});

describe("persistent disk application storage", () => {
  it("stores bytes and tenant metadata atomically with a stable API URL", async () => {
    const input = createInput();
    const stored = await storage.store(input);

    assert.equal(stored.provider, "persistent-disk");
    assert.equal(stored.organizationId, input.organizationId);
    assert.equal(stored.url, "/api/media/org_alpha/creative-studio/org_alpha/profile/asset.png");
    assert.equal(stored.sizeBytes, input.buffer.length);
    assert.equal(stored.checksumSha256, input.checksumSha256);
    assert.equal(await storage.verify({ organizationId: "org_alpha", key: input.key }), true);

    const asset = await readPersistentDiskAsset({ organizationId: "org_alpha", key: input.key });
    assert.deepEqual(asset?.buffer, input.buffer);
    assert.equal(asset?.metadata.access, "public");
    assert.equal(asset?.metadata.mimeType, "image/png");
    assert.equal((await fs.readdir(path.join(temporaryRoot, "creative-studio", "org_alpha", "profile"))).some((name) => name.startsWith(".tmp-")), false);
  });

  it("returns the same routed URL for private assets and retains private metadata", async () => {
    const input = createInput({ access: "private", key: "creative-studio/org_alpha/private/secret.png" });
    const stored = await storage.store(input);

    assert.equal(stored.url, "/api/media/org_alpha/creative-studio/org_alpha/private/secret.png");
    assert.equal((await getPersistentDiskAssetMetadata({ organizationId: "org_alpha", key: input.key }))?.access, "private");
    const stream = await storage.streamContent({ organizationId: "org_alpha", key: input.key, mimeType: "image/png" });
    assert.ok(stream);
    const reader = stream.getReader();
    const first = await reader.read();
    assert.equal(Buffer.from(first.value!).toString(), input.buffer.toString());
    assert.equal((await reader.read()).done, true);
  });

  it("rejects traversal, encoded traversal, absolute paths, and backslashes", async () => {
    for (const key of [
      "creative-studio/org_alpha/profile/../escape.png",
      "creative-studio/org_alpha/profile/%2e%2e/escape.png",
      "/creative-studio/org_alpha/profile/asset.png",
      "creative-studio\\org_alpha\\profile\\asset.png",
    ]) {
      await assert.rejects(storage.store(createInput({ key })));
    }
  });

  it("rejects cross-organization read, verify, and remove", async () => {
    const input = createInput();
    await storage.store(input);

    await assert.rejects(readPersistentDiskAsset({ organizationId: "org_beta", key: input.key }), /does not belong/);
    await assert.rejects(storage.verify({ organizationId: "org_beta", key: input.key }), /does not belong/);
    await assert.rejects(storage.remove({ organizationId: "org_beta", key: input.key }), /does not belong/);
    assert.ok(await readPersistentDiskAsset({ organizationId: "org_alpha", key: input.key }));
  });

  it("treats an absent tenant directory as a missing asset and removes idempotently", async () => {
    const key = "creative-studio/org_missing/profile/asset.png";
    assert.equal(await getPersistentDiskAssetMetadata({ organizationId: "org_missing", key }), null);
    assert.equal(await readPersistentDiskAsset({ organizationId: "org_missing", key }), null);
    assert.equal(await storage.verify({ organizationId: "org_missing", key }), false);
    await storage.remove({ organizationId: "org_missing", key });
  });

  it("rejects symlinked tenant paths and does not write outside the configured root", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "application-storage-outside-"));
    try {
      await fs.mkdir(path.join(temporaryRoot, "creative-studio", "org_alpha"), { recursive: true });
      const link = path.join(temporaryRoot, "creative-studio", "org_alpha", "profile");
      try {
        await fs.symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
      } catch (error) {
        if (["EPERM", "EACCES", "ENOTSUP"].includes((error as NodeJS.ErrnoException).code || "")) {
          return;
        }
        throw error;
      }
      await assert.rejects(storage.store(createInput()));
      assert.deepEqual(await fs.readdir(outside), []);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("checks the supplied checksum and leaves no partial object", async () => {
    const input = createInput({ checksumSha256: "0".repeat(64) });
    await assert.rejects(storage.store(input), /checksum does not match/);
    assert.equal(await storage.verify({ organizationId: input.organizationId, key: input.key }), false);
  });

  it("detects tampering before returning content and removes only the tenant-owned pair", async () => {
    const input = createInput();
    await storage.store(input);
    const filePath = path.join(temporaryRoot, ...input.key.split("/"));
    await fs.writeFile(filePath, "tampered");
    await assert.rejects(readPersistentDiskAsset({ organizationId: input.organizationId, key: input.key }), /size does not match|checksum does not match/);

    await storage.remove({ organizationId: input.organizationId, key: input.key });
    assert.equal(await getPersistentDiskAssetMetadata({ organizationId: input.organizationId, key: input.key }), null);
    assert.equal(await storage.verify({ organizationId: input.organizationId, key: input.key }), false);
  });

  it("rejects a symlinked asset file when reading", async () => {
    const input = createInput();
    await storage.store(input);
    const outside = path.join(os.tmpdir(), `application-storage-file-${Date.now()}`);
    await fs.writeFile(outside, input.buffer);
    const filePath = path.join(temporaryRoot, ...input.key.split("/"));
    await fs.unlink(filePath);
    try {
      await fs.symlink(outside, filePath, "file");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes((error as NodeJS.ErrnoException).code || "")) {
        await fs.rm(outside, { force: true });
        return;
      }
      throw error;
    }
    try {
      await assert.rejects(readPersistentDiskAsset({ organizationId: input.organizationId, key: input.key }));
    } finally {
      await fs.rm(outside, { force: true });
    }
  });

  it("accepts an identical retry without overwriting the stored asset", async () => {
    const input = createInput();
    const original = await storage.store(input);
    const retried = await storage.store(input);

    assert.deepEqual(retried, original);
    assert.deepEqual((await readPersistentDiskAsset({ organizationId: input.organizationId, key: input.key }))?.buffer, input.buffer);
  });

  it("refuses to overwrite an existing object and preserves its bytes", async () => {
    const input = createInput();
    await storage.store(input);
    const replacementBuffer = createInput().buffer;
    replacementBuffer[24] = 1;
    const replacement = createInput({ buffer: replacementBuffer });
    replacement.checksumSha256 = createHash("sha256").update(replacement.buffer).digest("hex");
    await assert.rejects(storage.store(replacement));
    const record = await readPersistentDiskAsset({ organizationId: input.organizationId, key: input.key });
    assert.deepEqual(record?.buffer, input.buffer);
  });
});
