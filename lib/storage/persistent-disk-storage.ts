import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { APPLICATION_STORAGE_MAX_IMAGE_BYTES, validateApplicationImageBuffer } from "@/lib/storage/image-validation";
import type { ApplicationStorageAdapter, StoredApplicationAsset, StoreApplicationAssetInput } from "@/lib/storage/types";

type PersistentDiskAssetMetadata = {
  provider: "persistent-disk";
  organizationId: string;
  key: string;
  access: "public" | "private";
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  width: number | null;
  height: number | null;
};

const KEY_PREFIXES = new Set(["creative-studio", "tenants", "retail-payment"]);
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function normalizeOrganizationId(value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    throw new Error("Invalid organization storage namespace");
  }
  return normalized;
}

function getConfiguredRoot() {
  const configured = process.env.MEDIA_STORAGE_ROOT?.trim();
  if (!configured || !path.isAbsolute(configured)) {
    throw new Error("Persistent disk storage is not configured");
  }
  return path.resolve(configured);
}

function validateKey(organizationId: string, key: string) {
  if (!key || key.includes("\\") || key.includes("\0") || key.includes("%") || path.posix.isAbsolute(key)) {
    throw new Error("Invalid application storage key");
  }
  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment))) {
    throw new Error("Invalid application storage key");
  }
  if (segments.length < 3 || !KEY_PREFIXES.has(segments[0]) || segments[1] !== organizationId) {
    throw new Error("Application storage key does not belong to organization");
  }
  return segments;
}

function isWithinRoot(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function ensureRoot() {
  const root = getConfiguredRoot();
  await fsPromises.mkdir(root, { recursive: true, mode: 0o750 });
  const stat = await fsPromises.lstat(root);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("Persistent disk storage root must be a real directory");
  }
  const canonicalRoot = await fsPromises.realpath(root);
  return canonicalRoot;
}

async function resolveAssetPath(organizationIdInput: string, key: string, createParent = false) {
  const organizationId = normalizeOrganizationId(organizationIdInput);
  const segments = validateKey(organizationId, key);
  const root = await ensureRoot();
  const directorySegments = segments.slice(0, -1);
  let directory = root;
  for (const segment of directorySegments) {
    const child = path.join(directory, segment);
    if (!isWithinRoot(root, child)) throw new Error("Application storage path escapes configured root");
    let stat;
    try {
      stat = await fsPromises.lstat(child);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !createParent) throw error;
      try {
        await fsPromises.mkdir(child, { mode: 0o750 });
      } catch (mkdirError) {
        if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST") throw mkdirError;
      }
      stat = await fsPromises.lstat(child);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Application storage path is not a safe directory");
    directory = child;
    const actual = await fsPromises.realpath(directory);
    if (!isWithinRoot(root, actual)) throw new Error("Application storage path escapes configured root");
  }
  const target = path.join(directory, segments.at(-1)!);
  if (!isWithinRoot(root, target)) throw new Error("Application storage path escapes configured root");
  return { organizationId, root, target, metadataPath: `${target}.meta.json`, directory };
}

async function assertRegularFile(filePath: string) {
  const stat = await fsPromises.lstat(filePath);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Application storage object is not a regular file");
  return stat;
}

async function readRegularFile(filePath: string, maxBytes: number) {
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  if (!noFollow) await assertRegularFile(filePath);
  const handle = await fsPromises.open(filePath, fsConstants.O_RDONLY | noFollow);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("Application storage object is not a regular file");
    if (stat.size > maxBytes) throw new Error("Application storage object exceeds the allowed size");
    return { stat, buffer: await handle.readFile() };
  } finally {
    await handle.close();
  }
}

