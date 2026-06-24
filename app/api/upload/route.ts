import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireRole,
  resolveOptionalUploadOrganizationId,
} from "@/lib/api-guards";
import {
  createStoredImageFilename,
  validateImageBuffer,
  writeStoredImage,
} from "@/lib/media-storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let imageRecord: { url: string; filename: string; pathname: string } | null = null;

  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]);

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "No file provided");
    }

    const purpose = String(formData.get("purpose") || "upload").slice(0, 64);
    const access = String(formData.get("access") || "PUBLIC").slice(0, 32) as "PUBLIC" | "PRIVATE";
    const organizationId = await resolveOptionalUploadOrganizationId(
      session,
      typeof formData.get("organizationId") === "string"
        ? String(formData.get("organizationId"))
        : null,
      typeof formData.get("organizationSlug") === "string"
        ? String(formData.get("organizationSlug"))
        : null,
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    validateImageBuffer(buffer, file.type, file.size);

    const filename = createStoredImageFilename(file.type, purpose);
    const result = await writeStoredImage(filename, buffer, access);

    const image = await prisma.image.create({
      data: {
        url: result.url,
        filename: result.pathname,
        mimeType: file.type,
        sizeBytes: file.size,
        purpose,
        access,
        uploadedByUserId: session.user.id,
        organizationId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entityType: "Image",
        entityId: image.id,
        description: `Uploaded image for ${purpose}`,
        userId: session.user.id,
        organizationId: organizationId || undefined,
        newValue: {
          filename: image.filename,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          purpose: image.purpose,
          access: image.access,
        },
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("File upload failed:", error);
    return jsonError(error, "Failed to upload file");
  }
}
