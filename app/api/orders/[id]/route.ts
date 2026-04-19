// TODO: check the progress updating communication with frontend

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orderService } from "@/lib/services/order.service";
import { updateOrderStatusSchema } from "@/lib/validators";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order = await orderService.getById(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check access - customer can only see their own orders
    if (
      session.user.role === "CUSTOMER" &&
      order.customerId !== session.user.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check access - driver can only see their assigned orders
    if (
      session.user.role === "DRIVER" &&
      (!!order.driverId && order.driverId !== session.user.id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error getting order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// to update the status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateOrderStatusSchema.parse(body);

    const order = await orderService.updateStatus(
      id,
      data,
      session.user.role,
      session.user.id
    );

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// to update the progresses
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user || !session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "DRIVER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { estimatedEndTime, type } = body;

    const order = await prisma.order.findUnique({where:{ id }});
    if(!order){
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Filter access
    if (session.user.role=="DRIVER" && (type=="PREPARING" || order.driverId !== session.user.id)){
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (
      (session.user.role == "ADMIN" || session.user.role == "MANAGER") &&
      ((type == "PICK_UP" || type == "DELIVERY") || order.organizationId !== session.user.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
//console.log("--------------->api/orders/[id]/route>PATCH:", order);

    const product = await orderService.updateEstimatedEndTime(id, session.user.role, type, new Date(estimatedEndTime), session.user.id);

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error updating progress:", error);
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

    // Only admins can cancel orders
    if (!session.user.role || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await orderService.updateStatus(
      id,
      { status: "CANCELLED" },
      session.user.role,
      session.user.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
