import { Prisma } from "@prisma/client"
import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"

export type CustomerSegmentKey =
  | "all_club_members"
  | "new_members_30d"
  | "recent_buyers_30d"
  | "inactive_60d"
  | "vip_by_revenue"
  | "high_order_count"
  | "abandoned_cart_candidates"

type SegmentDefinition = {
  key: CustomerSegmentKey
  name: string
  description: string
  rule: Prisma.JsonObject
}

export type CustomerSegmentResult = SegmentDefinition & {
  memberCount: number
  latestSnapshot?: {
    memberCount: number
    calculatedAt: Date
  } | null
}

const VIP_REVENUE_THRESHOLD = 5_000_000
const HIGH_ORDER_COUNT_THRESHOLD = 3

export const CUSTOMER_SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  {
    key: "all_club_members",
    name: "All club members",
    description: "All active customer club members.",
    rule: { membershipStatus: "ACTIVE" },
  },
  {
    key: "new_members_30d",
    name: "New members, 30 days",
    description: "Active club members who joined during the last 30 days.",
    rule: { membershipStatus: "ACTIVE", joinedWithinDays: 30 },
  },
  {
    key: "recent_buyers_30d",
    name: "Recent buyers, 30 days",
    description: "Active club members with at least one non-cancelled order in the last 30 days.",
    rule: { membershipStatus: "ACTIVE", orderWithinDays: 30 },
  },
  {
    key: "inactive_60d",
    name: "Inactive, 60 days",
    description: "Active club members without a non-cancelled order in the last 60 days.",
    rule: { membershipStatus: "ACTIVE", noOrderWithinDays: 60 },
  },
  {
    key: "vip_by_revenue",
    name: "VIP by revenue",
    description: `Active club members with VIP tier or at least ${VIP_REVENUE_THRESHOLD} total revenue.`,
    rule: { membershipStatus: "ACTIVE", tier: "VIP", totalRevenueGte: VIP_REVENUE_THRESHOLD },
  },
  {
    key: "high_order_count",
    name: "High order count",
    description: `Active club members with at least ${HIGH_ORDER_COUNT_THRESHOLD} non-cancelled orders.`,
    rule: { membershipStatus: "ACTIVE", orderCountGte: HIGH_ORDER_COUNT_THRESHOLD },
  },
  {
    key: "abandoned_cart_candidates",
    name: "Abandoned cart candidates",
    description: "Active club members with active or abandoned carts that still contain items.",
    rule: { membershipStatus: "ACTIVE", cartStatusIn: ["ACTIVE", "ABANDONED"], cartHasItems: true },
  },
]

export class CustomerSegmentsService {
  async listSegments(organizationId: string): Promise<CustomerSegmentResult[]> {
    const context = await this.getOrganizationContext(organizationId)
    const counts = await this.calculateCounts(context)
    const snapshots = await this.getLatestSnapshots(organizationId)

    return CUSTOMER_SEGMENT_DEFINITIONS.map((definition) => ({
      ...definition,
      memberCount: counts[definition.key] ?? 0,
      latestSnapshot: snapshots.get(definition.key) ?? null,
    }))
  }

