import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orderService } from "@/lib/services/order.service";
import { createOrderSchema, orderFilterSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = orderFilterSchema.parse(searchParams);

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
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createOrderSchema.parse(body);

    const order = await orderService.create({
      ...data,
      customerId: session.user.id,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
