import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { userService } from "@/lib/services/user.service";
import { hasPermission } from "@/lib/types";
import { businessHoursSchema } from "@/lib/validators";
import { log } from "console";

export async function GET(
  request: NextRequest,
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hours = await userService.getBusinessHours(session.user.id);
    console.log(
      "================================= business-hours api==================================",
    );


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
) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.role || !session.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = businessHoursSchema.parse(body);

    const hours = await userService.updateBusinessHours(session.user.id, session.organizationId, data);

    return NextResponse.json(hours);
  } catch (error) {
    console.error("Error updating business hours:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
