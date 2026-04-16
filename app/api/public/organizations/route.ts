import { NextRequest, NextResponse } from "next/server";
import { organizationService } from "@/lib/services/organization.service";
import { organizationFilterSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {

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
