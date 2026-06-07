import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/lib/services/order.service";
import { ApiError, requireAuthSession, requireOrderAccess } from "@/lib/api-guards";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;

    await requireOrderAccess(session, id, ["ADMIN", "MANAGER", "SUPER_ADMIN"]);

    const body = await request.json();
    const driverId = body?.driverId;

    if (!driverId || typeof driverId !== "string") {
      throw new ApiError(400, "driverId is required");
    }

    const order = await orderService.assignDriver(id, driverId, session.user.role);
    return NextResponse.json(order);
  } catch (error) {
    console.error("Error assigning driver:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof ApiError ? error.status : 500 },
    );
  }
}
