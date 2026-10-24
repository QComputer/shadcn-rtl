import "server-only";
import { createHash } from "node:crypto";
import { createPersistentDiskApplicationStorage, readPersistentDiskAsset } from "./persistent-disk-storage";

export const PLATFORM_MEDIA_NAMESPACE = "__platform__";

export function usesPersistentMedia() {
  const adapter = process.env.APPLICATION_STORAGE_ADAPTER || "vercel-blob";
  if (!["persistent-disk", "vercel-blob"].includes(adapter)) throw new Error("Unsupported image storage adapter");
  return adapter === "persistent-disk";
}

export function tenantImageStorageKey(organizationId: string | null | undefined, filename: string) {
  const owner = organizationId || PLATFORM_MEDIA_NAMESPACE;
  if (!/^[A-Za-z0-9_-]+$/.test(owner) || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(filename) || filename.includes("..")) {
    throw new Error("Invalid tenant image storage key");
  }
  return { organizationId: owner, key: `tenants/${owner}/uploads/${filename}` };
}

export async function storeTenantDiskImage(input: { organizationId?: string | null; filename: string; buffer: Buffer; mimeType: string; access: "public" | "private" }) {
  const reference = tenantImageStorageKey(input.organizationId, input.filename);
  return createPersistentDiskApplicationStorage().store({
    ...reference, buffer: input.buffer, mimeType: input.mimeType, access: input.access,
    purpose: "upload", checksumSha256: createHash("sha256").update(input.buffer).digest("hex"), width: null, height: null,
  });
}

export async function readTenantDiskImage(organizationId: string | null, filename: string) {
  return readPersistentDiskAsset(tenantImageStorageKey(organizationId, filename));
}

export async function removeTenantDiskImage(organizationId: string | null | undefined, filename: string) {
  return createPersistentDiskApplicationStorage().remove(tenantImageStorageKey(organizationId, filename));
}
