import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/api-guards";
import { validateImageBuffer } from "@/lib/media-storage";
import { createPersistentDiskApplicationStorage, readPersistentDiskAsset } from "@/lib/storage/persistent-disk-storage";
import { usesPersistentMedia } from "@/lib/storage/tenant-image-storage.server";

const mimeExtensions = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const keyPattern = /^retail-payment\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;
const testRoot = process.env.RETAIL_RECEIPT_TEST_STORAGE === "1" && process.env.CI === "true" && !process.env.VERCEL
  ? process.env.RETAIL_RECEIPT_LOCAL_ROOT : undefined;

function localPath(key: string) {
  if (!testRoot || !path.isAbsolute(testRoot)) throw new ApiError(503, "Private receipt storage is unavailable.");
  return path.join(testRoot, key);
}

function diskReference(key: string, organizationId?: string) {
  if (!organizationId || !/^[A-Za-z0-9_-]+$/.test(organizationId) || !keyPattern.test(key)) throw new ApiError(404, "Receipt not found.");
  return { organizationId, key: `retail-payment/${organizationId}/${key.slice("retail-payment/".length)}` };
}

export async function storeRetailReceipt(buffer: Buffer, mimeType: string, organizationId?: string) {
  const extension = mimeExtensions.get(mimeType);
  if (!extension) throw new ApiError(415, "Only JPEG, PNG or WebP receipts are accepted.");
  validateImageBuffer(buffer, mimeType, buffer.length);
  const key = `retail-payment/${randomUUID()}.${extension}`;
  if (testRoot) {
    const destination = localPath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: "wx", mode: 0o600 });
  } else if (usesPersistentMedia()) {
    await createPersistentDiskApplicationStorage().store({ ...diskReference(key, organizationId), buffer, mimeType,
      access: "private", purpose: "retail-payment", checksumSha256: createHash("sha256").update(buffer).digest("hex"), width: null, height: null });
  } else {
    const { uploadVercelBlobObject } = await import("@/lib/storage/vercel-blob-storage");
    const stored = await uploadVercelBlobObject({ key, buffer, contentType: mimeType, access: "private" });
    if (stored.access !== "private") throw new ApiError(503, "Private receipt storage is unavailable.");
  }
  return key;
}

export async function readRetailReceipt(key: string, organizationId?: string) {
  if (!keyPattern.test(key)) throw new ApiError(404, "Receipt not found.");
  const extension = key.slice(key.lastIndexOf(".") + 1);
  const contentType = extension === "jpg" ? "image/jpeg" : extension === "png" ? "image/png" : "image/webp";
  if (testRoot) return { buffer: await readFile(localPath(key)), contentType };
  if (usesPersistentMedia()) {
    const asset = await readPersistentDiskAsset(diskReference(key, organizationId));
    if (!asset || asset.metadata.access !== "private") throw new ApiError(404, "Receipt not found.");
    return { buffer: asset.buffer, contentType: asset.metadata.mimeType };
  } else {
    const { getVercelBlobObject } = await import("@/lib/storage/vercel-blob-storage");
    const blob = await getVercelBlobObject(key);
    if (!blob) throw new ApiError(404, "Receipt not found.");
    const chunks: Buffer[] = [];
    const reader = blob.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
      if (chunks.reduce((size, chunk) => size + chunk.length, 0) > 5 * 1024 * 1024) throw new ApiError(413, "Receipt exceeds the allowed size.");
    }
    return { buffer: Buffer.concat(chunks), contentType };
  }
}

export async function removeRetailReceipt(key: string, organizationId?: string) {
  if (!keyPattern.test(key)) return;
  if (testRoot) { await unlink(localPath(key)); return; }
  if (usesPersistentMedia()) { await createPersistentDiskApplicationStorage().remove(diskReference(key, organizationId)); return; }
  const { deleteVercelBlobObject } = await import("@/lib/storage/vercel-blob-storage");
  await deleteVercelBlobObject(key);
}
