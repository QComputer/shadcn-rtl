import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orderService } from "@/lib/services/order.service";
import { createOrderSchema, orderFilterSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
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
  if (error.message === "Unauthorized") return 401;
  if (error.message.includes("Forbidden")) return 403;
  if (error.message.includes("not found")) return 404;
  if (error.message.includes("Cart is empty")) return 400;
  if (error.message.includes("Insufficient inventory")) return 409;
  if (error.message.includes("Promotion")) return 409;
  return 500;
}

function setGuestSessionCookie(request: NextRequest, sessionId: string, response: NextResponse) {
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

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = orderFilterSchema.parse(searchParams);

    if (
      session.user?.role &&
      !["SUPER_ADMIN", "CUSTOMER", "DRIVER"].includes(session.user.role) &&
      !params.organizationId
    ) {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });

      if (membership) {
        params.organizationId = membership.organizationId;
      }
    }

    let orders;
    if (session.user?.role === "CUSTOMER") {
      orders = await orderService.listAll({
        ...params,
        customerId: session.user.id,
      });
    } else if (session.user.role === "DRIVER") {
      orders = await orderService.listForDriver(params, session.user.id);
    } else if (session.user.role === "SUPER_ADMIN") {
      orders = await orderService.listAll(params);
    } else if (session.user.organizationId) {
      orders = await orderService.list(params, session.user.organizationId);
    }

    return NextResponse.json(orders ?? { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  } catch (error) {
    console.error("Error listing orders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await auth();
    const data = createOrderSchema.parse(body);

    if (data.type === "DELIVERY" && !data.deliveryAddress) {
      return NextResponse.json(
        { error: "Delivery address is required for delivery orders" },
        { status: 400 },
      );
    }

    let order;
    const customerId = session?.user?.id;

    if (customerId) {
      order = await orderService.create(data, customerId);
      return NextResponse.json(order, { status: 201 });
    }

    const sessionId = getSessionId(request);
    order = await orderService.createForGuest(data, sessionId);
    const response = NextResponse.json(order, { status: 201 });
    return setGuestSessionCookie(request, sessionId, response);
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: statusForError(error) },
    );
  }
}
