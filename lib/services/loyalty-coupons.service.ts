import { CouponDiscountType, Prisma } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"
import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import {
  CUSTOMER_SEGMENT_DEFINITIONS,
  type CustomerSegmentKey,
} from "@/lib/services/customer-segments.service"

export type LoyaltyRuleInput = {
  name: string
  spendAmount: number
  pointsAwarded: number
  pointsPerOrder?: number
  minOrderTotal?: number
  isActive?: boolean
  startsAt?: Date | null
  expiresAt?: Date | null
}

export type CouponInput = {
  code: string
  name: string
  description?: string | null
  discountType: CouponDiscountType
  discountValue: number
  minOrderTotal?: number | null
  maxDiscountAmount?: number | null
  startsAt?: Date | null
  expiresAt?: Date | null
  usageLimit?: number | null
  perCustomerLimit?: number | null
  segmentKey?: CustomerSegmentKey | null
  isActive?: boolean
}

const DEFAULT_LEDGER_LIMIT = 25
const DEFAULT_BALANCE_LIMIT = 20

function toDecimal(value: Decimal | number | string | null | undefined) {
  if (value instanceof Decimal) return value
  return new Decimal(value ?? 0)
}

function toNumber(value: Decimal | number | string | null | undefined) {
  return toDecimal(value).toNumber()
}

function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-")
}

function assertValidDateWindow(startsAt?: Date | null, expiresAt?: Date | null) {
  if (startsAt && expiresAt && startsAt > expiresAt) {
    throw new ApiError(400, "Start date must be before expiration date")
  }
}

