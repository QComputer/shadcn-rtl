import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "guest_session_id";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const session = await auth();
    const guestSessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;

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
        customer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        guestCustomer: {
          select: {
            id: true,
            name: true,
            phone: true,
            sessionId: true,
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

    const isOwner = Boolean(session?.user?.id && order.customerId === session.user.id);
    const isSameGuestSession = Boolean(
      order.guestCustomer?.sessionId &&
      guestSessionId &&
      order.guestCustomer.sessionId === guestSessionId,
    );
    const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
    const hasOrganizationAccess = Boolean(
      session?.user?.id &&
      (await prisma.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationSlug: order.organizationSlug,
          isActive: true,
        },
        select: { id: true },
      })),
    );

    if (!isOwner && !isSameGuestSession && !isSuperAdmin && !hasOrganizationAccess) {
      return NextResponse.json(
        { error: "Order access requires the original browser session or account" },
        { status: 403 },
      );
    }

    const { guestCustomer, ...safeOrder } = order;

    return NextResponse.json({
      ...safeOrder,
      guestCustomer: guestCustomer
        ? {
            id: guestCustomer.id,
            name: guestCustomer.name,
            phone: guestCustomer.phone,
          }
        : null,
    });
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
