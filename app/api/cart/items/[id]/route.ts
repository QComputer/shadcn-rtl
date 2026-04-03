import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cartService } from "@/lib/services/cart.service";
import { updateCartItemSchema } from "@/lib/validators";
import { randomUUID } from "crypto";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "guest_session_id";

// Get or create session ID from cookies
function getSessionId(request: NextRequest): string {
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME);
  if (existingSessionId) {
    return existingSessionId.value;
  }
  return randomUUID();
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await request.json();
    const data = updateCartItemSchema.parse(body);
    const sessionId = session?.user?.id ? undefined : getSessionId(request)    
    const item = await cartService.updateItemQuantity(
        id,
        data,
        session?.user?.id,
        sessionId,
      );
  
      return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating cart item:", error);
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
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await cartService.removeItem(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing cart item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
