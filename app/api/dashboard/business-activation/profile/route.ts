import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { updateOwnerBusinessProfile } from "@/lib/business-acquisition/owner-activation.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = await request.json();
    const dashboard = await updateOwnerBusinessProfile({
      session,
      organizationId: typeof body?.organizationId === "string" ? body.organizationId : null,
      data: {
        description: body?.description,
        address: body?.address,
        phone: body?.phone,
        email: body?.email,
      },
    });

    return NextResponse.json({ dashboard });
  } catch (error) {
    return jsonError(error, "Failed to update business profile");
  }
}
