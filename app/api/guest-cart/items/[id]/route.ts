import { NextRequest, NextResponse } from "next/server";
import { guestCartService } from "@/lib/services/guest-cart.service";
import { updateCartItemSchema } from "@/lib/validators";
import { randomUUID } from "crypto";

const SESSION_COOKIE_NAME = "guest_session_id";

// Get session ID from cookies
function getSessionId(request: NextRequest): string {
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME);
  if (existingSessionId) {
    return existingSessionId.value;
  }
  return randomUUID();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateCartItemSchema.parse(body);
    
    const sessionId = getSessionId(request);
    const item = await guestCartService.updateItemQuantity(id, sessionId, data.quantity);

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating guest cart item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = getSessionId(request);
    
    await guestCartService.removeItem(id, sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing guest cart item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
