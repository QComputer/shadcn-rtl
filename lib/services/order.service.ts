import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createOrderSchema, updateOrderStatusSchema } from "@/lib/validators";
import type { CreateOrderInput, UpdateOrderStatusInput } from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";
import { Decimal } from "@prisma/client/runtime/library";
import { OrderStatus } from "@prisma/client";

export class OrderService {
  async create(data: CreateOrderInput & { customerId: string }) {
    const { organizationId, customerId, promotionCode, ...orderData } = data;

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
        deliveryFee = new Decimal(settings.deliveryRadius ? 5.00 : 0);
      }
    }

    const total = subtotal.add(deliveryFee).sub(discount);

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create order with transaction
    const order = await prisma.$transaction(async (tx) => {
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
              email: true,
              firstName: true,
              lastName: true,
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
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        assignedDriver: {
          select: {
            id: true,
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
    driverId?: string;
    status?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const { page = 1, pageSize = 20, organizationId, customerId, driverId, status, type, fromDate, toDate } = params;

    const where: Record<string, unknown> = {};

    if (organizationId) where.organizationId = organizationId;
    if (customerId) where.customerId = customerId;
    if (driverId) where.driverId = driverId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, Date>).gte = new Date(fromDate);
      if (toDate) (where.createdAt as Record<string, Date>).lte = new Date(toDate);
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
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          assignedDriver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
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

  async updateStatus(id: string, data: UpdateOrderStatusInput, userRole: UserRole, userId: string) {
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
        OR: [
          { driverId },
          { status: { in: ["READY", "PICKED_UP"] } },
        ],
      },
      include: {
        customer: {
          select: {
            id: true,
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
