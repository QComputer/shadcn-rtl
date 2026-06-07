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

async function requireDriverSession() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  if (session.user.role !== "DRIVER") {
    throw new Error("Forbidden");
  }
  return session;
}

// POST /api/orders/[id]/driver
// body: { action?: "accept" | "undeny" }
// - no body / action="accept" => accept order
// - action="undeny"        => remove driver deny
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireDriverSession();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string })?.action;

    if (action === "undeny") {
      await orderService.unDenyOrderByDriver(id, session.user.id);
      return NextResponse.json({ success: true });
    }

    const order = await orderService.acceptOrderByDriver(id, session.user.id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (error) {
    console.error("Error in driver order action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForDriverError(error) }
    );
  }
}

// Backward-compatible alias for older deployed UI versions that used GET for accept.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return POST(request, context);
}

// DELETE /api/orders/[id]/driver => deny order
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireDriverSession();
    const { id } = await params;

    await orderService.denyOrderByDriver(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error denying order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForDriverError(error) }
    );
  }
}