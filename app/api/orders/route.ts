import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orderService } from "@/lib/services/order.service";
import { createOrderSchema, orderFilterSchema } from "@/lib/validators";
import { prisma } from "@/lib/db";
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

// Generate a unique guest name
function generateGuestUserName(name: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `GUEST-${timestamp}-${name}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session?.user || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = orderFilterSchema.parse(searchParams);

    // Auto-filter by organization for staff users (not SUPER_ADMIN  "CUSTOMER" and "DRIVER")
    if (session.user?.role && !["SUPER_ADMIN", "CUSTOMER", "DRIVER"].includes(session.user.role) && !params.organizationId) {
      // Get staff's organization membership
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });

      if (membership) {
        params.organizationId = membership.organizationId;
      }
    }

    // Filter by user role
    let orders;
    if (session.user?.role === "CUSTOMER") {
      orders = await orderService.list({
        ...params,
        customerId: session.user.id,
      });
    } else if (session.user.role === "DRIVER") {
      orders = await orderService.listForDriver(params, session.user.id);
      //console.log("---------------------orders", orders);
      
    } else {
      // Super-Admin, Admin, Manager, Staff can see all orders for their organizations
      orders = await orderService.list(params);
    }

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error listing orders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session = await auth();
    //const customerId = session?.user?.id;
    const data = createOrderSchema.parse(body);
    console.log("------------------data:", data);
    

      const sessionId = getSessionId(request);
      const order = await orderService.createForGuest(data, sessionId);
    //console.log("-------------------------->order:", order);
    
    return NextResponse.json(order, { status: 201 });

  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
