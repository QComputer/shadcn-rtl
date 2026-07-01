import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { creativeStudioService } from "@/lib/services/creative-studio.service";
import { executeOrganizationBrandProviderSchema } from "@/lib/validators";
import { requireCreativeStudioOrganization } from "../../_helpers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = executeOrganizationBrandProviderSchema.parse(body);
    const { session, organizationId } = await requireCreativeStudioOrganization(input.organizationId);
    const result = await creativeStudioService.requestOrganizationBrandProviderExecution(
      organizationId,
      session.user.id,
      session.user.role,
      input,
    );

    return NextResponse.json({
      ok: true,
      job: result.job,
      asset: result.asset,
      execution: result.execution,
      publicMutation: false,
    }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Failed to execute organization brand provider request");
  }
}
