import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/api-guards";
import { validateImageBuffer } from "@/lib/media-storage";
import { deleteVercelBlobObject, getVercelBlobObject, uploadVercelBlobObject } from "@/lib/storage/vercel-blob-storage";

const mimeExtensions = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const keyPattern = /^retail-payment\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/;
const testRoot = process.env.RETAIL_RECEIPT_TEST_STORAGE === "1" && process.env.CI === "true" && !process.env.VERCEL
  ? process.env.RETAIL_RECEIPT_LOCAL_ROOT : undefined;

function localPath(key: string) {
  if (!testRoot || !path.isAbsolute(testRoot)) throw new ApiError(503, "Private receipt storage is unavailable.");
  return path.join(testRoot, key);
}

export async function storeRetailReceipt(buffer: Buffer, mimeType: string) {
  const extension = mimeExtensions.get(mimeType);
  if (!extension) throw new ApiError(415, "Only JPEG, PNG or WebP receipts are accepted.");
  validateImageBuffer(buffer, mimeType, buffer.length);
  const key = `retail-payment/${randomUUID()}.${extension}`;
  if (testRoot) {
    const destination = localPath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: "wx", mode: 0o600 });
  } else {
    // Direct private upload deliberately avoids uploadToBlob's public fallback.
    const stored = await uploadVercelBlobObject({ key, buffer, contentType: mimeType, access: "private" });
    if (stored.access !== "private") throw new ApiError(503, "Private receipt storage is unavailable.");
  }
  return key;
}

export async function readRetailReceipt(key: string) {
  if (!keyPattern.test(key)) throw new ApiError(404, "Receipt not found.");
  const extension = key.slice(key.lastIndexOf(".") + 1);
  const contentType = extension === "jpg" ? "image/jpeg" : extension === "png" ? "image/png" : "image/webp";
  if (testRoot) return { buffer: await readFile(localPath(key)), contentType };
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

export async function removeRetailReceipt(key: string) {
  if (!keyPattern.test(key)) return;
  if (testRoot) { await unlink(localPath(key)); return; }
  await deleteVercelBlobObject(key);
}
