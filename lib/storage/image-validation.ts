import { createHash } from "node:crypto";

export const APPLICATION_STORAGE_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES = new Map<string, string>([
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

function hasSignature(buffer: Buffer, signatures: number[][]) {
  return signatures.some((signature) =>
    signature.every((byte, index) => buffer[index] === byte),
  );
}

function readPngDimensions(buffer: Buffer) {
  if (buffer.length < 24) return { width: null, height: null };
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readGifDimensions(buffer: Buffer) {
  if (buffer.length < 10) return { width: null, height: null };
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function readWebpDimensions(buffer: Buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 8, 12) !== "WEBP") return { width: null, height: null };
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  return { width: null, height: null };
}

function readJpegDimensions(buffer: Buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) break;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return { width: null, height: null };
}

export function validateApplicationImageBuffer(buffer: Buffer, mimeType: string) {
  if (!APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Only jpeg, png, webp, and gif images are allowed");
  }
  if (buffer.length <= 0 || buffer.length > APPLICATION_STORAGE_MAX_IMAGE_BYTES) {
    throw new Error("Image size must be between 1 byte and 5 MB");
  }
  const signatures = IMAGE_SIGNATURES[mimeType];
  if (signatures && !hasSignature(buffer, signatures)) {
    throw new Error("Image content does not match its MIME type");
  }
  if (mimeType === "image/webp" && buffer.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("Image content does not match its MIME type");
  }

  const dimensions =
    mimeType === "image/png" ? readPngDimensions(buffer)
      : mimeType === "image/gif" ? readGifDimensions(buffer)
        : mimeType === "image/webp" ? readWebpDimensions(buffer)
          : mimeType === "image/jpeg" ? readJpegDimensions(buffer)
            : { width: null, height: null };

  return {
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
    width: dimensions.width,
    height: dimensions.height,
  };
}

export function extensionForApplicationImage(mimeType: string) {
  return APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES.get(mimeType) ?? "bin";
}
