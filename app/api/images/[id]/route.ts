import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";

function getUploadDir() {
  return path.join(process.cwd(), "../uploads");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN", "ADMIN", "MANAGER"]);

    const { id } = await params;
    if (!id) {
      throw new ApiError(400, "Invalid ID provided");
    }

    const image = await prisma.image.findUnique({ where: { id } });
    if (!image) {
      throw new ApiError(404, "Image not found");
    }

    const filename = image.filename || image.url.split("/").pop();
    if (filename) {
      const filepath = path.join(getUploadDir(), path.basename(filename));
      try {
        await fs.unlink(filepath);
      } catch (error: any) {
        if (error?.code !== "ENOENT") {
          console.error(`Error deleting file ${image.url}:`, error);
        }
      }
    }

    await prisma.image.delete({ where: { id } });
    return NextResponse.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    return jsonError(error, "Failed to delete image");
  }
}
