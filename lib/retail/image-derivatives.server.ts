import "server-only";

import { createRequire } from "node:module";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { readTenantDiskImage, usesPersistentMedia } from "@/lib/storage/tenant-image-storage.server";

const MAX_INPUT_PIXELS = 40_000_000;
const CARD_WIDTHS = [320, 640, 960] as const;
const DETAIL_MAX_WIDTH = 1600;

type SharpInstance = {
  rotate(): SharpInstance;
  resize(options: { width: number; height?: number; withoutEnlargement: true; fit: "inside" }): SharpInstance;
  webp(options: { quality: number; effort: number }): SharpInstance;
  metadata(): Promise<{ format?: string; width?: number; height?: number; orientation?: number; pages?: number; exif?: Buffer; icc?: Buffer; iptc?: Buffer; xmp?: Buffer }>;
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>;
};
type SharpFactory = (input: Buffer, options: { limitInputPixels: number; animated: false }) => SharpInstance;

function loadSharp(): SharpFactory {
  const localRequire = createRequire(path.join(process.cwd(), "package.json"));
  const nextPackage = localRequire.resolve("next/package.json");
  const nextRequire = createRequire(nextPackage);
  return nextRequire("sharp") as SharpFactory;
}

export type StoredImageVariant = { url: string; width: number; height: number; bytes: number };
export type ImageDerivatives = { version: 1; card: StoredImageVariant[]; detail?: StoredImageVariant };
export type RenderedImageVariant = StoredImageVariant & { buffer: Buffer };

