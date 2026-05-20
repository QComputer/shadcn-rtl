// Unified route to serve both guest and registered users

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cartService } from "@/lib/services/cart.service";
import { addToCartSchema } from "@/lib/validators";
import { randomUUID } from "crypto";
import { ZodError } from "zod";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "guest_session_id";

function getSessionId(request: NextRequest): string {
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME);
  if (existingSessionId) return existingSessionId.value;
  return randomUUID();
}

function responseWithSessionCookie(
  request: NextRequest,
  sessionId: string,
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  if (!request.cookies.get(SESSION_COOKIE_NAME)) {
    response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
  }
  return response;
}

function statusForError(error: unknown) {
  if (error instanceof ZodError) return 400;
  if (!(error instanceof Error)) return 500;
  if (error.message === "Unauthorized") return 401;
  if (error.message.includes("not found")) return 404;
  if (error.message.includes("Insufficient inventory")) return 409;
  if (error.message.includes("does not belong")) return 400;
  if (error.message.includes("required")) return 400;
  return 500;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationSlug = searchParams.get("organizationSlug");
    if (!organizationSlug) {
      return NextResponse.json(
        { error: "Organization slug is required" },
        { status: 400 },
      );
    }

    const session = await auth();
    const customerId = session?.user?.id || null;
    const sessionId = getSessionId(request);
    const cart = await cartService.getCart(organizationSlug, customerId, sessionId);

    return responseWithSessionCookie(request, sessionId, cart);
  } catch (error) {
    console.error("Error getting cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = addToCartSchema.parse(body);
    const organizationSlug = body.organizationSlug;

    if (!organizationSlug) {
      return NextResponse.json(
        { error: "Organization slug is required" },
        { status: 400 },
      );
    }

    const session = await auth();
    const customerId = session?.user?.id || null;
    const sessionId = getSessionId(request);
    const item = await cartService.addItem(
      organizationSlug,
      customerId,
      sessionId,
      data,
    );

    return responseWithSessionCookie(request, sessionId, item, { status: 201 });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationSlug = searchParams.get("organizationSlug");

    if (!organizationSlug) {
      return NextResponse.json(
        { error: "Organization slug is required" },
        { status: 400 },
      );
    }

    const session = await auth();
    const customerId = session?.user?.id || null;
    const sessionId = getSessionId(request);
    await cartService.clearCart(organizationSlug, customerId, sessionId);

    return responseWithSessionCookie(request, sessionId, { success: true });
  } catch (error) {
    console.error("Error clearing cart:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}
