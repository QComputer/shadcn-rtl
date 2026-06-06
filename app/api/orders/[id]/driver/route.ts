import { NextRequest, NextResponse } from "next/server";
import { orderService } from "@/lib/services/order.service";
import { ApiError, jsonError, requireAuthSession } from "@/lib/api-guards";

function requireDriverRole(role?: string | null) {
  if (role !== "DRIVER") {
    throw new ApiError(403, "Forbidden");
  }
}

// Accept an available order for the authenticated driver.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    requireDriverRole(session.user.role);

    const { id } = await params;
    await orderService.denyOrderByDriver(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error denying order:", error);
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
  }
}
