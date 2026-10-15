import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { userService } from "@/lib/services/user.service";
import { organizationMembershipService } from "@/lib/services/organization-membership.service";
import { ApiError, jsonError, requireAuthSession, requireCurrentOrgAdminOrManager, requireSameOriginMutation, type SessionWithUser } from "@/lib/api-guards";
import { z } from "zod";
const input = z.object({ role: z.nativeEnum(UserRole).optional(), isActive: z.boolean().optional() }).strict().refine((value) => Number(value.role !== undefined) + Number(value.isActive !== undefined) === 1);
const privateHeaders = { "Cache-Control": "private, no-store" };
async function targetScope(session: SessionWithUser, userId: string) {
  if (session.user.role === "SUPER_ADMIN") return undefined;
  const manager = await requireCurrentOrgAdminOrManager(session);
  if (!manager) throw new ApiError(403, "Forbidden");
  const target = await prisma.organizationMember.findFirst({ where: { userId, organizationId: manager.organizationId, isActive: true }, select: { id: true } });
  if (!target) throw new ApiError(403, "Forbidden");
  return manager.organizationId;
}
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const scope = id === session.user.id ? session.user.organizationId ?? undefined : await targetScope(session, id);
    const user = await userService.getById(id, scope);
    if (!user) throw new ApiError(404, "User not found");
    return NextResponse.json({ ...user, memberships: user.memberOf,
      memberOf: user.memberOf.find((member) => member.organizationId === session.user.organizationId) ?? user.memberOf[0] ?? null }, { headers: privateHeaders });
  } catch (error) { return jsonError(error); }
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    requireSameOriginMutation(request);
    const { id } = await params;
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Provide one valid user update field");
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    if (parsed.data.role !== undefined || session.user.role === "SUPER_ADMIN") {
      if (session.user.role !== "SUPER_ADMIN") throw new ApiError(403, "Only SUPER_ADMIN can change global roles");
      return NextResponse.json(await organizationMembershipService.changeGlobalUser(actor, id, parsed.data), { headers: privateHeaders });
    }
    const scope = await targetScope(session, id);
    const member = await prisma.organizationMember.findFirst({ where: { organizationId: scope, userId: id, isActive: true }, select: { id: true, organizationId: true } });
    if (!member) throw new ApiError(404, "Organization member not found");
    return NextResponse.json(await organizationMembershipService.change(actor, member.organizationId, member.id, { isActive: parsed.data.isActive }), { headers: privateHeaders });
  } catch (error) { return jsonError(error); }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    requireSameOriginMutation(request);
    if (session.user.role !== "SUPER_ADMIN") throw new ApiError(403, "Only SUPER_ADMIN can delete users");
    const { id } = await params;
    return NextResponse.json(await organizationMembershipService.changeGlobalUser({ userId: session.user.id }, id, { deletedAt: new Date(), isActive: false }), { headers: privateHeaders });
  } catch (error) { return jsonError(error); }
}
