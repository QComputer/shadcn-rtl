import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api-guards";
import { validateImageBuffer } from "@/lib/media-storage";
import { createPersistentDiskApplicationStorage, readPersistentDiskAsset } from "@/lib/storage/persistent-disk-storage";

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
