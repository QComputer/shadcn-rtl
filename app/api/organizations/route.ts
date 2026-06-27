import { NextRequest, NextResponse } from "next/server";
import { organizationService } from "@/lib/services/organization.service";
import { createOrganizationSchema, organizationFilterSchema } from "@/lib/validators";
import { jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";

function assertSuperAdmin(session: Awaited<ReturnType<typeof requireAuthSession>>) {
  requireRole(session, ["SUPER_ADMIN"]);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    assertSuperAdmin(session);

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = organizationFilterSchema.parse(searchParams);
    const result = await organizationService.list(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing organizations:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    assertSuperAdmin(session);

    const body = await request.json();
    const data = createOrganizationSchema.parse(body);
    const organization = await organizationService.create(data);

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return jsonError(error, "Internal server error");
  }
}
