import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cartService } from "@/lib/services/cart.service";
import { updateCartItemSchema } from "@/lib/validators";
import { randomUUID } from "crypto";
import { ZodError } from "zod";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "guest_session_id";

function getSessionId(request: NextRequest): string {
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME);
  if (existingSessionId) return existingSessionId.value;
  return randomUUID();
}

function statusForError(error: unknown) {
  if (error instanceof ZodError) return 400;
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 403;
  if (error.message.includes("not found")) return 404;
  if (error.message.includes("Insufficient inventory")) return 409;
  return 500;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const { id } = await params;
    const body = await request.json();
    const data = updateCartItemSchema.parse(body);
    const customerId = session?.user?.id || null;
    const sessionId = getSessionId(request);

    const item = await cartService.updateItemQuantity(
      id,
      data,
      customerId,
      sessionId,
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error updating cart item:", error);
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
    const session = await auth();
    const { id } = await params;
    const customerId = session?.user?.id || null;
    const sessionId = getSessionId(request);

    await cartService.removeItem(id, customerId, sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing cart item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}