export class LoyaltyCouponsService {
  async listLoyaltyProgram(organizationId: string) {
    await this.getOrganizationContext(organizationId)

    const [rules, recentLedger, balanceRows, activeMembers] = await Promise.all([
      prisma.loyaltyRule.findMany({
        where: { organizationId },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      }),
      prisma.loyaltyLedger.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: DEFAULT_LEDGER_LIMIT,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
            },
          },
        },
      }),
      prisma.loyaltyLedger.groupBy({
        by: ["customerId"],
        where: { organizationId },
        _sum: { points: true },
      }),
      prisma.customerClubMembership.count({
        where: { organizationId, status: "ACTIVE" },
      }),
    ])

    const customerIds = balanceRows.map((row) => row.customerId)
    const customers = customerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        })
      : []
    const customerById = new Map(customers.map((customer) => [customer.id, customer]))

    const balances = balanceRows
      .map((row) => ({
        customerId: row.customerId,
        points: row._sum.points ?? 0,
        customer: customerById.get(row.customerId) ?? null,
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, DEFAULT_BALANCE_LIMIT)

    return {
      rules,
      recentLedger,
      balances,
      activeMembers,
      totalOutstandingPoints: balanceRows.reduce((sum, row) => sum + (row._sum.points ?? 0), 0),
    }
  }

  async createLoyaltyRule(organizationId: string, actorUserId: string, input: LoyaltyRuleInput) {
    await this.getOrganizationContext(organizationId)
    assertValidDateWindow(input.startsAt, input.expiresAt)

    if (input.spendAmount <= 0) throw new ApiError(400, "Spend amount must be greater than zero")
    if (input.pointsAwarded <= 0) throw new ApiError(400, "Awarded points must be greater than zero")
    if ((input.pointsPerOrder ?? 0) < 0) throw new ApiError(400, "Points per order cannot be negative")
    if ((input.minOrderTotal ?? 0) < 0) throw new ApiError(400, "Minimum order total cannot be negative")

    const rule = await prisma.loyaltyRule.create({
      data: {
        organizationId,
        name: input.name,
        spendAmount: input.spendAmount,
        pointsAwarded: input.pointsAwarded,
        pointsPerOrder: input.pointsPerOrder ?? 0,
        minOrderTotal: input.minOrderTotal ?? 0,
        isActive: input.isActive ?? true,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "LoyaltyRule",
      entityId: rule.id,
      description: "Loyalty purchase rule created",
      newValue: {
        name: rule.name,
        spendAmount: toNumber(rule.spendAmount),
        pointsAwarded: rule.pointsAwarded,
        pointsPerOrder: rule.pointsPerOrder,
        minOrderTotal: toNumber(rule.minOrderTotal),
      },
      userId: actorUserId,
      organizationId,
    })

    return rule
  }

  async awardPurchasePoints(organizationId: string, actorUserId: string, orderId: string) {
    const organization = await this.getOrganizationContext(organizationId)
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        organizationSlug: organization.slug,
        deletedAt: null,
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        customerId: true,
        status: true,
        paymentStatus: true,
      },
    })

    if (!order) throw new ApiError(404, "Order not found")
    if (!order.customerId) throw new ApiError(400, "Only registered customer orders can earn loyalty points")
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      throw new ApiError(400, "Canceled or refunded orders cannot earn loyalty points")
    }
    if (order.paymentStatus === "FAILED" || order.paymentStatus === "REFUNDED") {
      throw new ApiError(400, "Failed or refunded payments cannot earn loyalty points")
    }

    await this.requireActiveClubMembership(organizationId, order.customerId)

    const existing = await prisma.loyaltyLedger.findFirst({
      where: {
        organizationId,
        orderId,
        type: "EARN",
      },
    })
    if (existing) return existing

    const rule = await this.getActivePurchaseRule(organizationId, toDecimal(order.total))
    const points = this.calculatePurchasePoints(rule, order.total)
    if (points <= 0) throw new ApiError(400, "No loyalty points are available for this order")

    const ledger = await prisma.loyaltyLedger.create({
      data: {
        organizationId,
        customerId: order.customerId,
        orderId,
        type: "EARN",
        points,
        reason: "PURCHASE",
        metadata: {
          orderNumber: order.orderNumber,
          orderTotal: toNumber(order.total),
          ruleId: rule.id,
          ruleName: rule.name,
        } satisfies Prisma.JsonObject,
        createdByUserId: actorUserId,
      },
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "LoyaltyLedger",
      entityId: ledger.id,
      description: "Loyalty points awarded for purchase",
      newValue: {
        orderId,
        customerId: order.customerId,
        points,
      },
      userId: actorUserId,
      organizationId,
    })

    return ledger
  }

  async addManualAdjustment(organizationId: string, actorUserId: string, input: { customerId: string; points: number; reason: string }) {
    await this.getOrganizationContext(organizationId)
    if (!input.customerId) throw new ApiError(400, "Customer ID is required")
    if (!Number.isInteger(input.points) || input.points === 0) throw new ApiError(400, "Adjustment points must be a non-zero integer")
    await this.requireActiveClubMembership(organizationId, input.customerId)

    const ledger = await prisma.loyaltyLedger.create({
      data: {
        organizationId,
        customerId: input.customerId,
        type: "ADJUST",
        points: input.points,
        reason: input.reason,
        createdByUserId: actorUserId,
      },
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "LoyaltyLedger",
      entityId: ledger.id,
      description: "Manual loyalty ledger adjustment created",
      newValue: {
        customerId: input.customerId,
        points: input.points,
        reason: input.reason,
      },
      userId: actorUserId,
      organizationId,
    })

    return ledger
  }

  async listCoupons(organizationId: string) {
    await this.getOrganizationContext(organizationId)

    return prisma.coupon.findMany({
      where: { organizationId },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { redemptions: true } },
        redemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 10,
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            order: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
              },
            },
          },
        },
      },
    })
  }

  async createCoupon(organizationId: string, actorUserId: string, input: CouponInput) {
    await this.getOrganizationContext(organizationId)
    assertValidDateWindow(input.startsAt, input.expiresAt)
    const code = normalizeCouponCode(input.code)
    if (!code) throw new ApiError(400, "Coupon code is required")
    if (input.discountValue <= 0) throw new ApiError(400, "Coupon discount must be greater than zero")
    if (input.discountType === "PERCENTAGE" && input.discountValue > 100) {
      throw new ApiError(400, "Percentage coupons cannot exceed 100")
    }
    if ((input.usageLimit ?? 1) <= 0 && input.usageLimit !== null) {
      throw new ApiError(400, "Usage limit must be greater than zero")
    }
    if ((input.perCustomerLimit ?? 1) <= 0 && input.perCustomerLimit !== null) {
      throw new ApiError(400, "Per-customer limit must be greater than zero")
    }
    if (input.segmentKey && !CUSTOMER_SEGMENT_DEFINITIONS.some((segment) => segment.key === input.segmentKey)) {
      throw new ApiError(400, "Invalid coupon segment")
    }

    const coupon = await prisma.coupon.create({
      data: {
        organizationId,
        code,
        name: input.name,
        description: input.description ?? null,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderTotal: input.minOrderTotal ?? null,
        maxDiscountAmount: input.maxDiscountAmount ?? null,
        startsAt: input.startsAt ?? null,
        expiresAt: input.expiresAt ?? null,
        usageLimit: input.usageLimit ?? null,
        perCustomerLimit: input.perCustomerLimit ?? null,
        segmentKey: input.segmentKey ?? null,
        isActive: input.isActive ?? true,
      },
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "Coupon",
      entityId: coupon.id,
      description: "Organization coupon created",
      newValue: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: toNumber(coupon.discountValue),
        usageLimit: coupon.usageLimit,
        perCustomerLimit: coupon.perCustomerLimit,
        segmentKey: coupon.segmentKey,
      },
      userId: actorUserId,
      organizationId,
    })

    return coupon
  }

  async redeemCoupon(
    organizationId: string,
    actorUserId: string,
    input: { code: string; customerId: string; orderId?: string | null; orderTotal?: number | null; pointsSpent?: number | null },
  ) {
    const organization = await this.getOrganizationContext(organizationId)
    const now = new Date()
    const code = normalizeCouponCode(input.code)

    const coupon = await prisma.coupon.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    })

    if (!coupon || !coupon.isActive) throw new ApiError(404, "Coupon not found")
    if (coupon.startsAt && coupon.startsAt > now) throw new ApiError(400, "Coupon is not active yet")
    if (coupon.expiresAt && coupon.expiresAt < now) throw new ApiError(400, "Coupon has expired")
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new ApiError(409, "Coupon usage limit reached")
    }

    await this.requireActiveClubMembership(organizationId, input.customerId)
    if (coupon.segmentKey) {
      const matchesSegment = await this.customerMatchesSegment(organization, input.customerId, coupon.segmentKey as CustomerSegmentKey)
      if (!matchesSegment) throw new ApiError(403, "Customer is not in the coupon segment")
    }

    const customerRedemptionCount = await prisma.couponRedemption.count({
      where: {
        couponId: coupon.id,
        customerId: input.customerId,
      },
    })
    if (coupon.perCustomerLimit !== null && customerRedemptionCount >= coupon.perCustomerLimit) {
      throw new ApiError(409, "Customer coupon usage limit reached")
    }

    const order = input.orderId
      ? await prisma.order.findFirst({
          where: {
            id: input.orderId,
            organizationSlug: organization.slug,
            customerId: input.customerId,
            deletedAt: null,
            status: { notIn: ["CANCELLED", "REFUNDED"] },
          },
          select: {
            id: true,
            total: true,
            orderNumber: true,
          },
        })
      : null
    if (input.orderId && !order) throw new ApiError(404, "Order not found")

    const orderTotal = toDecimal(order?.total ?? input.orderTotal ?? 0)
    if (coupon.minOrderTotal && orderTotal.lt(coupon.minOrderTotal)) {
      throw new ApiError(400, "Order total is below the coupon minimum")
    }

    const discountAmount = this.calculateCouponDiscount(coupon, orderTotal)
    const redemption = await prisma.$transaction(async (tx) => {
      const couponUpdate = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          organizationId,
          ...(coupon.usageLimit === null ? {} : { usedCount: { lt: coupon.usageLimit } }),
        },
        data: { usedCount: { increment: 1 } },
      })
      if (couponUpdate.count !== 1) throw new ApiError(409, "Coupon usage limit reached")

      return tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          organizationId,
          customerId: input.customerId,
          orderId: order?.id ?? null,
          discountAmount,
          pointsSpent: input.pointsSpent ?? 0,
          metadata: {
            code: coupon.code,
            orderNumber: order?.orderNumber ?? null,
            segmentKey: coupon.segmentKey,
          } satisfies Prisma.JsonObject,
        },
      })
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "CouponRedemption",
      entityId: redemption.id,
      description: "Coupon redeemed",
      newValue: {
        couponId: coupon.id,
        code: coupon.code,
        customerId: input.customerId,
        orderId: order?.id ?? null,
        discountAmount: toNumber(discountAmount),
      },
      userId: actorUserId,
      organizationId,
    })

    return redemption
  }

  private async getOrganizationContext(organizationId: string) {
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
      },
    })

    if (!organization) throw new ApiError(404, "Organization not found")
    return organization
  }

  private async requireActiveClubMembership(organizationId: string, customerId: string) {
    const membership = await prisma.customerClubMembership.findFirst({
      where: {
        organizationId,
        customerId,
        status: "ACTIVE",
        customer: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        tier: true,
        joinedAt: true,
      },
    })

    if (!membership) throw new ApiError(400, "Customer must be an active club member")
    return membership
  }

  private async getActivePurchaseRule(organizationId: string, orderTotal: Decimal) {
    const now = new Date()
    const rule = await prisma.loyaltyRule.findFirst({
      where: {
        organizationId,
        isActive: true,
        minOrderTotal: { lte: orderTotal },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      orderBy: { createdAt: "desc" },
    })

    if (!rule) throw new ApiError(400, "No active loyalty purchase rule is available")
    return rule
  }

  private calculatePurchasePoints(
    rule: { spendAmount: Decimal; pointsAwarded: number; pointsPerOrder: number },
    orderTotal: Decimal,
  ) {
    const spendAmount = toDecimal(rule.spendAmount)
    if (spendAmount.lte(0)) return 0
    return Math.floor(toDecimal(orderTotal).div(spendAmount).toNumber()) * rule.pointsAwarded + rule.pointsPerOrder
  }

  private calculateCouponDiscount(
    coupon: {
      discountType: CouponDiscountType
      discountValue: Decimal
      maxDiscountAmount: Decimal | null
    },
    orderTotal: Decimal,
  ) {
    let discount = coupon.discountType === "PERCENTAGE"
      ? orderTotal.mul(coupon.discountValue).div(100)
      : toDecimal(coupon.discountValue)

    if (coupon.maxDiscountAmount) {
      discount = Decimal.min(discount, coupon.maxDiscountAmount)
    }

    return Decimal.min(discount, orderTotal)
  }

  private async customerMatchesSegment(
    organization: { id: string; slug: string },
    customerId: string,
    segmentKey: CustomerSegmentKey,
  ) {
    const membership = await this.requireActiveClubMembership(organization.id, customerId)
    if (segmentKey === "all_club_members") return true

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    if (segmentKey === "new_members_30d") return membership.joinedAt >= thirtyDaysAgo

    const orders = await prisma.order.findMany({
      where: {
        organizationSlug: organization.slug,
        customerId,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      select: {
        total: true,
        createdAt: true,
      },
    })

    if (segmentKey === "recent_buyers_30d") {
      return orders.some((order) => order.createdAt >= thirtyDaysAgo)
    }
    if (segmentKey === "inactive_60d") {
      return !orders.some((order) => order.createdAt >= sixtyDaysAgo)
    }
    if (segmentKey === "vip_by_revenue") {
      const revenue = orders.reduce((sum, order) => sum + toNumber(order.total), 0)
      return membership.tier === "VIP" || revenue >= 5_000_000
    }
    if (segmentKey === "high_order_count") {
      return orders.length >= 3
    }

    const cart = await prisma.shopCart.findFirst({
      where: {
        organizationSlug: organization.slug,
        customerId,
        status: { in: ["ACTIVE", "ABANDONED"] },
        items: { some: {} },
      },
      select: { id: true },
    })

    return Boolean(cart)
  }
}

export const loyaltyCouponsService = new LoyaltyCouponsService()
