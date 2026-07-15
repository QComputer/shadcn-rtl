import "server-only";

import { del, get, put } from "@vercel/blob";
import type { ApplicationStorageAdapter, StoredApplicationAsset, StoreApplicationAssetInput } from "@/lib/storage/types";

function hasBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function createVercelBlobApplicationStorage(): ApplicationStorageAdapter {
  return {
    provider: "vercel-blob",
    async store(input: StoreApplicationAssetInput & { key: string; checksumSha256: string; width: number | null; height: number | null }): Promise<StoredApplicationAsset> {
      if (!hasBlobToken()) {
        throw new Error("Application storage is not configured");
      }

      const blob = await put(input.key, input.buffer, {
        access: input.access ?? "public",
        contentType: input.mimeType,
      });

      return {
        provider: "vercel-blob",
        organizationId: input.organizationId,
        key: input.key,
        url: blob.url,
        access: input.access ?? "public",
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        checksumSha256: input.checksumSha256,
        width: input.width,
        height: input.height,
      };
    },
    async remove(input) {
      if (!hasBlobToken()) {
        throw new Error("Application storage is not configured");
      }
      await del(input.key);
    },
  };
}

export async function uploadVercelBlobObject(input: {
  key: string;
  buffer: Buffer;
  contentType: string;
  access: "public" | "private";
}) {
  if (!hasBlobToken()) {
    throw new Error("Application storage is not configured");
  }
  const blob = await put(input.key, input.buffer, {
    contentType: input.contentType,
    access: input.access,
  });
  return { url: blob.url, access: input.access };
}

export async function deleteVercelBlobObject(key: string) {
  if (!hasBlobToken()) {
    throw new Error("Application storage is not configured");
  }
  await del(key, {});
}

export async function getVercelBlobObject(key: string) {
  if (!hasBlobToken()) {
    throw new Error("Application storage is not configured");
  }
  return get(key, { access: "private" });
}
