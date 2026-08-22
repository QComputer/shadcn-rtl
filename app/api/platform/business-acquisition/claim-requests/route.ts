import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { createOrganizationClaimRequest } from "@/lib/business-acquisition/business-acquisition.service";
import { createOrganizationClaimRequestSchema } from "@/lib/business-acquisition/validators";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const parsed = createOrganizationClaimRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");

    const result = await createOrganizationClaimRequest(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
