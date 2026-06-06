import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import type { CreateOrderInput, UpdateOrderStatusInput } from "@/lib/validators";
import { hasPermission, type UserRole } from "@/lib/types";
import { Decimal } from "@prisma/client/runtime/library";
import { InventoryMovementReason, OrderStatus, PaymentMethod, PaymentStatus, type InventoryMovementReason as InventoryMovementReasonType, type Prisma } from "@prisma/client";
// TODO: Notifications:
//        1.Accepting Order: setting EstEndTime for preparation by shop admin, setting EstEndTime for pickup and delivery by shop admin, 
//        2.Changing Order Status: notify 
//        3.Delivered

const ALLOWED_ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PLACED", "ACCEPTED", "CANCELLED"],
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "READY", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP", "DELIVERED", "CANCELLED"],
  PICKED_UP: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["REFUNDED"],
  RECEIVED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};


function generatePublicTrackingToken() {
  return randomBytes(24).toString("base64url");
}

function assertAllowedStatusTransition(currentStatus: OrderStatus, nextStatus: OrderStatus) {
  if (currentStatus === nextStatus) return;

  const allowed = ALLOWED_ORDER_STATUS_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid order status transition: ${currentStatus} -> ${nextStatus}`);
  }
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
  private async getDeliveryFee(organizationSlug: string, type: string) {
    if (type !== "DELIVERY") return new Decimal(0);

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationSlug },
    });

    return new Decimal(settings?.deliveryFee ?? 0);
  }

  private buildProgressEstimates() {
    const now = new Date();
    const preparationDuration = 15;
    const pickupDuration = 5;
    const deliveryDuration = 10;

    const preparationEstimatedEndTime = new Date(
      now.getTime() + preparationDuration * 60 * 1000,
    );
    const pickupEstimatedEndTime = new Date(
      preparationEstimatedEndTime.getTime() + pickupDuration * 60 * 1000,
    );
    const deliveryEstimatedEndTime = new Date(
      pickupEstimatedEndTime.getTime() + deliveryDuration * 60 * 1000,
    );

    return {
      preparationEstimatedEndTime,
      pickupEstimatedEndTime,
      deliveryEstimatedEndTime,
    };
  }

  private calculateDiscount(subtotal: Decimal, promotion: { discountType: string; discountValue: Decimal }) {
    const discount = promotion.discountType === "percentage"
      ? subtotal.mul(promotion.discountValue).div(100)
      : promotion.discountValue;

    return discount.gt(subtotal) ? subtotal : discount;
  }

  private async createOrderStatusHistory(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      previousStatus?: OrderStatus | null;
      newStatus: OrderStatus;
      changedById?: string | null;
      note?: string | null;
    },
  ) {
    return tx.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus,
        changedById: input.changedById ?? null,
        note: input.note ?? null,
      },
    });
  }


  private async createInventoryMovement(
    tx: Prisma.TransactionClient,
    input: {
      variantId: string;
      orderId?: string | null;
      quantityDelta: number;
      quantityBefore?: number | null;
      quantityAfter?: number | null;
      reason: InventoryMovementReason;
      note?: string | null;
      createdById?: string | null;
    },
  ) {
    return tx.inventoryMovement.create({
      data: {
        variantId: input.variantId,
        orderId: input.orderId ?? null,
        quantityDelta: input.quantityDelta,
        quantityBefore: input.quantityBefore ?? null,
        quantityAfter: input.quantityAfter ?? null,
        reason: input.reason,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
    });
  }

  private async decrementOrderInventory(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      items: Array<{ variantId: string; quantity: number; variant: { allowBackOrder: boolean; product: { trackInventory: boolean } } }>;
      actorUserId?: string | null;
      note: string;
    },
  ) {
    for (const item of input.items) {
      if (!item.variant.product.trackInventory) continue;

      const inventoryUpdate = await tx.productVariant.updateMany({
        where: {
          id: item.variantId,
          deletedAt: null,
          ...(item.variant.allowBackOrder ? {} : { inventory: { gte: item.quantity } }),
        },
        data: {
          inventory: {
            decrement: item.quantity,
          },
        },
      });

      if (inventoryUpdate.count !== 1) {
        throw new Error("Insufficient inventory");
      }

      const updatedVariant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { inventory: true },
      });

      await this.createInventoryMovement(tx, {
        variantId: item.variantId,
        orderId: input.orderId,
        quantityDelta: -item.quantity,
        quantityBefore: updatedVariant ? updatedVariant.inventory + item.quantity : null,
        quantityAfter: updatedVariant?.inventory ?? null,
        reason: InventoryMovementReason.ORDER_CREATED,
        note: input.note,
        createdById: input.actorUserId ?? null,
      });
    }
  }

  private async restoreOrderInventory(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      items: Array<{ variantId: string | null; quantity: number }>;
      reason: Extract<InventoryMovementReasonType, "ORDER_CANCELLED" | "ORDER_REFUNDED">;
      actorUserId?: string | null;
      note: string;
    },
  ) {
    const existingRestore = await tx.inventoryMovement.count({
      where: {
        orderId: input.orderId,
        reason: { in: [InventoryMovementReason.ORDER_CANCELLED, InventoryMovementReason.ORDER_REFUNDED] },
      },
    });

    if (existingRestore > 0) {
      return;
    }

    for (const item of input.items) {
      if (!item.variantId) continue;

      const updatedVariant = await tx.productVariant.update({
        where: { id: item.variantId },
        data: {
          inventory: {
            increment: item.quantity,
          },
        },
        select: { inventory: true },
      });

      await this.createInventoryMovement(tx, {
        variantId: item.variantId,
        orderId: input.orderId,
        quantityDelta: item.quantity,
        quantityBefore: updatedVariant.inventory - item.quantity,
        quantityAfter: updatedVariant.inventory,
        reason: input.reason,
        note: input.note,
        createdById: input.actorUserId ?? null,
      });
    }
  }

  private async createPaymentEvent(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      previousStatus?: PaymentStatus | null;
      newStatus: PaymentStatus;
      method?: PaymentMethod | null;
      amount?: Decimal | null;
      transactionId?: string | null;
      note?: string | null;
      createdById?: string | null;
    },
  ) {
    return tx.paymentEvent.create({
      data: {
        orderId: input.orderId,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus,
        method: input.method ?? null,
        amount: input.amount ?? null,
        transactionId: input.transactionId ?? null,
        note: input.note ?? null,
        createdById: input.createdById ?? null,
      },
    });
  }

  async create(data: CreateOrderInput, customerId: string) {
    const { organizationSlug, promotionCode, ...orderData } = data;

    const cart = await prisma.shopCart.findUnique({
      where: {
        organizationSlug_customerId: { organizationSlug, customerId },
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

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const publicTrackingToken = generatePublicTrackingToken();
    const {
      preparationEstimatedEndTime,
      pickupEstimatedEndTime,
      deliveryEstimatedEndTime,
    } = this.buildProgressEstimates();

    const order = await prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      const orderItems = [];

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
      }

      let discount = new Decimal(0);
      let promotionId: string | undefined;

      if (promotionCode) {
        const promotion = await tx.promotion.findFirst({
          where: {
            code: promotionCode,
            organizationSlug,
            isActive: true,
            startsAt: { lte: new Date() },
            expiresAt: { gte: new Date() },
          },
        });

        if (!promotion) {
          throw new Error("Promotion not found or expired");
        }

        if (promotion.minOrderAmount && subtotal.lt(promotion.minOrderAmount)) {
          throw new Error("Order subtotal is below promotion minimum amount");
        }

        if (promotion.maxUses !== null && promotion.usedCount >= promotion.maxUses) {
          throw new Error("Promotion usage limit reached");
        }

        const promotionUpdate = await tx.promotion.updateMany({
          where: {
            id: promotion.id,
            ...(promotion.maxUses === null
              ? {}
              : { usedCount: { lt: promotion.maxUses } }),
          },
          data: { usedCount: { increment: 1 } },
        });

        if (promotionUpdate.count !== 1) {
          throw new Error("Promotion usage limit reached");
        }

        promotionId = promotion.id;
        discount = this.calculateDiscount(subtotal, promotion);
      }

      const deliveryFee = await this.getDeliveryFee(organizationSlug, data.type);
      const total = subtotal.add(deliveryFee).sub(discount);

      const preparationProgress = await tx.progress.create({
        data: { estimatedEndTime: preparationEstimatedEndTime },
      });
      const pickupProgress = await tx.progress.create({
        data: { estimatedEndTime: pickupEstimatedEndTime },
      });
      const deliveryProgress = await tx.progress.create({
        data: { estimatedEndTime: deliveryEstimatedEndTime },
      });

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
          organizationSlug,
          publicTrackingToken,
          customerId,
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
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              members: true,
            },
          },
        },
      });

      await this.decrementOrderInventory(tx, {
        orderId: newOrder.id,
        items: cart.items,
        actorUserId: customerId,
        note: "Inventory decremented during registered order checkout",
      });

      await this.createOrderStatusHistory(tx, {
        orderId: newOrder.id,
        previousStatus: null,
        newStatus: newOrder.status,
        changedById: customerId,
        note: "Order created",
      });

      await this.createPaymentEvent(tx, {
        orderId: newOrder.id,
        previousStatus: null,
        newStatus: newOrder.paymentStatus,
        method: newOrder.paymentMethod,
        amount: newOrder.total,
        createdById: customerId,
        note: "Payment initialized during order creation",
      });

      await tx.shopCartItem.deleteMany({
        where: { cartId: cart.id },
      });

      await tx.shopCart.update({
        where: { id: cart.id },
        data: { status: "ACTIVE" },
      });

      await Promise.all(
        newOrder.organization.members.map((member) =>
          tx.notification.create({
            data: {
              targetUserId: member.userId,
              context: "سفارش جدید ثبت شد",
              seen: false,
            },
          }),
        ),
      );

      return newOrder;
    });

    revalidatePath(`/dashboard/orders`);
    revalidatePath(`/shop/${order.organization.slug}/order/${order.orderNumber}`);
    return order;
  }

  async createForGuest(data: CreateOrderInput, sessionId: string) {
    const {
      organizationSlug,
      promotionCode,
      customerName,
      customerPhone,
      ...orderData
    } = data;

    if (!sessionId) {
      throw new Error("Guest session is required");
    }

    const cart = await prisma.shopCart.findUnique({
      where: {
        organizationSlug_sessionId: { organizationSlug, sessionId },
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

    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const publicTrackingToken = generatePublicTrackingToken();
    const {
      preparationEstimatedEndTime,
      pickupEstimatedEndTime,
      deliveryEstimatedEndTime,
    } = this.buildProgressEstimates();

    const order = await prisma.$transaction(async (tx) => {
      let subtotal = new Decimal(0);
      const orderItems = [];

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
      }

      let discount = new Decimal(0);
      let promotionId: string | undefined;

      if (promotionCode) {
        const promotion = await tx.promotion.findFirst({
          where: {
            code: promotionCode,
            organizationSlug,
            isActive: true,
            startsAt: { lte: new Date() },
            expiresAt: { gte: new Date() },
          },
        });

        if (!promotion) {
          throw new Error("Promotion not found or expired");
        }

        if (promotion.minOrderAmount && subtotal.lt(promotion.minOrderAmount)) {
          throw new Error("Order subtotal is below promotion minimum amount");
        }

        if (promotion.maxUses !== null && promotion.usedCount >= promotion.maxUses) {
          throw new Error("Promotion usage limit reached");
        }

        const promotionUpdate = await tx.promotion.updateMany({
          where: {
            id: promotion.id,
            ...(promotion.maxUses === null
              ? {}
              : { usedCount: { lt: promotion.maxUses } }),
          },
          data: { usedCount: { increment: 1 } },
        });

        if (promotionUpdate.count !== 1) {
          throw new Error("Promotion usage limit reached");
        }

        promotionId = promotion.id;
        discount = this.calculateDiscount(subtotal, promotion);
      }

      const deliveryFee = await this.getDeliveryFee(organizationSlug, data.type);
      const total = subtotal.add(deliveryFee).sub(discount);

      const guestCustomer = await tx.guestCustomer.upsert({
        where: { sessionId },
        update: {
          name: customerName || "مهمان",
          phone: customerPhone,
          address: orderData.deliveryAddress,
        },
        create: {
          sessionId,
          name: customerName || "مهمان",
          phone: customerPhone,
          address: orderData.deliveryAddress,
        },
      });

      const preparationProgress = await tx.progress.create({
        data: { estimatedEndTime: preparationEstimatedEndTime },
      });
      const pickupProgress = await tx.progress.create({
        data: { estimatedEndTime: pickupEstimatedEndTime },
      });
      const deliveryProgress = await tx.progress.create({
        data: { estimatedEndTime: deliveryEstimatedEndTime },
      });

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
          organizationSlug,
          publicTrackingToken,
          guestCustomerId: guestCustomer.id,
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
          guestCustomer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              members: true,
            },
          },
        },
      });


      await this.decrementOrderInventory(tx, {
        orderId: newOrder.id,
        items: cart.items,
        actorUserId: null,
        note: "Inventory decremented during guest order checkout",
      });

      await this.createOrderStatusHistory(tx, {
        orderId: newOrder.id,
        previousStatus: null,
        newStatus: newOrder.status,
        changedById: null,
        note: "Guest order created",
      });

      await this.createPaymentEvent(tx, {
        orderId: newOrder.id,
        previousStatus: null,
        newStatus: newOrder.paymentStatus,
        method: newOrder.paymentMethod,
        amount: newOrder.total,
        createdById: null,
        note: "Payment initialized during guest order creation",
      });
      await tx.shopCartItem.deleteMany({
        where: { cartId: cart.id },
      });

      await tx.shopCart.update({
        where: { id: cart.id },
        data: { status: "ACTIVE" },
      });

      await Promise.all(
        newOrder.organization.members.map((member) =>
          tx.notification.create({
            data: {
              targetUserId: member.userId,
              context: "سفارش جدید ثبت شد",
              seen: false,
            },
          }),
        ),
      );

      return newOrder;
    });

    revalidatePath(`/dashboard/orders`);
    revalidatePath(`/shop/${order.organization.slug}/order/${order.orderNumber}`);
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
        paymentEvents: { orderBy: { createdAt: "desc" } },
        statusHistory: { orderBy: { createdAt: "desc" } },
        promotion: true,
      },
    });
  }

  async listAll(params: {
    page?: number;
    pageSize?: number;
    organizationSlug?: string;
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
      organizationSlug,
      customerId,
      guestCustomerId,
      driverId,
      status,
      type,
      fromDate,
      toDate,
    } = params;

    const where: Record<string, unknown> = {};

    if (organizationSlug) where.organizationSlug = organizationSlug;
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
              firstName: true,
              lastName: true,
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

  async list(params: {
    page?: number;
    pageSize?: number;
    organizationSlug?: string;
    customerId?: string;
    guestCustomerId?: string;
    driverId?: string;
    status?: string;
    type?: string;
    fromDate?: string;
    toDate?: string;
  }, organizationId: string) {
    const {
      page = 1,
      pageSize = 20,
      organizationSlug,
      customerId,
      guestCustomerId,
      driverId,
      status,
      type,
      fromDate,
      toDate,
    } = params;
const org = await prisma.organization.findUnique({
  where: {id: organizationId},
  select: {slug: true}
})
if (!org?.slug) return
    const where: Record<string, unknown> = {};

    where.organizationSlug = org.slug;
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
              firstName: true,
              lastName: true,
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

  async listForDriver(
    params: {
      page?: number;
      pageSize?: number;
      organizationSlug?: string;
      customerId?: string;
      guestCustomerId?: string;
      status?: string;
      type?: string;
      fromDate?: string;
      toDate?: string;
    },
    driverId: string,
  ) {
    const {
      page = 1,
      pageSize = 20,
      organizationSlug,
      customerId,
      guestCustomerId,
      status,
      type,
      fromDate,
      toDate,
    } = params;

    const baseWhere: Prisma.OrderWhereInput = {};

    if (organizationSlug) {
      baseWhere.organizationSlug = organizationSlug;
    }
    if (customerId) baseWhere.customerId = customerId;
    if (guestCustomerId) baseWhere.guestCustomerId = guestCustomerId;
    if (type) baseWhere.type = type as "DELIVERY" | "PICK_UP";
    if (fromDate || toDate) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (fromDate) createdAt.gte = new Date(fromDate);
      if (toDate) createdAt.lte = new Date(toDate);
      baseWhere.createdAt = createdAt;
    }

    const validStatuses = Object.values(OrderStatus);
    if (status && !validStatuses.includes(status as OrderStatus)) {
      throw new Error("Invalid order status filter");
    }

    const assignedWhere: Prisma.OrderWhereInput = {
      ...baseWhere,
      driverId,
      ...(status ? { status: status as OrderStatus } : {}),
    };

    const driverAvailableStatuses: OrderStatus[] = [
      "ACCEPTED",
      "PREPARING",
      "READY",
      "PICKED_UP",
    ];
    const includeAvailable = !status || driverAvailableStatuses.includes(status as OrderStatus);
    const availableWhere: Prisma.OrderWhereInput | null = includeAvailable
      ? {
          ...baseWhere,
          driverId: null,
          status: status ? (status as OrderStatus) : { in: driverAvailableStatuses },
          denies: { none: { userId: driverId } },
        }
      : null;

    const orderWhere: Prisma.OrderWhereInput = {
      OR: availableWhere ? [assignedWhere, availableWhere] : [assignedWhere],
    };

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          organization: {
            select: {
              id: true,
              slug: true,
              name: true,
              logo: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
            },
          },
          guestCustomer: {
            select: {
              id: true,
              name: true,
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
          denies: true,
        },
      }),
      prisma.order.count({ where: orderWhere }),
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

    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingOrder) {
        throw new Error("Order not found");
      }

      const nextStatus = data.status as OrderStatus;
      assertAllowedStatusTransition(existingOrder.status, nextStatus);

      const shouldRestoreInventory =
        ["REFUNDED", "CANCELLED"].includes(nextStatus) &&
        !["REFUNDED", "CANCELLED"].includes(existingOrder.status);

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextStatus === "DELIVERED" && { deliveredAt: new Date() }),
        },
      });

      await this.createOrderStatusHistory(tx, {
        orderId: id,
        previousStatus: existingOrder.status,
        newStatus: nextStatus,
        changedById: userId,
        note: data.status === "CANCELLED" ? "Order cancelled" : "Order status updated",
      });

      if (shouldRestoreInventory) {
        await this.restoreOrderInventory(tx, {
          orderId: existingOrder.id,
          items: existingOrder.items,
          reason: nextStatus === "REFUNDED"
            ? InventoryMovementReason.ORDER_REFUNDED
            : InventoryMovementReason.ORDER_CANCELLED,
          actorUserId: userId,
          note: nextStatus === "REFUNDED"
            ? "Inventory restored after order refund"
            : "Inventory restored after order cancellation",
        });
      }

      return updatedOrder;
    });

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
    //console.log("----------------------estimatedEndTime:", estimatedEndTime);

    const progress = await updateProgress(id, type, estimatedEndTime);

    return progress;
  }

  async updatePaymentStatus(
    orderId: string,
    input: {
      status: PaymentStatus;
      paymentId?: string | null;
      note?: string | null;
    },
    actorUserId: string,
  ) {
    const order = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          total: true,
          paymentStatus: true,
          paymentMethod: true,
          paymentId: true,
        },
      });

      if (!existingOrder) {
        throw new Error("Order not found");
      }

      const nextStatus = input.status;
      const paidAt = nextStatus === "COMPLETED" ? new Date() : null;

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: nextStatus,
          paymentId: input.paymentId ?? existingOrder.paymentId,
          paidAt,
          payment: {
            upsert: {
              create: {
                amount: existingOrder.total,
                method: existingOrder.paymentMethod ?? "CASH",
                status: nextStatus,
                transactionId: input.paymentId ?? undefined,
                metadata: input.note ? { note: input.note } : undefined,
              },
              update: {
                status: nextStatus,
                transactionId: input.paymentId ?? undefined,
                metadata: input.note ? { note: input.note } : undefined,
              },
            },
          },
        },
        include: { payment: true },
      });

      await this.createPaymentEvent(tx, {
        orderId,
        previousStatus: existingOrder.paymentStatus,
        newStatus: nextStatus,
        method: existingOrder.paymentMethod,
        amount: existingOrder.total,
        transactionId: input.paymentId ?? existingOrder.paymentId,
        note: input.note ?? "Payment status updated",
        createdById: actorUserId,
      });

      return updatedOrder;
    });

    revalidatePath(`/dashboard/orders/${orderId}`);
    return order;
  }

  async assignDriver(orderId: string, driverId: string, userRole: UserRole) {
    if (!hasPermission(userRole, "order:assign_driver")) {
      throw new Error("Unauthorized");
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { driverId },
    });

    revalidatePath(`/dashboard/orders/${orderId}`);
    return order;
  }

  async getDriverOrders(driverId: string) {
    return prisma.order.findMany({
      where: {
        OR: [
          { driverId },
          {
            status: { in: ["ACCEPTED", "PREPARING", "READY"] },
            driverId: null,
          },
        ],
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
        guestCustomer: {
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
        denies: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async acceptOrderByDriver(orderId: string, driverId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { denies: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.driverId === driverId) {
      return order;
    }

    if (order.driverId) {
      throw new Error("Order is already assigned");
    }

    if (!["ACCEPTED", "PREPARING", "READY"].includes(order.status)) {
      throw new Error("Order is not available for driver acceptance");
    }

    if (order.denies.some((deny) => deny.userId === driverId)) {
      throw new Error("Driver has denied this order");
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: driverId,
        organizationSlug: order.organizationSlug,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error("Driver does not belong to this organization");
    }

    const updated = await prisma.order.updateMany({
      where: {
        id: orderId,
        driverId: null,
        status: { in: ["ACCEPTED", "PREPARING", "READY"] },
      },
      data: { driverId },
    });

    if (updated.count !== 1) {
      throw new Error("Order is no longer available");
    }

    revalidatePath(`/dashboard/driver-orders`);
    return prisma.order.findUnique({ where: { id: orderId } });
  }

  async denyOrderByDriver(orderId: string, driverId: string) {
    const deny = await prisma.deny.findUnique({
      where: { orderId_userId: { orderId, userId: driverId } },
    });
    return deny
      ? deny
      : prisma.deny.create({ data: { orderId, userId: driverId } });
  }

  async unDenyOrderByDriver(orderId: string, driverId: string) {
    return prisma.deny.delete({
      where: { orderId_userId: { orderId, userId: driverId } },
    });
  }
}

export const orderService = new OrderService();

