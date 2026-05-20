import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orderService } from "@/lib/services/order.service";

function statusForDriverError(error: unknown) {
  if (!(error instanceof Error)) return 500;
  if (error.message.includes("not found")) return 404;
  if (error.message.includes("does not belong") || error.message.includes("denied")) return 403;
  if (error.message.includes("already assigned") || error.message.includes("not available") || error.message.includes("no longer available")) return 409;
  return 500;
}

// accepting order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "DRIVER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const order = await orderService.acceptOrderByDriver(id, session.user.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error accepting order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForDriverError(error) }
    );
  }
}

// Backward-compatible alias for older deployed UI versions. New clients should use POST.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return POST(request, context);
}

// to deny order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only driver can deny orders
    if (!session.user.role || !["DRIVER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await orderService.denyOrderByDriver(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForDriverError(error) }
    );
  }
}

// to undeny order
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can cancel orders
    if (!session.user.role || !["DRIVER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await orderService.unDenyOrderByDriver(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForDriverError(error) }
    );
  }
}
