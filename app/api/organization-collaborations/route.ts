import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant-context";
import {
  createOrganizationCollaborationSchema,
  updateOrganizationCollaborationSchema,
} from "@/lib/validators/tenant-platform";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const organizationId = request.nextUrl.searchParams.get("organizationId");
    await requireTenantContext(session, organizationId, ["ADMIN", "MANAGER"]);
    const collaborations = await prisma.organizationCollaboration.findMany({
      where: { OR: [{ ownerOrgId: organizationId! }, { partnerOrgId: organizationId! }] },
      include: {
        ownerOrg: { select: { id: true, name: true, slug: true } },
        partnerOrg: { select: { id: true, name: true, slug: true } },
        scopes: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ collaborations });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const parsed = createOrganizationCollaborationSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");
    if (parsed.data.ownerOrgId === parsed.data.partnerOrgId) throw new ApiError(400, "Organizations must be different");
    await requireTenantContext(session, parsed.data.ownerOrgId, ["ADMIN", "MANAGER"]);

    const partner = await prisma.organization.findFirst({
      where: { id: parsed.data.partnerOrgId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!partner) throw new ApiError(404, "Partner organization not found");

    const duplicate = await prisma.organizationCollaboration.findFirst({
      where: {
        status: { in: ["PENDING", "ACTIVE", "SUSPENDED"] },
        OR: [
          { ownerOrgId: parsed.data.ownerOrgId, partnerOrgId: parsed.data.partnerOrgId },
          { ownerOrgId: parsed.data.partnerOrgId, partnerOrgId: parsed.data.ownerOrgId },
        ],
      },
    });
    if (duplicate) throw new ApiError(409, "Collaboration already exists");

    const collaboration = await prisma.organizationCollaboration.create({
      data: {
        ownerOrgId: parsed.data.ownerOrgId,
        partnerOrgId: parsed.data.partnerOrgId,
        direction: parsed.data.direction,
        invitedById: session.user.id,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        scopes: {
          create: parsed.data.scopes.map((scope) => ({ ...scope, writeAccess: false })),
        },
      },
      include: { scopes: true },
    });
    await writeAuditLog({
      action: "CREATE",
      entityType: "OrganizationCollaboration",
      entityId: collaboration.id,
      description: "Collaboration invitation created; no data is shared until partner consent",
      newValue: { partnerOrgId: collaboration.partnerOrgId, direction: collaboration.direction, scopes: collaboration.scopes },
      userId: session.user.id,
      organizationId: parsed.data.ownerOrgId,
    });
    return NextResponse.json(collaboration, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const parsed = updateOrganizationCollaborationSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");
    await requireTenantContext(session, parsed.data.actingOrganizationId, ["ADMIN", "MANAGER"]);

    const existing = await prisma.organizationCollaboration.findUnique({ where: { id: parsed.data.collaborationId } });
    if (!existing) throw new ApiError(404, "Collaboration not found");
    if (![existing.ownerOrgId, existing.partnerOrgId].includes(parsed.data.actingOrganizationId)) throw new ApiError(403, "Forbidden");
    if (parsed.data.action === "ACCEPT" && parsed.data.actingOrganizationId !== existing.partnerOrgId) throw new ApiError(403, "Only the invited organization can accept");
    if (parsed.data.action === "ACCEPT" && existing.status !== "PENDING") throw new ApiError(409, "Collaboration is not pending");

    const now = new Date();
    const collaboration = await prisma.organizationCollaboration.update({
      where: { id: existing.id },
      data: parsed.data.action === "ACCEPT"
        ? { status: "ACTIVE", acceptedAt: now, acceptedById: session.user.id, startsAt: existing.startsAt ?? now }
        : parsed.data.action === "SUSPEND"
          ? { status: "SUSPENDED" }
          : { status: "REVOKED", revokedAt: now, revokedById: session.user.id },
      include: { scopes: true },
    });
    await writeAuditLog({
      action: "UPDATE",
      entityType: "OrganizationCollaboration",
      entityId: collaboration.id,
      description: `Collaboration ${parsed.data.action.toLowerCase()}`,
      previousValue: { status: existing.status },
      newValue: { status: collaboration.status },
      userId: session.user.id,
      organizationId: parsed.data.actingOrganizationId,
    });
    return NextResponse.json(collaboration);
  } catch (error) {
    return jsonError(error);
  }
}