async function readMetadata(organizationId: string, key: string): Promise<PersistentDiskAssetMetadata | null> {
  try {
    const resolved = await resolveAssetPath(organizationId, key);
    const { buffer } = await readRegularFile(resolved.metadataPath, 64 * 1024);
    const raw = buffer.toString("utf8");
    const metadata = JSON.parse(raw) as PersistentDiskAssetMetadata;
    if (metadata.provider !== "persistent-disk"
      || metadata.organizationId !== resolved.organizationId
      || metadata.key !== key
      || !["public", "private"].includes(metadata.access)
      || !MIME_TYPES.has(metadata.mimeType)
      || !Number.isSafeInteger(metadata.sizeBytes)
      || metadata.sizeBytes < 1
      || !/^[a-f0-9]{64}$/.test(metadata.checksumSha256)) {
      throw new Error("Persistent disk metadata is invalid");
    }
    return metadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readBytes(organizationId: string, key: string, metadata?: PersistentDiskAssetMetadata) {
  try {
    const resolved = await resolveAssetPath(organizationId, key);
    const record = metadata ?? await readMetadata(organizationId, key);
    if (!record) return null;
    const { stat, buffer } = await readRegularFile(resolved.target, APPLICATION_STORAGE_MAX_IMAGE_BYTES);
    if (stat.size !== record.sizeBytes) throw new Error("Persistent disk asset size does not match metadata");
    const checksum = createHash("sha256").update(buffer).digest("hex");
    if (checksum !== record.checksumSha256) throw new Error("Persistent disk asset checksum does not match metadata");
    return { metadata: record, buffer };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getPersistentDiskAssetMetadata(input: { organizationId: string; key: string }) {
  return readMetadata(input.organizationId, input.key);
}

export async function readPersistentDiskAsset(input: { organizationId: string; key: string }) {
  return readBytes(input.organizationId, input.key);
}

async function writeExclusiveAtomic(target: string, directory: string, contents: Buffer) {
  const temporary = path.join(directory, `.tmp-${randomUUID()}`);
  const handle = await fsPromises.open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    // link is an atomic, no-overwrite publish operation on the same filesystem.
    await fsPromises.link(temporary, target);
    if (process.platform !== "win32") {
      const directoryHandle = await fsPromises.open(directory, "r");
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    }
  } finally {
    await fsPromises.unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

function routeUrl(organizationId: string, key: string) {
  return `/api/media/${encodeURIComponent(organizationId)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function createPersistentDiskApplicationStorage(): ApplicationStorageAdapter {
  return {
    provider: "persistent-disk",
    async store(input: StoreApplicationAssetInput & { key: string; checksumSha256: string; width: number | null; height: number | null }): Promise<StoredApplicationAsset> {
      const validated = validateApplicationImageBuffer(input.buffer, input.mimeType);
      const checksumSha256 = validated.checksumSha256;
      if (checksumSha256 !== input.checksumSha256) throw new Error("Application storage checksum does not match content");
      const resolved = await resolveAssetPath(input.organizationId, input.key, true);
      const access = input.access ?? "public";
      const metadata: PersistentDiskAssetMetadata = {
        provider: "persistent-disk",
        organizationId: resolved.organizationId,
        key: input.key,
        access,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        checksumSha256,
        width: input.width,
        height: input.height,
      };
      try {
        await writeExclusiveAtomic(resolved.target, resolved.directory, input.buffer);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existing = await readBytes(input.organizationId, input.key);
        if (existing
          && existing.metadata.access === access
          && existing.metadata.mimeType === input.mimeType
          && existing.metadata.sizeBytes === input.buffer.length
          && existing.metadata.checksumSha256 === checksumSha256
          && existing.metadata.width === input.width
          && existing.metadata.height === input.height) {
          return { ...existing.metadata, url: routeUrl(resolved.organizationId, input.key) };
        }
        throw error;
      }
      try {
        await writeExclusiveAtomic(resolved.metadataPath, resolved.directory, Buffer.from(JSON.stringify(metadata), "utf8"));
      } catch (error) {
        await fsPromises.unlink(resolved.target).catch(() => undefined);
        throw error;
      }
      return {
        ...metadata,
        url: routeUrl(resolved.organizationId, input.key),
      };
    },
    async remove(input) {
      let resolved;
      try {
        resolved = await resolveAssetPath(input.organizationId, input.key);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      const metadata = await readMetadata(input.organizationId, input.key);
      if (metadata && (metadata.organizationId !== resolved.organizationId || metadata.key !== input.key)) {
        throw new Error("Application storage key does not belong to organization");
      }
      for (const filePath of [resolved.target, resolved.metadataPath]) {
        try {
          await assertRegularFile(filePath);
          await fsPromises.unlink(filePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      if (process.platform !== "win32") {
        const directoryHandle = await fsPromises.open(resolved.directory, "r").catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (directoryHandle) {
          try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
        }
      }
    },
    async verify(input) {
      return Boolean(await readBytes(input.organizationId, input.key));
    },
    async streamContent(input) {
      const asset = await readBytes(input.organizationId, input.key);
      if (!asset) return null;
      if (asset.metadata.mimeType !== input.mimeType) throw new Error("Application storage MIME type does not match metadata");
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(asset.buffer));
          controller.close();
        },
      });
    },
  };
}
