import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import { ApiError, jsonError } from "@/lib/api-guards";
import { getMimeTypeFromFilename, getStoredFilePath } from "@/lib/media-storage";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;

    if (!filename) {
      throw new ApiError(400, "Missing filename");
    }

    const filepath = getStoredFilePath(filename);
    const fileContent = await fs.readFile(filepath);
    const mimeType = getMimeTypeFromFilename(filename);

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return new NextResponse("File not found", { status: 404 });
    }

    return jsonError(error, "Failed to serve file");
  }
}
