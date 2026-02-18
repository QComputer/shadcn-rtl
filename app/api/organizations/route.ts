import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { createOrganizationSchema, organizationFilterSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.expires) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createOrganizationSchema.parse(body);

    const organization = await organizationService.create(data, session.user.id);

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
