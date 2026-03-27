// Unified route to serve both guest and registered users

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cartService } from "@/lib/services/cart.service";
import { addToCartSchema } from "@/lib/validators";
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 },
      );
    }

    const session = await auth();
    const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (session?.user?.id) {
      // --------------------------------- Registered user
      
      const cart = existingSessionId
        ? // --------------------Marge to user cart
          await cartService.mergeToUserCart(
            existingSessionId,
            session?.user?.id,
            organizationId,
          )
        : await cartService.getCart(session.user.id, organizationId, null);

      return NextResponse.json(cart);
    } else {
      // --------------------Use sessionId for Guest users
      const sessionId = getSessionId(request);
      const cart = await cartService.getCart(
        null,
        organizationId,
        sessionId,
      );

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
    }
  } catch (error) {
    console.error("Error getting cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = addToCartSchema.parse(body);
    const organizationId = body.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 },
      );
    }

  const session = await auth();
  
    if (session?.user?.id) { // ------------------ Registered user
      const item = await cartService.addItem(
        session.user.id,
        organizationId,
        null,
        data,
      );
      return NextResponse.json(item, { status: 201 });
    } else { // -------------------- Use sessionId for Guest users
      const sessionId = getSessionId(request);
      const item = await cartService.addItem(null, organizationId, sessionId, data);

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
    }
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }
    const session = await auth();
    if (session?.user?.id) {
      // --------------------------------- Use cart service 
      await cartService.clearCart(session.user.id, organizationId, null);

      return NextResponse.json({ success: true });
      } else {
      // --------------------------------- Use guest-cart service
      const sessionId = getSessionId(request);
      await cartService.clearCart(null, organizationId, sessionId);

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error clearing cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
