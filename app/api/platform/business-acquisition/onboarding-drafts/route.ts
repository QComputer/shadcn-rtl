import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { createOrganizationOnboardingDraft } from "@/lib/business-acquisition/business-acquisition.service";
import { createOnboardingDraftSchema } from "@/lib/business-acquisition/validators";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const parsed = createOnboardingDraftSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");

    return NextResponse.json(createOrganizationOnboardingDraft(parsed.data), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
