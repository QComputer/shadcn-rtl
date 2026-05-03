import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { organizationService } from "@/lib/services/organization.service";
import { businessHoursSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hours = await organizationService.getBusinessHours(id);

    return NextResponse.json(hours);
  } catch (error) {
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
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "org:manage_hours")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = businessHoursSchema.parse(body);

    const hours = await organizationService.updateBusinessHours(id, data);

    return NextResponse.json(hours);
  } catch (error) {
    console.error("Error updating business hours:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
