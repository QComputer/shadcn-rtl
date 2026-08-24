import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const platformOrg = await prisma.organization.findFirst({
      where: { slug: "bazarbaaz-platform", isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!platformOrg) {
      return NextResponse.json({ error: "Platform organization not found" }, { status: 404 });
    }

    const events = await prisma.ussdEvent.findMany({
      where: { organizationId: platformOrg.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        publicId: true,
        sessionIdHash: true,
        eventType: true,
        metadata: true,
        createdAt: true,
        integration: {
          select: {
            id: true,
            publicId: true,
            provider: true,
            status: true,
            codeName: true,
            organization: {
              select: { slug: true, name: true },
            },
          },
        },
      },
    });

    const sanitized = events.map((event) => ({
      id: event.id,
      publicId: event.publicId,
      sessionIdHash: event.sessionIdHash,
      eventType: event.eventType,
      metadata: sanitizeMetadata(event.metadata),
      createdAt: event.createdAt,
      integration: event.integration
        ? {
            id: event.integration.id,
            publicId: event.integration.publicId,
            provider: event.integration.provider,
            status: event.integration.status,
            codeName: event.integration.codeName,
            organization: event.integration.organization,
          }
        : null,
    }));

    return NextResponse.json({ events: sanitized });
  } catch (error) {
    return jsonError(error, "Failed to load USSD events");
  }
}

function sanitizeMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (key === "password" || key === "token" || key === "pepper" || key === "secret") continue;
    sanitized[key] = value;
  }
  return sanitized;
}
