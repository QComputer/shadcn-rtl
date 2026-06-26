import { NextResponse, NextRequest } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { getMimeTypeFromFilename, getBlobPathname } from "@/lib/media-storage";
import { getFromBlob } from "@/lib/blob-storage";
import { prisma } from "@/lib/db";

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

    const pathname = getBlobPathname(filename);
    const image = await prisma.image.findFirst({
      where: {
        filename: pathname,
        access: "PRIVATE", // Only PRIVATE images go through this endpoint
      },
      select: { id: true, url: true },
    });

    if (!image) {
      return new NextResponse("File not found", { status: 404 });
    }

    // For Vercel Blob, redirect to the stored URL
    if (image.url.startsWith("http")) {
      return NextResponse.redirect(image.url, { status: 302 });
    }

    // Fallback: stream from blob storage using pathname
    const { buffer } = await getFromBlob(pathname);
    const mimeType = getMimeTypeFromFilename(filename);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT" || error?.message === "Blob not found") {
      return new NextResponse("File not found", { status: 404 });
    }

    return jsonError(error, "Failed to serve file");
  }
}
