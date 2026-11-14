import { NextRequest, NextResponse } from "next/server";
import { organizationService } from "@/lib/services/organization.service";
import { businessHoursSchema } from "@/lib/validators";
import { readBoundedJson } from "@/lib/security/bounded-json";
import {
  ApiError,
  requireAuthSession,
  requireOrgAccess,
  requireSameOriginMutation,
} from "@/lib/api-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrgAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    const hours = await organizationService.getBusinessHours(id);

    return NextResponse.json(hours);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error getting business hours:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrgAccess(session, id, ["ADMIN", "MANAGER"]);

    const body = await readBoundedJson(request, { maxBytes: 64 * 1024 });
    const data = businessHoursSchema.parse(body);

    const hours = await organizationService.updateBusinessHours(id, data);

    return NextResponse.json(hours);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating business hours:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
