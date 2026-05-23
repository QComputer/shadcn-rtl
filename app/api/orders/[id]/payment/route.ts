import { NextRequest, NextResponse } from "next/server";
import { updateOrderPaymentSchema } from "@/lib/validators";
import { orderService } from "@/lib/services/order.service";
import {
  ApiError,
  requireAuthSession,
  requireOrderAccess,
} from "@/lib/api-guards";

function statusForError(error: unknown) {
  if (error instanceof ApiError) return error.status;
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 401;
  if (error.message.includes("not found")) return 404;
  if (error.message.includes("Forbidden")) return 403;
  return 500;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrderAccess(session, id, ["ADMIN", "MANAGER"]);

    const body = await request.json();
    const data = updateOrderPaymentSchema.parse(body);

    const order = await orderService.updatePaymentStatus(
      id,
      {
        status: data.status,
        paymentId: data.paymentId,
        note: data.note,
      },
      session.user.id,
    );

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order payment:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}
