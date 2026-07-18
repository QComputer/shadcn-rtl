import "server-only";

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { ApplicationStorageAdapter, StoredApplicationAsset, StoreApplicationAssetInput } from "@/lib/storage/types";

function assertLocalTestStorageAllowed() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Local test storage cannot run in production");
  }
}

function getRoot() {
  const configured = process.env.AI_MEDIA_LOCAL_STORAGE_ROOT || path.join(process.cwd(), ".tmp", "ai-media-acceptance", "storage");
  const root = path.resolve(configured);
  const workspace = path.resolve(process.cwd());
  if (!root.startsWith(workspace + path.sep)) {
    throw new Error("Local test storage root must stay inside the workspace");
  }
  return root;
}

function resolveSafeLocalPath(key: string) {
  if (path.isAbsolute(key) || key.includes("..")) {
    throw new Error("Storage key must be application generated");
  }
  const root = getRoot();
  const target = path.resolve(root, key);
  if (!target.startsWith(root + path.sep)) {
    throw new Error("Storage key escapes local test storage root");
  }
  return { root, target };
}

export function createLocalTestApplicationStorage(): ApplicationStorageAdapter {
  assertLocalTestStorageAllowed();

  return {
    provider: "local-test",
    async store(input: StoreApplicationAssetInput & { key: string; checksumSha256: string; width: number | null; height: number | null }): Promise<StoredApplicationAsset> {
      assertLocalTestStorageAllowed();
      const { target } = resolveSafeLocalPath(input.key);
      await fsPromises.mkdir(path.dirname(target), { recursive: true });
      await fsPromises.writeFile(target, input.buffer, { flag: "wx" });

      return {
        provider: "local-test",
        organizationId: input.organizationId,
        key: input.key,
        url: `/uploads/${input.key.replaceAll("\\", "/")}`,
        access: input.access ?? "public",
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        checksumSha256: input.checksumSha256,
        width: input.width,
        height: input.height,
      };
    },
    async remove(input) {
      assertLocalTestStorageAllowed();
      const { target } = resolveSafeLocalPath(input.key);
      await fsPromises.rm(target, { force: true });
    },
    async verify(input) {
      assertLocalTestStorageAllowed();
      const { target } = resolveSafeLocalPath(input.key);
      try {
        const stat = await fsPromises.stat(target);
        return stat.isFile();
      } catch {
        return false;
      }
    },
    async streamContent(input) {
      assertLocalTestStorageAllowed();
      const { target } = resolveSafeLocalPath(input.key);
      try {
      const stat = await fsPromises.stat(target);
      if (!stat.isFile()) return null;
      const fileStream = fs.createReadStream(target);
      return new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => {
            const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
            controller.enqueue(new Uint8Array(bytes));
          });
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
      });
    } catch {
      return null;
    }
    },
  };
}
