import path from "path";
import { randomUUID } from "crypto";
import { ApiError } from "@/lib/api-guards";
import { uploadToBlob, deleteFromBlob } from "@/lib/blob-storage";

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const IMAGE_SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
};

export function getBlobPathname(filename: string): string {
  const basename = path.basename(filename);
  if (!basename || basename !== filename || basename.includes("..")) {
    throw new ApiError(400, "Invalid filename");
  }
  return basename;
}

export function getMimeTypeFromFilename(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function hasSignature(buffer: Buffer, signatures: number[][]) {
  return signatures.some((signature) =>
    signature.every((byte, index) => buffer[index] === byte),
  );
}

export function validateImageBuffer(buffer: Buffer, mimeType: string, size: number) {
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new ApiError(415, "Only jpeg, png, webp, and gif images are allowed");
  }

  if (size <= 0 || size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ApiError(413, "File size must be between 1 byte and 5 MB");
  }

  const signatures = IMAGE_SIGNATURES[mimeType];
  if (signatures && !hasSignature(buffer, signatures)) {
    throw new ApiError(415, "Uploaded file content does not match its image type");
  }

  if (mimeType === "image/webp" && buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new ApiError(415, "Uploaded file content does not match its image type");
  }
}

export function createStoredImageFilename(mimeType: string, purpose = "image") {
  const extension = ALLOWED_IMAGE_TYPES.get(mimeType) || "bin";
  const safePurpose = purpose.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 32) || "image";
  return `${Date.now()}-${randomUUID()}-${safePurpose}.${extension}`;
}

function normalizeImageContentType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

export async function writeStoredImage(filename: string, buffer: Buffer, access: "PUBLIC" | "PRIVATE" = "PRIVATE") {
  const pathname = getBlobPathname(filename);
  const blob = await uploadToBlob(pathname, buffer, getMimeTypeFromFilename(filename), access);
  return {
    pathname,
    url: access === "PUBLIC" && blob.access === "public" ? blob.url : `/uploads/${pathname}`,
  };
}

export async function copyRemoteImageToBlob(
  remoteUrl: string,
  purpose = "ai-generated",
): Promise<{ url: string; pathname: string }> {
  const response = await fetch(remoteUrl, {
    redirect: "follow",
    headers: { "User-Agent": "BazarBaz-AI-Media/1.0" },
  });

  if (!response.ok) {
    throw new ApiError(502, `Failed to fetch remote image: ${response.status}`);
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new ApiError(413, "Remote image size is invalid");
  }

  const contentType = normalizeImageContentType(response.headers.get("content-type") || "application/octet-stream");
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  validateImageBuffer(buffer, contentType, buffer.length);

  const filename = createStoredImageFilename(contentType, `${purpose}-${Date.now()}`);
  return writeStoredImage(filename, buffer, "PUBLIC");
}

export async function deleteStoredImage(filename?: string | null) {
  if (!filename) return;
  const pathname = getBlobPathname(path.basename(filename));
  try {
    await deleteFromBlob(pathname);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
}
