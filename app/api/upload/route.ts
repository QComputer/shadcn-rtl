import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireRole, safeUploadFilename } from "@/lib/api-guards";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function getUploadDir() {
  return path.join(process.cwd(), "../uploads");
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "No file provided");
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new ApiError(415, "Only jpeg, png, webp, and gif images are allowed");
    }

    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, "File size must be between 1 byte and 5 MB");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = getUploadDir();
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = safeUploadFilename(file.name, "jpg");
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, buffer, { flag: "wx" });

    const url = `/uploads/${filename}`;
    const image = await prisma.image.create({
      data: { url, filename },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("File upload failed:", error);
    return jsonError(error, "Failed to upload file");
  }
}
