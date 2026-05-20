import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/lib/services/order.service";
import { updateOrderStatusSchema } from "@/lib/validators";
import prisma from "@/lib/db";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrderAccess,
} from "@/lib/api-guards";

function statusForError(error: unknown) {
  if (error instanceof ApiError) return error.status;
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 401;
  if (error.message.includes("not found")) return 404;
  if (error.message.includes("Invalid order status transition")) return 409;
  if (error.message.includes("Forbidden")) return 403;
  return 500;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrderAccess(session, id, ["ADMIN", "MANAGER", "STAFF", "DRIVER", "CUSTOMER"]);

    const order = await orderService.getById(id);
    if (!order) throw new ApiError(404, "Order not found");
    return NextResponse.json(order);
  } catch (error) {
    console.error("Error getting order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrderAccess(session, id, ["ADMIN", "MANAGER", "STAFF"]);

    const body = await request.json();
    const data = updateOrderStatusSchema.parse(body);
    const order = await orderService.updateStatus(id, data, session.user.role, session.user.id);

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    const body = await request.json();
    const { estimatedEndTime, type } = body;

    const order = await prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new ApiError(404, "Order not found");

    await requireOrderAccess(session, id, ["ADMIN", "MANAGER", "DRIVER"]);

    if (session.user.role === "DRIVER" && (type === "PREPARATION" || order.driverId !== session.user.id)) {
      throw new ApiError(403, "Forbidden");
    }
    if ((session.user.role === "ADMIN" || session.user.role === "MANAGER") && (type === "PICK_UP" || type === "DELIVERY")) {
      throw new ApiError(403, "Forbidden");
    }

    const updated = await orderService.updateEstimatedEndTime(
      id,
      session.user.role,
      type,
      new Date(estimatedEndTime),
      session.user.id,
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating progress:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireOrderAccess(session, id, ["ADMIN", "MANAGER"]);

    await orderService.updateStatus(id, { status: "CANCELLED" }, session.user.role, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}
