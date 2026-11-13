import "server-only";
import sharp from "sharp";
import { ApiError } from "@/lib/api-guards";
import { validateImageBuffer } from "@/lib/media-storage";

export const MAX_RETAIL_HERO_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function validateRetailHeroUpload(buffer: Buffer, mimeType: string, reportedSize: number) {
  if (reportedSize > MAX_RETAIL_HERO_UPLOAD_BYTES) throw new ApiError(413, "حداکثر اندازه تصویر ۵ مگابایت است.");
  validateImageBuffer(buffer, mimeType, reportedSize);
  try {
    const decoder = sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 });
    const metadata = await decoder.metadata();
    await decoder.stats();
    if (!metadata.width || !metadata.height || !metadata.format) throw new Error("Image metadata is incomplete");
    return { width: metadata.width, height: metadata.height, format: metadata.format };
  } catch {
    throw new ApiError(415, "فایل تصویر معتبر نیست یا آسیب دیده است.");
  }
}
