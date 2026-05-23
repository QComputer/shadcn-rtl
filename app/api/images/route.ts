import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";

export async function GET() {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]);

    const where =
      session.user.role === "SUPER_ADMIN"
        ? {}
        : {
            OR: [
              { uploadedByUserId: session.user.id },
              ...(session.user.organizationId
                ? [{ organizationId: session.user.organizationId }]
                : []),
            ],
          };

    const images = await prisma.image.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(images);
  } catch (error) {
    return jsonError(error, "Failed to list images");
  }
}
