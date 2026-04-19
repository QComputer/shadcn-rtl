import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { createOrganizationSchema, organizationFilterSchema } from "@/lib/validators";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
//console.log("----api/organizations---------->session", session);
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = organizationFilterSchema.parse(searchParams);

    const result = await organizationService.list(params);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing organizations:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// create organization
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createOrganizationSchema.parse(body);

    const organization =
      session.user.role == "SUPER_ADMIN"
        ? await organizationService.create(data)
        : await organizationService.create(data);

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
