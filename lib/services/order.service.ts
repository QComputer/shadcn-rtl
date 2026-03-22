import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
//import { createOrderSchema, updateOrderStatusSchema } from "@/lib/validators";
import type { CreateOrderInput, UpdateOrderStatusInput } from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";
import { Decimal } from "@prisma/client/runtime/library";
import { OrderStatus, Progress } from "@prisma/client";
// TODO: Notifications:
// 1.Accepting Order: setting EstEndTime for preparation by shop admin, setting EstEndTime for pickup and delivery by shop admin, 
// 2.Changing Order Status: notify 
// 3.Delivered

async function createProgress(
  orderId: string,
  type: "PREPARATION" | "PICK_UP" | "DELIVERY",
  duration: number
) {
  const now = new Date();
  const estimatedEndTime = new Date(now.getTime() + duration * 60 * 1000);
  const progress = await prisma.progress.create({
    data: { estimatedEndTime },
  });

  switch (type) {
    case "PREPARATION":
      await prisma.order.update({
        where: { id: orderId },
        data: { preparationProgressId: progress.id },
      });
      break;
    case "PICK_UP":
      await prisma.order.update({
        where: { id: orderId },
        data: { pickupProgressId: progress.id },
      });
      break;
    case "DELIVERY":
      await prisma.order.update({
        where: { id: orderId },
        data: { deliveryProgressId: progress.id },
      });
      break;
  }

  return progress.id;
}

async function createAllProgresses(
  orderId: string,
  durationsInMinutes: number[],
) {
  // dates
  const now = new Date();
  
  const preparationDuration: number = durationsInMinutes[0] | 15;
  const preparationEstimatedEndTime = new Date(now.getTime() + preparationDuration * 60 * 1000);

  const pickupDuration: number = durationsInMinutes[1] | 5;
  const pickupEstimatedEndTime = new Date(preparationEstimatedEndTime.getTime() + pickupDuration * 60 * 1000);
  
  const deliveryDuration: number = durationsInMinutes[2] | 10;
  const deliveryEstimatedEndTime = new Date(pickupEstimatedEndTime.getTime() + deliveryDuration * 60 * 1000);
  

  const preparationProgress = await prisma.progress.create({
    data: { estimatedEndTime: preparationEstimatedEndTime},
  });
  const pickupProgress = await prisma.progress.create({
    data: { estimatedEndTime: pickupEstimatedEndTime},
  });
  const deliveryProgress = await prisma.progress.create({
    data: { estimatedEndTime: deliveryEstimatedEndTime},
  });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      preparationProgressId: preparationProgress.id,
      pickupProgressId: pickupProgress.id,
      deliveryProgressId: deliveryProgress.id,
    },
  });

  return { preparationProgress, pickupProgress, deliveryProgress };
}
async function updateProgress(
  orderId: string,
  type: "PREPARATION" | "PICK_UP" | "DELIVERY",
  estimatedEndTime: Date,
) {
  const progressId = await getProgressId(orderId, type);
  if (!progressId) return null;

  const progress = await prisma.progress.update({
    where: { id: progressId },
    data: { estimatedEndTime },
  });
  
  return progress;
}

async function getProgress(
  orderId: string,
  type: "PREPARATION" | "PICK_UP" | "DELIVERY",
) {
  const progressId = await getProgressId(orderId, type)
  if (!progressId) return null
  const progress = await prisma.progress.findFirst({
    where: { id: progressId },
  });
  return progress;
}
async function getProgressId(
  orderId: string,
  type: "PREPARATION" | "PICK_UP" | "DELIVERY",
) {
  let progressId: string | null = null;
  let order;
  switch (type) {
    case "PREPARATION":
      order = await prisma.order.findFirst({
        where: { id: orderId },
        select: { preparationProgressId: true },
      });
      if (!order?.preparationProgressId) return null;
      progressId = await order.preparationProgressId;
      break;
    case "PICK_UP":
      order = await prisma.order.findFirst({
        where: { id: orderId },
        select: { pickupProgressId: true },
      });
      if (!order?.pickupProgressId) return null;
      progressId = await order.pickupProgressId;
      break;
    case "DELIVERY":
      order = await prisma.order.findFirst({
        where: { id: orderId },
        select: { deliveryProgressId: true },
      });
      if (!order?.deliveryProgressId) return null;
      progressId = await order.deliveryProgressId;
      break;
  }

  return progressId;
}

