import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/api-guards";
import { validateImageBuffer } from "@/lib/media-storage";
import { createPersistentDiskApplicationStorage, getPersistentDiskAssetMetadata, readPersistentDiskAsset } from "@/lib/storage/persistent-disk-storage";

const extensions = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const MAX_BYTES = 5 * 1024 * 1024;

function reference(organizationId: string, key: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(organizationId) || !/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(key)) {
    throw new ApiError(404, "Receipt not found");
  }
  return { organizationId, key: `hotel-payment/${organizationId}/${key}` };
}

/** The caller must authorize the tenant and reservation before invoking storage. */
export async function storeHotelPaymentReceipt(organizationId: string, buffer: Buffer, mimeType: string) {
  const extension = extensions.get(mimeType);
  if (!extension) throw new ApiError(415, "Unsupported receipt image type");
  if (!buffer.length || buffer.length > MAX_BYTES) throw new ApiError(413, "Receipt exceeds the allowed size");
  validateImageBuffer(buffer, mimeType, buffer.length);
  const key = `${randomUUID()}.${extension}`;
  const stored = await createPersistentDiskApplicationStorage().store({
    ...reference(organizationId, key), buffer, mimeType, access: "private", purpose: "hotel-payment",
    checksumSha256: createHash("sha256").update(buffer).digest("hex"), width: null, height: null,
  });
  if (stored.access !== "private") throw new ApiError(503, "Private receipt storage is unavailable");
  return key;
}

/** Never expose this key without checking the requesting actor's reservation access. */
export async function readHotelPaymentReceipt(organizationId: string, key: string) {
  const asset = await readPersistentDiskAsset(reference(organizationId, key));
  if (!asset || asset.metadata.access !== "private") throw new ApiError(404, "Receipt not found");
  if (asset.buffer.length > MAX_BYTES) throw new ApiError(413, "Receipt exceeds the allowed size");
  return { buffer: asset.buffer, contentType: asset.metadata.mimeType };
}

/** Used to remove a newly stored object if attaching it to the ledger fails. */
export async function removeHotelPaymentReceipt(organizationId: string, key: string) {
  await createPersistentDiskApplicationStorage().remove(reference(organizationId, key));
}

/** Shared transaction lock for attaching and reconciling a receipt object. */
export function hotelPaymentReceiptLockId(organizationId: string, key: string) {
  return createHash("sha256").update(`${organizationId}\0${key}`).digest().readBigInt64BE(0);
}

/** Checks the private object without reading its image bytes. */
export async function hasPrivateHotelPaymentReceipt(organizationId: string, key: string) {
  const asset = await getPersistentDiskAssetMetadata(reference(organizationId, key));
  return asset?.access === "private";
}

/** Enumerates only aged, correctly-namespaced private receipt objects for one tenant. */
export async function listStaleHotelPaymentReceipts(input: { organizationId: string; olderThan: Date; limit: number }) {
  if (!/^[A-Za-z0-9_-]+$/.test(input.organizationId) || !Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100
    || !Number.isFinite(input.olderThan.getTime())) throw new ApiError(400, "Invalid receipt reconciliation scope");
  const configuredRoot = process.env.MEDIA_STORAGE_ROOT?.trim();
  if (!configuredRoot || !path.isAbsolute(configuredRoot)) throw new ApiError(503, "Private receipt storage is unavailable");
  const root = path.resolve(configuredRoot);
  const rootStat = await lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new ApiError(503, "Private receipt storage is unavailable");
  const canonicalRoot = await realpath(root);
  const base = path.join(canonicalRoot, "hotel-payment");
  const tenantDirectory = path.join(base, input.organizationId);
  for (const directory of [base, tenantDirectory]) {
    let stat;
    try { stat = await lstat(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    if (stat.isSymbolicLink() || !stat.isDirectory() || !path.resolve(await realpath(directory)).startsWith(`${canonicalRoot}${path.sep}`)) {
      throw new ApiError(503, "Private receipt storage namespace is unsafe");
    }
  }
  const candidates: Array<{ key: string; modifiedAt: Date }> = [];
  const directoryHandle = await opendir(tenantDirectory);
  let scanned = 0;
  for await (const entry of directoryHandle) {
    if (scanned >= 1000 || candidates.length >= input.limit) break;
    scanned += 1;
    if (!entry.isFile() || !/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(entry.name)) continue;
    const metadata = await getPersistentDiskAssetMetadata({ organizationId: input.organizationId, key: `hotel-payment/${input.organizationId}/${entry.name}` });
    if (!metadata || metadata.access !== "private") continue;
    const stat = await lstat(path.join(tenantDirectory, entry.name));
    if (stat.isSymbolicLink() || !stat.isFile() || stat.mtime > input.olderThan) continue;
    candidates.push({ key: entry.name, modifiedAt: stat.mtime });
  }
  return candidates.sort((left, right) => left.modifiedAt.getTime() - right.modifiedAt.getTime()).slice(0, input.limit).map(({ key }) => key);
}
