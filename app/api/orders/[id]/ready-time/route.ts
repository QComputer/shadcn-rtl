import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireOrderAccess } from "@/lib/api-guards";
import { orderService } from "@/lib/services/order.service";
import { updateOrderReadyTimeSchema } from "@/lib/validators/tenant-platform";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrderAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);
    const parsed = updateOrderReadyTimeSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Validation failed");
    const order = await orderService.updateReadyTime(id, parsed.data, session.user.id);
    return NextResponse.json(order);
  } catch (error) {
    return jsonError(error);
  }
}