export class OrderService {
  async create(
    data: CreateOrderInput & { customerId: string; guestCustomerId?: string },
  ) {

    console.log("=====================OrderService>create====================");

    const {
      organizationId,
      customerId,
      guestCustomerId,
      autoCompleteEndTimes,
      promotionCode,
      ...orderData
    } = data;

    console.log("-------------------------------->order data:", data);

    // Get cart for user
    const cart = await prisma.shopCart.findUnique({
      where: {
        organizationId_customerId: { organizationId, customerId },
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // Calculate totals
    let subtotal = new Decimal(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderItems: any[] = [];

    for (const item of cart.items) {
      const price = item.variant.price ?? item.variant.product.basePrice;
      const itemTotal = price.mul(item.quantity);
      subtotal = subtotal.add(itemTotal);

      orderItems.push({
        quantity: item.quantity,
        price,
        productId: item.variant.productId,
        variantId: item.variantId,
      });

      // Reserve inventory
      await prisma.productVariant.update({
        where: { id: item.variantId },
        data: {
          inventory: {
            decrement: item.quantity,
          },
        },
      });
    }

    // Apply promotion if provided
    let discount = new Decimal(0);
    let promotionId: string | undefined;

    if (promotionCode) {
      const promotion = await prisma.promotion.findFirst({
        where: {
          code: promotionCode,
          organizationId,
          isActive: true,
          startsAt: { lte: new Date() },
          expiresAt: { gte: new Date() },
          OR: [
            { maxUses: null },
            { usedCount: { lt: prisma.promotion.fields.maxUses } },
          ],
        },
      });

      if (promotion) {
        promotionId = promotion.id;
        if (promotion.discountType === "percentage") {
          discount = subtotal.mul(promotion.discountValue).div(100);
        } else {
          discount = promotion.discountValue;
        }

        // Increment promotion usage
        await prisma.promotion.update({
          where: { id: promotion.id },
          data: { usedCount: { increment: 1 } },
        });
      }
    }

    // Get delivery fee from settings if delivery
    let deliveryFee = new Decimal(0);
    if (data.type === "DELIVERY") {
      const settings = await prisma.organizationSettings.findUnique({
        where: { organizationId },
      });
      if (settings) {
        deliveryFee = new Decimal(settings.deliveryRadius ? 5.0 : 0);
      }
    }

    const total = subtotal.add(deliveryFee).sub(discount);

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
console.log('-------------------------------->preparationEstimatedEndTime');
console.log(preparationEstimatedEndTime);
    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create order with transaction
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

      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          type: orderData.type,
          status: "PENDING",
          subtotal,
          deliveryFee,
          discount,
          total,
          deliveryAddress: orderData.deliveryAddress,
          notes: orderData.notes,
          organizationId,
          customerId,
          guestCustomerId,
          preparationProgressId: preparationProgress.id,
          pickupProgressId: pickupProgress.id,
          deliveryProgressId: deliveryProgress.id,
          promotionId,
          promotionCode,
          paymentMethod: data.paymentMethod,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              firstName: true,
              lastName: true,
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

      // Update cart status
      await tx.shopCart.update({
        where: { id: cart.id },
        data: { status: "CHECKED_OUT" },
      });

      return newOrder;
    });

    revalidatePath(`/dashboard/orders`);
    revalidatePath(`/organization/${order.organization.slug}/orders`);
    return order;
  }

  async getById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        guestCustomer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        preparationProgress: {
          select: {
            id: true,
            endTime: true,
            estimatedEndTime: true,
          },
        },
        pickupProgress: {
          select: {
            id: true,
            endTime: true,
            estimatedEndTime: true,
          },
        },
        deliveryProgress: {
          select: {
            id: true,
            endTime: true,
            estimatedEndTime: true,
          },
        },
        assignedDriver: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        payment: true,
        promotion: true,
      },
    });
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    organizationId?: string;
    customerId?: string;
    guestCustomerId?: string;
    driverId?: string;
    status?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const {
      page = 1,
      pageSize = 20,
      organizationId,
      customerId,
      guestCustomerId,
      driverId,
      status,
      type,
      fromDate,
      toDate,
    } = params;

    const where: Record<string, unknown> = {};

    if (organizationId) where.organizationId = organizationId;
    if (customerId) where.customerId = customerId;
    if (guestCustomerId) where.guestCustomerId = guestCustomerId;
    if (driverId) where.driverId = driverId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate)
        (where.createdAt as Record<string, Date>).gte = new Date(fromDate);
      if (toDate)
        (where.createdAt as Record<string, Date>).lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          guestCustomer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          assignedDriver: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
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
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateStatus(
    id: string,
    data: UpdateOrderStatusInput,
    userRole: UserRole,
    userId: string,
  ) {
    if (!hasPermission(userRole, "order:update")) {
      throw new Error("Unauthorized");
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: data.status as OrderStatus,
        ...(data.status === "DELIVERED" && { deliveredAt: new Date() }),
      },
    });

    // If order is cancelled, restore inventory
    if (data.status === "REFUNDED" || data.status === "CANCELLED") {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: id },
      });

      for (const item of orderItems) {
        if (item.variantId) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: {
              inventory: {
                increment: item.quantity,
              },
            },
          });
        }
      }
    }

    revalidatePath(`/dashboard/orders/${id}`);
    return order;
  }
  
  async updateEstimatedEndTime(
    id: string,
    userRole: UserRole,
    type: "PREPARATION" | "PICK_UP" | "DELIVERY",
    estimatedEndTime: Date,
    userId?: string,
  ) {
    if (!hasPermission(userRole, "order:update")) {
      throw new Error("Unauthorized");
    }
    const progress = await updateProgress(id, type, estimatedEndTime)
    return progress;
  }

  async assignDriver(orderId: string, driverId: string, userRole: UserRole) {
    if (!hasPermission(userRole, "order:assign_driver")) {
      throw new Error("Unauthorized");
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId,
        status: "ACCEPTED",
      },
    });

    revalidatePath(`/dashboard/orders/${orderId}`);
    return order;
  }

  async getDriverOrders(driverId: string) {
    return prisma.order.findMany({
      where: {
        OR: [{ driverId }, { status: { in: ["READY", "PICKED_UP"] } }],
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const orderService = new OrderService();
