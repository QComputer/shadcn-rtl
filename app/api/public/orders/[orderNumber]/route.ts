import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { orderService } from "@/lib/services/order.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        preparationProgress: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            estimatedEndTime: true,
          },
        },
        pickupProgress: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            estimatedEndTime: true,
          },
        },
        deliveryProgress: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            estimatedEndTime: true,
          },
        }
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Public payment updates are intentionally disabled. Payment state must be changed
// only by authenticated dashboard actions or verified payment-provider webhooks.
export async function PUT() {
  return NextResponse.json(
    { error: "Public payment updates are not allowed" },
    { status: 405 },
  );
}
