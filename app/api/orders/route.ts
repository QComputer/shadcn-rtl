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
// Generate a unique order name
function generateGuestUserName(name: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `GUEST-${timestamp}-${name}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = orderFilterSchema.parse(searchParams);

    // Auto-filter by organization for staff users (not SUPER_ADMIN)
    if (session.user?.role && 
        !["SUPER_ADMIN", "CUSTOMER", "DRIVER"].includes(session.user.role) && 
        !params.organizationId) {
      // Get user's organization membership
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
        customerId: session.user!.id,
      });
    } else if (session.user?.role === "DRIVER") {
      orders = await orderService.list({
        ...params,
        driverId: session.user!.id,
      });
    } else {
      // Admin, Manager, Staff can see all orders for their organizations
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
    const {
      organizationId,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      city,
      postalCode,
      notes,
      items,
    } = body;

    const session = await auth();
    let customerId = session?.user?.id;
    let guestCustomerId = null;
    let guestCustomer;
    const data = createOrderSchema.parse(body);

    if (!customerId) {
      // Create or find guest customer
      if (customerPhone) {
        guestCustomer = await prisma.guestCustomer.findFirst({
          where: {
            phone: customerPhone,
          },
        });
      } else if (customerEmail){
        guestCustomer = await prisma.guestCustomer.findFirst({
          where: {
            email: customerEmail,
          },
        });
      }
      if (!guestCustomer) {
        const name = generateGuestUserName(customerName);
        const sessionId = getSessionId(request);
        guestCustomer = await prisma.guestCustomer.create({
          data: {
            name,
            sessionId,
            phone: customerPhone || null,
            email: customerEmail || null,
            address: shippingAddress || null,
          },
        });
        guestCustomerId = guestCustomer.id
      console.log("-------------------------->guestCustomerId:",guestCustomerId);

      }
      
      const order = await orderService.create({
        ...data,
        customerId: guestCustomer.name,
        guestCustomerId: guestCustomer.id,
      });
      console.log("-------------------------->order:", order);

      return NextResponse.json(order, { status: 201 });
    } else {
      const order = await orderService.create({
        ...data,
        customerId,
      });
    return NextResponse.json(order, { status: 201 });
    }  
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
