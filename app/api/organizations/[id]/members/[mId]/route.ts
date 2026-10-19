import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess, requireSameOriginMutation } from "@/lib/api-guards";
import { organizationMembershipService, parseManagedMemberRole } from "@/lib/services/organization-membership.service";
import { z } from "zod";
const input = z.object({ role: z.unknown().optional(), isActive: z.boolean().optional() }).strict().refine((value) => value.role !== undefined || value.isActive !== undefined);
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string; mId: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id, mId } = await params;
    const actor = await requireOrgAccess(session, id, ["ADMIN", "MANAGER", "STAFF", "DRIVER", "CUSTOMER"]);
    const manages = session.user.role === "SUPER_ADMIN" || actor?.role === "ADMIN" || actor?.role === "MANAGER";
    const member = await prisma.organizationMember.findFirst({ where: { id: mId, organizationId: id, ...(manages ? {} : { userId: session.user.id }) },
      select: { id: true, userId: true, organizationId: true, organizationSlug: true, role: true, isActive: true,
        user: { select: { id: true, name: true, email: true, firstName: true, lastName: true, phone: true, role: true, isActive: true, isTeamMember: true } },
        organization: { select: { id: true, name: true, slug: true, type: true } } } });
    if (!member) throw new ApiError(404, "Organization member not found");
    return NextResponse.json(member, { headers: privateHeaders });
  } catch (error) { return jsonError(error); }
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; mId: string }> }) {
  try {
    const session = await requireAuthSession();
    requireSameOriginMutation(request);
    const { id, mId } = await params;
    await requireOrgAccess(session, id, ["ADMIN", "MANAGER"]);
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid member update");
    const update = { ...(parsed.data.role !== undefined ? { role: parseManagedMemberRole(parsed.data.role) } : {}), ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}) };
    const member = await organizationMembershipService.change({ userId: session.user.id, organizationId: session.user.organizationId }, id, mId, update);
    return NextResponse.json(member, { headers: privateHeaders });
  } catch (error) { return jsonError(error); }
}
