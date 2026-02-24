import { NextRequest, NextResponse } from "next/server";
import { guestCartService } from "@/lib/services/guest-cart.service";
import { addToCartSchema } from "@/lib/validators";
import { randomUUID } from "crypto";

const SESSION_COOKIE_NAME = "guest_session_id";

// Get or create session ID from cookies
function getSessionId(request: NextRequest): string {
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME);
  if (existingSessionId) {
    return existingSessionId.value;
  }
  return randomUUID();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const sessionId = getSessionId(request);
    const cart = await guestCartService.getCart(sessionId, organizationId);

    // Create response with session cookie
    const response = NextResponse.json(cart);
    
    // Set session cookie if it doesn't exist
    if (!request.cookies.get(SESSION_COOKIE_NAME)) {
      response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
    }
    
    return response;
  } catch (error) {
    console.error("Error getting guest cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const organizationId = body.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const data = addToCartSchema.parse(body);
    const sessionId = getSessionId(request);

    const item = await guestCartService.addItem(sessionId, organizationId, data);

    // Create response with session cookie
    const response = NextResponse.json(item, { status: 201 });
    
    // Set session cookie if it doesn't exist
    if (!request.cookies.get(SESSION_COOKIE_NAME)) {
      response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
    }
    
    return response;
  } catch (error) {
    console.error("Error adding to guest cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const sessionId = getSessionId(request);
    await guestCartService.clearCart(sessionId, organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing guest cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
