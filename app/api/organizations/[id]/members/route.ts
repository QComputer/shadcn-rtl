import { NextRequest, NextResponse } from "next/server";
import { organizationService } from "@/lib/services/organization.service";
import { parseManagedMemberRole } from "@/lib/services/organization-membership.service";
import { ApiError, jsonError, requireAuthSession, requireOrgAccess, requireSameOriginMutation } from "@/lib/api-guards";
import { z } from "zod";
const input = z.object({ userId: z.string().trim().min(1).max(128), role: z.unknown().optional() }).strict();
const privateHeaders = { "Cache-Control": "private, no-store" };
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrgAccess(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json(await organizationService.getMembers(id), { headers: privateHeaders });
  } catch (error) { return jsonError(error); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuthSession();
    requireSameOriginMutation(request);
    const { id } = await params;
    await requireOrgAccess(session, id, ["ADMIN", "MANAGER"]);
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid member request");
    const role = parseManagedMemberRole(parsed.data.role ?? "STAFF");
    const member = await organizationService.addMember(id, parsed.data.userId, role, { userId: session.user.id, organizationId: session.user.organizationId });
    return NextResponse.json(member, { status: 201, headers: privateHeaders });
  } catch (error) { return jsonError(error); }
}
