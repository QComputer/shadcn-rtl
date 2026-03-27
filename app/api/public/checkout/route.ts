// TODO: Should be removed, since the checkout page won't communicate with this route anymore

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";

const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || "guest_session_id";

// Get or create session ID from cookies
function getSessionId(request: NextRequest): string {
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME);
  if (existingSessionId) {
    return existingSessionId.value;
  }
  return randomUUID();
}
// Generate a unique order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomUUID().split("-")[0].toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      isGuest,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      city,
      postalCode,
      notes,
      items,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 },
      );
    }

    if (!customerName) {
      return NextResponse.json(
        { error: "Missing required customer information" },
        { status: 400 },
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Order must contain at least one item" },
        { status: 400 },
      );
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Validate items and calculate total
    let subtotal = new Decimal(0);
    const orderItems: Array<{
      productId: string;
      variantId: string;
      quantity: number;
      price: Decimal;
    }> = [];

    for (const item of items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: {
          product: {
            include: { organization: true },
          },
        },
      });

      if (!variant) {
        return NextResponse.json(
          { error: `Product variant ${item.variantId} not found` },
          { status: 404 },
        );
      }

      if (variant.product.organizationId !== organizationId) {
        return NextResponse.json(
          {
            error: `Product ${variant.product.name} does not belong to this organization`,
          },
          { status: 400 },
        );
      }

      // Check inventory if tracked
      if (variant.product.trackInventory && variant.inventory < item.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient inventory for ${variant.product.name} - ${variant.name}`,
          },
          { status: 400 },
        );
      }

      const price = new Decimal(
        item.price || variant.price || variant.product.basePrice,
      );
      subtotal = subtotal.add(price.mul(item.quantity));

      orderItems.push({
        productId: variant.productId,
        variantId: variant.id,
        quantity: item.quantity,
        price,
      });
    }

    // Create or find guest customer
    let guestCustomer = await prisma.guestCustomer.findFirst({
      where: {
        phone: customerPhone,
      },
    });

    if (!guestCustomer) {
        const sessionId = getSessionId(request);

      guestCustomer = await prisma.guestCustomer.create({
        data: {
          sessionId,
          name: customerName,
          phone: customerPhone,
          email: customerEmail || null,
          address: `${shippingAddress}, ${city}, ${postalCode}`,
        },
      });
    } else {
      // Update customer info if provided
      await prisma.guestCustomer.update({
        where: { id: guestCustomer.id },
        data: {
          name: customerName,
          email: customerEmail || guestCustomer.email,
          address: `${shippingAddress}, ${city}, ${postalCode}`,
        },
      });
    }
    const orderNumber = generateOrderNumber();
    const fullAddress = `${shippingAddress}, ${city}, ${postalCode}`;

    // dates
    const durationsInMinutes = [15, 5, 10];
    const now = new Date();
    const preparationDuration: number = durationsInMinutes[0] | 15;
    const preparationEstimatedEndTime = new Date(
      now.getTime() + preparationDuration * 60 * 1000,
    );
    const pickupDuration: number = durationsInMinutes[1] | 5;
    const pickupEstimatedEndTime = new Date(
      preparationEstimatedEndTime.getTime() + pickupDuration * 60 * 1000,
    );
    const deliveryDuration: number = durationsInMinutes[2] | 10;
    const deliveryEstimatedEndTime = new Date(
      pickupEstimatedEndTime.getTime() + deliveryDuration * 60 * 1000,
    );
    console.log("-------------------------------->preparationEstimatedEndTime");
    console.log(preparationEstimatedEndTime);
    
    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create Progresses
      const preparationProgress = await tx.progress.create({
        data: { estimatedEndTime: preparationEstimatedEndTime },
      });
      const pickupProgress = await tx.progress.create({
        data: { estimatedEndTime: pickupEstimatedEndTime },
      });
      const deliveryProgress = await tx.progress.create({
        data: { estimatedEndTime: deliveryEstimatedEndTime },
      });

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: "PICK_UP", // Default to delivery
          status: "PENDING",
          subtotal,
          total: subtotal, // For now, total = subtotal (no tax/delivery fee calculation)
          deliveryAddress: fullAddress,
          notes: notes || null,
          organizationId,
          guestCustomerId: guestCustomer.id,
          preparationProgressId: preparationProgress.id,
          pickupProgressId: pickupProgress.id,
          deliveryProgressId: deliveryProgress.id,

          items: {
            create: orderItems.map((item) => ({
              quantity: item.quantity,
              price: item.price,
              productId: item.productId,
              variantId: item.variantId,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          guestCustomer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      // Update inventory for each item
      for (const item of orderItems) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true },
        });

        if (variant && variant.product.trackInventory) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              inventory: {
                decrement: item.quantity,
              },
            },
          });
        }
      }

      return newOrder;
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
