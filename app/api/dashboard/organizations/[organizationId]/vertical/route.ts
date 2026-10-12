import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireRole,
  requireSameOriginMutation,
} from "@/lib/api-guards";
import {
  BusinessVerticalAssignmentError,
  organizationService,
} from "@/lib/services/organization.service";
import {
  assignBusinessVerticalSchema,
  businessVerticalOrganizationIdSchema,
} from "@/lib/validators/tenant-platform";

const statusByAssignmentError = {
  FORBIDDEN: 403,
  INVALID_VERTICAL: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    requireSameOriginMutation(request);

    const { organizationId: rawOrganizationId } = await params;
    const organizationId = businessVerticalOrganizationIdSchema.parse(rawOrganizationId);
    const { vertical } = assignBusinessVerticalSchema.parse(await request.json());
    const result = await organizationService.setBusinessVertical(
      organizationId,
      vertical,
      session.user.role,
      session.user.id,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BusinessVerticalAssignmentError) {
      return jsonError(new ApiError(statusByAssignmentError[error.code], error.message));
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return jsonError(new ApiError(400, "Invalid business vertical assignment"));
    }
    return jsonError(error, "Failed to assign business vertical");
  }
}