export async function renderRetailImageDerivatives(input: Buffer): Promise<{ card: RenderedImageVariant[]; detail?: RenderedImageVariant }> {
  const sharp = loadSharp();
  const sourceMetadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false }).metadata();
  const reusableNativeWebp = sourceMetadata.format === "webp" && sourceMetadata.orientation === undefined
    && (!sourceMetadata.pages || sourceMetadata.pages === 1)
    && !sourceMetadata.exif && !sourceMetadata.icc && !sourceMetadata.iptc && !sourceMetadata.xmp;
  // Decode once up front to reject corrupt inputs and enforce sharp's pixel limit before fan-out.
  const oriented = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
    .rotate().resize({ width: DETAIL_MAX_WIDTH, height: DETAIL_MAX_WIDTH, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
  const naturalWidth = oriented.info.width;
  const widths = [...new Set(CARD_WIDTHS.map((width) => Math.min(width, naturalWidth)))];
  const card: RenderedImageVariant[] = [];
  for (const width of widths) {
    const rendered = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate().resize({ width, height: DETAIL_MAX_WIDTH, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
    const preserveNative = reusableNativeWebp && input.byteLength <= rendered.data.byteLength && rendered.info.width === sourceMetadata.width && rendered.info.height === sourceMetadata.height;
    const buffer = preserveNative ? input : rendered.data;
    card.push({ buffer, width: rendered.info.width, height: rendered.info.height, bytes: buffer.byteLength, url: "" });
  }
  const detail = naturalWidth > Math.max(...CARD_WIDTHS)
    ? { buffer: oriented.data, width: oriented.info.width, height: oriented.info.height, bytes: oriented.data.byteLength, url: "" }
    : undefined;
  return { card, ...(detail ? { detail } : {}) };
}

export async function createRetailImageDerivatives(input: Buffer, organizationId: string): Promise<ImageDerivatives> {
  const rendered = await renderRetailImageDerivatives(input);
  const card: StoredImageVariant[] = [];
  const { createStoredImageFilename, writeStoredImage } = await import("@/lib/media-storage");

  for (const variant of rendered.card) {
    const filename = createStoredImageFilename("image/webp", "retail-derivative");
    const stored = await writeStoredImage(filename, variant.buffer, "PUBLIC", organizationId);
    card.push({ url: stored.url, width: variant.width, height: variant.height, bytes: variant.bytes });
  }

  let detail: StoredImageVariant | undefined;
  if (rendered.detail) {
    const filename = createStoredImageFilename("image/webp", "retail-detail");
    const stored = await writeStoredImage(filename, rendered.detail.buffer, "PUBLIC", organizationId);
    detail = { url: stored.url, width: rendered.detail.width, height: rendered.detail.height, bytes: rendered.detail.bytes };
  }
  return { version: 1, card, ...(detail ? { detail } : {}) };
}

export async function createRetailCategoryImage(input: Buffer, organizationId: string) {
  const rendered = await renderRetailImageDerivatives(input);
  const variant = rendered.card.at(-1)!;
  const { createStoredImageFilename, writeStoredImage } = await import("@/lib/media-storage");
  const filename = createStoredImageFilename("image/webp", "retail-category");
  const stored = await writeStoredImage(filename, variant.buffer, "PUBLIC", organizationId);
  return { ...stored, width: variant.width, height: variant.height, bytes: variant.bytes };
}

export async function ensureImageDerivatives(imageRecord: {
  id: string;
  url: string;
  filename: string | null;
  organizationId: string | null;
  access: string;
  derivatives?: unknown;
}, expectedOrganizationId: string): Promise<ImageDerivatives | null> {
  if (!expectedOrganizationId || imageRecord.organizationId !== expectedOrganizationId) return null;
  if (imageRecord.access !== "PUBLIC") return null;
  const { prisma } = await import("@/lib/db");
  const ownedImage = await prisma.image.findFirst({
    where: { id: imageRecord.id, organizationId: expectedOrganizationId, access: "PUBLIC" },
    select: { id: true, url: true, filename: true, organizationId: true, access: true, derivatives: true },
  });
  if (!ownedImage) return null;
  if (isImageDerivatives(ownedImage.derivatives)) return ownedImage.derivatives;
  if (!ownedImage.filename || !ownedImage.organizationId || !usesPersistentMedia()) return null;
  const filename = ownedImage.filename;
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes("..")) return null;
  const original = await readTenantDiskImage(expectedOrganizationId, filename);
  if (!original) return null;
  const derivatives = await createRetailImageDerivatives(original.buffer, expectedOrganizationId);
  const currentDerivativesFilter = ownedImage.derivatives === null
    ? { equals: Prisma.DbNull }
    : { equals: ownedImage.derivatives as Prisma.InputJsonValue };
  await prisma.image.updateMany({
    where: { id: ownedImage.id, organizationId: expectedOrganizationId, access: "PUBLIC", derivatives: currentDerivativesFilter },
    data: { derivatives: derivatives as Prisma.InputJsonValue },
  });
  return derivatives;
}

export function isImageDerivatives(value: unknown): value is ImageDerivatives {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ImageDerivatives>;
  const isStoredUrl = (url: string) => {
    if (url.startsWith("https://")) {
      try { return new URL(url).protocol === "https:"; } catch { return false; }
    }
    if ((!url.startsWith("/uploads/") && !url.startsWith("/api/media/")) || url.startsWith("//") || /[\\?#]/.test(url)) return false;
    try {
      return url.split("/").every((segment) => {
        if (!segment) return true;
        const decoded = decodeURIComponent(segment);
        return decoded !== "." && decoded !== ".." && !decoded.includes("/") && !decoded.includes("\\");
      });
    } catch { return false; }
  };
  const validVariant = (variant: unknown, maxWidth: number): variant is StoredImageVariant => {
    if (!variant || typeof variant !== "object") return false;
    const value = variant as StoredImageVariant;
    return typeof value.url === "string" && isStoredUrl(value.url)
      && Number.isInteger(value.width) && value.width > 0 && value.width <= maxWidth
      && Number.isInteger(value.height) && value.height > 0
      && Number.isInteger(value.bytes) && value.bytes > 0;
  };
  return candidate.version === 1 && Array.isArray(candidate.card) && candidate.card.length > 0
    && candidate.card.every((variant) => validVariant(variant, 960))
    && (candidate.detail === undefined || validVariant(candidate.detail, DETAIL_MAX_WIDTH));
}