  async saveSnapshot(organizationId: string, actorUserId: string) {
    const segments = await this.listSegments(organizationId)

    const savedSegments = await prisma.$transaction(async (tx) => {
      const saved = []

      for (const segment of segments) {
        const persisted = await tx.customerSegment.upsert({
          where: {
            organizationId_key: {
              organizationId,
              key: segment.key,
            },
          },
          update: {
            name: segment.name,
            description: segment.description,
            rule: segment.rule,
            isSystem: true,
            isActive: true,
          },
          create: {
            organizationId,
            key: segment.key,
            name: segment.name,
            description: segment.description,
            rule: segment.rule,
            isSystem: true,
            isActive: true,
          },
        })

        await tx.customerSegmentRule.deleteMany({ where: { segmentId: persisted.id } })
        await tx.customerSegmentRule.create({
          data: {
            segmentId: persisted.id,
            field: "definition",
            operator: "matches",
            value: segment.rule,
          },
        })

        const snapshot = await tx.customerSegmentSnapshot.create({
          data: {
            organizationId,
            segmentId: persisted.id,
            segmentKey: segment.key,
            memberCount: segment.memberCount,
            rule: segment.rule,
          },
        })

        saved.push({ ...segment, segmentId: persisted.id, snapshotId: snapshot.id })
      }

      return saved
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "CustomerSegmentSnapshot",
      entityId: organizationId,
      description: "Customer segment snapshot created",
      newValue: {
        segmentCount: savedSegments.length,
        segments: savedSegments.map((segment) => ({
          key: segment.key,
          memberCount: segment.memberCount,
        })),
      },
      userId: actorUserId,
      organizationId,
    })

    return savedSegments
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

  private async calculateCounts(organization: { id: string; slug: string }) {
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sixtyDaysAgo = new Date(now)
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    const activeMemberships = await prisma.customerClubMembership.findMany({
      where: {
        organizationId: organization.id,
        status: "ACTIVE",
        customer: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        customerId: true,
        tier: true,
        joinedAt: true,
      },
    })

    const activeCustomerIds = new Set(activeMemberships.map((membership) => membership.customerId))

    if (activeCustomerIds.size === 0) {
      return Object.fromEntries(CUSTOMER_SEGMENT_DEFINITIONS.map((definition) => [definition.key, 0])) as Record<CustomerSegmentKey, number>
    }

    const orders = await prisma.order.findMany({
      where: {
        organizationSlug: organization.slug,
        customerId: { in: [...activeCustomerIds] },
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      select: {
        customerId: true,
        total: true,
        createdAt: true,
      },
    })

    const carts = await prisma.shopCart.findMany({
      where: {
        organizationSlug: organization.slug,
        customerId: { in: [...activeCustomerIds] },
        status: { in: ["ACTIVE", "ABANDONED"] },
        items: { some: {} },
      },
      select: {
        customerId: true,
      },
    })

    const recent30Buyers = new Set<string>()
    const recent60Buyers = new Set<string>()
    const cartCandidates = new Set<string>()
    const orderCountByCustomer = new Map<string, number>()
    const revenueByCustomer = new Map<string, number>()

    for (const order of orders) {
      if (!order.customerId) continue
      orderCountByCustomer.set(order.customerId, (orderCountByCustomer.get(order.customerId) ?? 0) + 1)
      revenueByCustomer.set(order.customerId, (revenueByCustomer.get(order.customerId) ?? 0) + Number(order.total))

      if (order.createdAt >= thirtyDaysAgo) recent30Buyers.add(order.customerId)
      if (order.createdAt >= sixtyDaysAgo) recent60Buyers.add(order.customerId)
    }

    for (const cart of carts) {
      if (cart.customerId) cartCandidates.add(cart.customerId)
    }

    const vipMembers = new Set<string>()
    const highOrderMembers = new Set<string>()

    for (const membership of activeMemberships) {
      if (membership.tier === "VIP" || (revenueByCustomer.get(membership.customerId) ?? 0) >= VIP_REVENUE_THRESHOLD) {
        vipMembers.add(membership.customerId)
      }

      if ((orderCountByCustomer.get(membership.customerId) ?? 0) >= HIGH_ORDER_COUNT_THRESHOLD) {
        highOrderMembers.add(membership.customerId)
      }
    }

    return {
      all_club_members: activeMemberships.length,
      new_members_30d: activeMemberships.filter((membership) => membership.joinedAt >= thirtyDaysAgo).length,
      recent_buyers_30d: recent30Buyers.size,
      inactive_60d: activeMemberships.filter((membership) => !recent60Buyers.has(membership.customerId)).length,
      vip_by_revenue: vipMembers.size,
      high_order_count: highOrderMembers.size,
      abandoned_cart_candidates: cartCandidates.size,
    } satisfies Record<CustomerSegmentKey, number>
  }

  private async getLatestSnapshots(organizationId: string) {
    const snapshots = await prisma.customerSegmentSnapshot.findMany({
      where: { organizationId },
      orderBy: { calculatedAt: "desc" },
      select: {
        segmentKey: true,
        memberCount: true,
        calculatedAt: true,
      },
    })

    const latest = new Map<CustomerSegmentKey, { memberCount: number; calculatedAt: Date }>()
    for (const snapshot of snapshots) {
      if (latest.has(snapshot.segmentKey as CustomerSegmentKey)) continue
      latest.set(snapshot.segmentKey as CustomerSegmentKey, {
        memberCount: snapshot.memberCount,
        calculatedAt: snapshot.calculatedAt,
      })
    }
    return latest
  }
}

export const customerSegmentsService = new CustomerSegmentsService()
