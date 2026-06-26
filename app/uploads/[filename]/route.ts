import { NextResponse, NextRequest } from "next/server";
import { ApiError, jsonError } from "@/lib/api-guards";
import { getMimeTypeFromFilename, getBlobPathname } from "@/lib/media-storage";
import { getFromBlob } from "@/lib/blob-storage";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// Local uploads path - for backwards compatibility when serving existing /uploads/ URLs
function getLocalBlobPath(pathname: string): string | null {
  const basename = pathname.replace(/^\/+|\/+$/g, "");
  if (!basename || basename.includes("..")) {
    return null;
  }
  try {
    return path.join(path.resolve(process.cwd(), "../uploads"), basename);
  } catch {
    return null;
  }
}

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
    
    // Check database for image record
    const image = await prisma.image.findFirst({
      where: {
        filename: pathname,
      },
      select: { id: true, url: true },
    });

    // If image has a blob URL, redirect to it
    if (image?.url && image.url.startsWith("http")) {
      return NextResponse.redirect(image.url, { status: 302 });
    }

    // If URL is /uploads/ path (legacy), serve from local filesystem
    // This handles backwards compatibility for existing images
    if (image?.url && image.url.startsWith("/uploads/")) {
      const localPath = getLocalBlobPath(pathname);
      if (localPath) {
        try {
          const buffer = await fs.readFile(localPath);
          const mimeType = getMimeTypeFromFilename(filename);
          return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
              "Content-Type": mimeType,
              "Cache-Control": "public, max-age=86400, immutable",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch {
          // File not found
        }
      }
    }

    // For PRIVATE images without blob URL, try to serve from Vercel Blob by pathname
    try {
      const { buffer, contentType } = await getFromBlob(pathname);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // Blob not found
    }

    return new NextResponse("File not found", { status: 404 });
  } catch (error: any) {
    if (error?.code === "ENOENT" || error?.message === "Blob not found") {
      return new NextResponse("File not found", { status: 404 });
    }

    return jsonError(error, "Failed to serve file");
  }
}
