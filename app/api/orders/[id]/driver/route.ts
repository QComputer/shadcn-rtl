import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/lib/services/order.service";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";

function requireDriverRole(role?: string | null) {
  if (role !== "DRIVER") {
    throw new ApiError(403, "Forbidden");
  }
}

<<<<<<< HEAD
// Accept an available order for the authenticated driver.
=======
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
>>>>>>> bazar-baz
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
<<<<<<< HEAD
    const session = await requireAuthSession();
    requireDriverRole(session.user.role);

    const { id } = await params;
    const order = await orderService.acceptOrderByDriver(id, session.user.id);

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error accepting order:", error);
    return jsonError(error, "Internal server error");
  }
}

// GET must stay read-only. Older clients used GET to accept driver orders; that
// was unsafe because crawlers, prefetchers, and link previews can trigger GET.
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to accept a driver order." },
    { status: 405, headers: { Allow: "POST, DELETE, PATCH" } },
  );
}

// Deny an available order for the authenticated driver.
=======
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
>>>>>>> bazar-baz
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
<<<<<<< HEAD
    const session = await requireAuthSession();
    requireDriverRole(session.user.role);

    const { id } = await params;
=======
    const session = await requireDriverSession();
    const { id } = await params;

>>>>>>> bazar-baz
    await orderService.denyOrderByDriver(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error denying order:", error);
<<<<<<< HEAD
    return jsonError(error, "Internal server error");
  }
}

// Re-enable an order previously denied by the authenticated driver.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireDriverRole(session.user.role);

    const { id } = await params;
    await orderService.unDenyOrderByDriver(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring denied order:", error);
    return jsonError(error, "Internal server error");
=======
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForDriverError(error) }
    );
>>>>>>> bazar-baz
  }
}
