import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { ApiError } from "@/lib/api-guards";
import { validateRetailHeroUpload, MAX_RETAIL_HERO_UPLOAD_BYTES } from "@/lib/website-studio/hero-upload.server";

test("Hero upload accepts a valid decoded image", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer();
  assert.deepEqual(await validateRetailHeroUpload(png, "image/png", png.length), { width: 2, height: 2, format: "png" });
});

test("Hero upload rejects MIME/signature mismatch, oversized, and corrupt images", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer();
  await assert.rejects(validateRetailHeroUpload(png, "image/jpeg", png.length), (error: unknown) => error instanceof ApiError && error.status === 415);
  await assert.rejects(validateRetailHeroUpload(Buffer.alloc(MAX_RETAIL_HERO_UPLOAD_BYTES + 1), "image/png", MAX_RETAIL_HERO_UPLOAD_BYTES + 1), (error: unknown) => error instanceof ApiError && error.status === 413);
  const corrupt = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  await assert.rejects(validateRetailHeroUpload(corrupt, "image/png", corrupt.length), (error: unknown) => error instanceof ApiError && error.status === 415);
});
