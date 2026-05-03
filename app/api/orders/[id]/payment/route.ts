// TODO: check the progress updating communication with frontend

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";


// to update the payment status
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

    if (!session.user.role ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {paymentStatus} = body 
    console.log("-------------------->paymentStatus", paymentStatus);
    

    let order = await prisma.order.findUnique({
      where: {id},
      select:{organization: {select: {id: true}}}
    });

    if (!order || session.user.organizationId != order.organization.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    order = await prisma.order.update({
      where: { id },
      data: { paymentStatus: paymentStatus as boolean },
      select: { organization: { select: { id: true } } },
    });

    console.log("-------------------->order", order);


    return NextResponse.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

