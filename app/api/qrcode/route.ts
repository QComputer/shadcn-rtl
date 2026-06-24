import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import prisma from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireRole,
  resolveOptionalUploadOrganizationId,
} from "@/lib/api-guards";
import { createStoredImageFilename, writeStoredImage } from "@/lib/media-storage";

export const runtime = "nodejs";

function validateHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only http and https URLs are allowed");
    }
    return url.toString();
  } catch {
    throw new ApiError(400, "A valid http(s) URL is required");
  }
}

async function renderQrCode(url: string) {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 2,
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = validateHttpUrl(req.nextUrl.searchParams.get("url") || "");
    const qrCodeImageBuffer = await renderQrCode(url);

    const arrayBuffer = qrCodeImageBuffer.buffer.slice(
      qrCodeImageBuffer.byteOffset,
      qrCodeImageBuffer.byteOffset + qrCodeImageBuffer.byteLength,
    ) as BodyInit;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    return jsonError(error, "Failed to generate QR code");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]);

    const body = await request.json();
    const url = validateHttpUrl(body?.url || "");
    const organizationId = await resolveOptionalUploadOrganizationId(
      session,
      typeof body?.organizationId === "string" ? body.organizationId : null,
      typeof body?.organizationSlug === "string" ? body.organizationSlug : null,
    );

    const qrCodeImageBuffer = await renderQrCode(url);
    const filename = createStoredImageFilename("image/png", "qrcode");
    const result = await writeStoredImage(filename, Buffer.from(qrCodeImageBuffer), "PRIVATE");
    const imageUrl = result.url;
    const image = await prisma.image.create({
      data: {
        url: imageUrl,
        filename,
        mimeType: "image/png",
        sizeBytes: qrCodeImageBuffer.byteLength,
        purpose: "qrcode",
        uploadedByUserId: session.user.id,
        organizationId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Image",
        entityId: image.id,
        description: "Generated and saved QR code image",
        userId: session.user.id,
        organizationId: organizationId || undefined,
        newValue: { url, imageUrl },
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("Error creating QR code:", error);
    return jsonError(error, "Failed to create qrcode");
  }
}
