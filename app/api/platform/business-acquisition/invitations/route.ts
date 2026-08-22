import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { createOrganizationInvitation } from "@/lib/business-acquisition/business-acquisition.service";
import { createOrganizationInvitationSchema } from "@/lib/business-acquisition/validators";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const parsed = createOrganizationInvitationSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");

    const result = await createOrganizationInvitation({
      ...parsed.data,
      createdByUserId: session.user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
