import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireAuthSession, requireImageManageAccess } from "@/lib/api-guards";
import { deleteStoredImage } from "@/lib/media-storage";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const image = await requireImageManageAccess(session, id);

    const filename = image.filename || image.url.split("/").pop();
    await deleteStoredImage(filename);

    await prisma.$transaction(async (tx) => {
      await tx.image.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entityType: "Image",
          entityId: id,
          description: "Deleted uploaded image",
          userId: session.user.id,
          organizationId: image.organizationId || undefined,
          previousValue: {
            filename: image.filename,
            url: image.url,
          },
        },
      });
    });

    return NextResponse.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    return jsonError(error, "Failed to delete image");
  }
}
