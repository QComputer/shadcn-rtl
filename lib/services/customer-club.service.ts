import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import type {
  CustomerClubJoinSource,
  CustomerClubMembershipStatus,
  CustomerClubTier,
} from "@prisma/client"

export type CustomerClubMembershipInput = {
  organizationId: string
  customerId: string
  actorUserId: string
  status?: CustomerClubMembershipStatus
  tier?: CustomerClubTier
  source?: CustomerClubJoinSource
}

export type CustomerClubMembershipUpdateInput = {
  organizationId: string
  customerId?: string
  membershipId?: string
  actorUserId: string
  status?: CustomerClubMembershipStatus
  tier?: CustomerClubTier
}

export class CustomerClubService {
  async listMembers(organizationId: string) {
    return prisma.customerClubMembership.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { joinedAt: "desc" }],
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            image: true,
            isActive: true,
          },
        },
      },
    })
  }

  async getMembership(organizationId: string, customerId: string) {
    return prisma.customerClubMembership.findUnique({
      where: {
        organizationId_customerId: {
          organizationId,
          customerId,
        },
      },
      include: {
        organization: {
          select: { id: true, slug: true, name: true, type: true },
        },
      },
    })
  }

  async join(input: CustomerClubMembershipInput) {
    await this.requireCustomer(input.customerId)

    const membership = await prisma.customerClubMembership.upsert({
      where: {
        organizationId_customerId: {
          organizationId: input.organizationId,
          customerId: input.customerId,
        },
      },
      update: {
        status: input.status ?? "ACTIVE",
        tier: input.tier ?? "MEMBER",
        source: input.source ?? "PUBLIC_SHOP",
        leftAt: null,
      },
      create: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        status: input.status ?? "ACTIVE",
        tier: input.tier ?? "MEMBER",
        source: input.source ?? "PUBLIC_SHOP",
      },
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "CustomerClubMembership",
      entityId: membership.id,
      description: "Customer club membership created or reactivated",
      newValue: {
        organizationId: membership.organizationId,
        customerId: membership.customerId,
        status: membership.status,
        tier: membership.tier,
        source: membership.source,
      },
      userId: input.actorUserId,
      organizationId: input.organizationId,
    })

    return membership
  }

  async update(input: CustomerClubMembershipUpdateInput) {
    const existing = await this.findMembership(input)
    if (!existing) throw new ApiError(404, "Customer club membership not found")

    const updated = await prisma.customerClubMembership.update({
      where: { id: existing.id },
      data: {
        ...(input.status ? { status: input.status, leftAt: input.status === "LEFT" ? new Date() : null } : {}),
        ...(input.tier ? { tier: input.tier } : {}),
      },
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "CustomerClubMembership",
      entityId: updated.id,
      description: "Customer club membership updated",
      previousValue: {
        status: existing.status,
        tier: existing.tier,
        leftAt: existing.leftAt,
      },
      newValue: {
        status: updated.status,
        tier: updated.tier,
        leftAt: updated.leftAt,
      },
      userId: input.actorUserId,
      organizationId: input.organizationId,
    })

    return updated
  }

  async leave(input: CustomerClubMembershipUpdateInput) {
    return this.update({ ...input, status: "LEFT" })
  }

  private async findMembership(input: CustomerClubMembershipUpdateInput) {
    if (input.membershipId) {
      return prisma.customerClubMembership.findFirst({
        where: { id: input.membershipId, organizationId: input.organizationId },
      })
    }

    if (!input.customerId) throw new ApiError(400, "Customer ID is required")

    return prisma.customerClubMembership.findUnique({
      where: {
        organizationId_customerId: {
          organizationId: input.organizationId,
          customerId: input.customerId,
        },
      },
    })
  }

  private async requireCustomer(customerId: string) {
    const customer = await prisma.user.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, role: true },
    })

    if (!customer) throw new ApiError(404, "Customer not found")
    return customer
  }
}

export const customerClubService = new CustomerClubService()
