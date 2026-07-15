import "server-only";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError } from "@/lib/api-guards";
import { extensionForApplicationImage, validateApplicationImageBuffer } from "@/lib/storage/image-validation";
import type { ApplicationStorageAdapter, StoredApplicationAsset, StoreApplicationAssetInput } from "@/lib/storage/types";

const PRIVATE_IPV4_PATTERNS = [/^10\./, /^127\./, /^0\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[0-1])\./];

function normalizePurpose(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "asset";
}

function normalizeOrganizationId(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new ApiError(400, "Invalid organization storage namespace");
  }
  return normalized;
}

function createApplicationStorageKey(input: StoreApplicationAssetInput) {
  const organizationId = normalizeOrganizationId(input.organizationId);
  const extension = extensionForApplicationImage(input.mimeType);
  return path.posix.join(
    "creative-studio",
    organizationId,
    normalizePurpose(input.purpose),
    `${Date.now()}-${randomUUID()}.${extension}`,
  );
}

function selectedAdapterName() {
  return process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER || process.env.APPLICATION_STORAGE_ADAPTER || "vercel-blob";
}

export async function getApplicationStorageAdapter(): Promise<ApplicationStorageAdapter> {
  const adapter = selectedAdapterName();
  if (adapter === "local-test") {
    const { createLocalTestApplicationStorage } = await import("@/lib/storage/local-test-storage");
    return createLocalTestApplicationStorage();
  }
  if (adapter === "vercel-blob") {
    const { createVercelBlobApplicationStorage } = await import("@/lib/storage/vercel-blob-storage");
    return createVercelBlobApplicationStorage();
  }
  throw new Error("Unsupported application storage adapter");
}

export async function storeCreativeStudioAsset(input: StoreApplicationAssetInput): Promise<StoredApplicationAsset> {
  const validated = validateApplicationImageBuffer(input.buffer, input.mimeType);
  const key = createApplicationStorageKey(input);
  const adapter = await getApplicationStorageAdapter();
  return adapter.store({
    ...input,
    key,
    checksumSha256: validated.checksumSha256,
    width: validated.width,
    height: validated.height,
  });
}

export async function removeCreativeStudioAsset(input: { organizationId: string; key: string }) {
  const adapter = await getApplicationStorageAdapter();
  return adapter.remove(input);
}

export async function verifyStoredAsset(input: { organizationId: string; key: string }) {
  const adapter = await getApplicationStorageAdapter();
  return adapter.verify ? adapter.verify(input) : true;
}

function isPrivateOutputHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost"
    || normalized === "::1"
    || normalized === "[::1]"
    || normalized.endsWith(".localhost")
    || normalized.endsWith(".local")
    || PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(normalized));
}

function assertFetchableResultUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(400, "Provider result URL is invalid");
  }

  const localTestAdapter = selectedAdapterName() === "local-test";
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(localTestAdapter && parsed.protocol === "http:" && isLocalhost)) {
    throw new ApiError(400, "Provider result URL must use HTTPS");
  }
  if (!localTestAdapter && (parsed.username || parsed.password || isPrivateOutputHost(parsed.hostname))) {
    throw new ApiError(400, "Provider result URL is not allowed");
  }
  return parsed;
}

function normalizeContentType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

export async function storeCreativeStudioAssetFromRemote(input: {
  organizationId: string;
  resultUrl: string;
  purpose: string;
  access?: "public" | "private";
}): Promise<StoredApplicationAsset> {
  const parsed = assertFetchableResultUrl(input.resultUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(parsed, {
      redirect: "error",
      signal: controller.signal,
      headers: { "User-Agent": "BazarBaz-ApplicationStorage/1.0" },
    });
    if (!response.ok) {
      throw new ApiError(502, "Provider result fetch failed");
    }
    const contentType = normalizeContentType(response.headers.get("content-type") || "");
    const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
    if (Number.isFinite(contentLength) && contentLength > 5 * 1024 * 1024) {
      throw new ApiError(413, "Provider result image is too large");
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return storeCreativeStudioAsset({
      organizationId: input.organizationId,
      buffer,
      mimeType: contentType,
      purpose: input.purpose,
      access: input.access ?? "public",
      sourceUrl: input.resultUrl,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(504, "Provider result fetch timed out");
    }
    throw new ApiError(502, "Provider result fetch failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function compensateFailedAssetImport(input: { organizationId: string; key: string }) {
  try {
    await removeCreativeStudioAsset(input);
    return { compensated: true, orphaned: false };
  } catch {
    return { compensated: false, orphaned: true };
  }
}
