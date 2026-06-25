import { Prisma } from "@prisma/client"
import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import {
  CUSTOMER_SEGMENT_DEFINITIONS,
  type CustomerSegmentKey,
} from "@/lib/services/customer-segments.service"

type CampaignInput = {
  title: string
  segmentKey: CustomerSegmentKey
  message: string
  scheduledAt?: Date | null
}

type CampaignUpdateInput = Partial<CampaignInput>

const VIP_REVENUE_THRESHOLD = 5_000_000
const HIGH_ORDER_COUNT_THRESHOLD = 3
const IN_APP_CAMPAIGN_TYPE = "CUSTOMER_CLUB_CAMPAIGN_IN_APP"

export class CampaignBuilderService {
  async listCampaigns(organizationId: string) {
    await this.getOrganizationContext(organizationId)

    const campaigns = await prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        audiences: { orderBy: { createdAt: "desc" }, take: 1 },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { deliveries: true } },
      },
    })

    return campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      sentAt: campaign.sentAt,
      canceledAt: campaign.canceledAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      audience: campaign.audiences[0] ?? null,
      message: campaign.messages[0] ?? null,
      deliveryCount: campaign._count.deliveries,
    }))
  }

  async getCampaign(organizationId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        audiences: { orderBy: { createdAt: "desc" } },
        messages: { orderBy: { createdAt: "desc" } },
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            targetUserId: true,
            status: true,
            channel: true,
            sentAt: true,
            createdAt: true,
            notificationId: true,
            targetUser: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: { select: { deliveries: true } },
      },
    })

    if (!campaign) throw new ApiError(404, "Campaign not found")
    return campaign
  }

  async createCampaign(organizationId: string, actorUserId: string, input: CampaignInput) {
    const prepared = await this.prepareSegmentAudience(organizationId, input.segmentKey)
    const status = input.scheduledAt ? "SCHEDULED" : "DRAFT"

    const campaign = await prisma.$transaction(async (tx) => {
      const segment = await this.persistSegmentSnapshot(tx, organizationId, prepared)

      return tx.campaign.create({
        data: {
          organizationId,
          createdByUserId: actorUserId,
          title: input.title,
          status,
          scheduledAt: input.scheduledAt ?? null,
          audiences: {
            create: {
              segmentId: segment.segmentId,
              segmentSnapshotId: segment.snapshotId,
              segmentKey: prepared.key,
              memberCount: prepared.recipientIds.length,
              rule: prepared.rule,
            },
          },
          messages: {
            create: {
              channel: "IN_APP",
              body: input.message,
            },
          },
        },
        include: {
          audiences: true,
          messages: true,
        },
      })
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "Campaign",
      entityId: campaign.id,
      description: "Campaign draft created",
      newValue: {
        title: campaign.title,
        segmentKey: prepared.key,
        memberCount: prepared.recipientIds.length,
        channel: "IN_APP",
        status,
      },
      userId: actorUserId,
      organizationId,
    })

    return campaign
  }

  async updateCampaign(organizationId: string, campaignId: string, actorUserId: string, input: CampaignUpdateInput) {
    const campaign = await this.getCampaign(organizationId, campaignId)
    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      throw new ApiError(409, "Only draft or scheduled campaigns can be updated")
    }

    const prepared = input.segmentKey ? await this.prepareSegmentAudience(organizationId, input.segmentKey) : null

    const updated = await prisma.$transaction(async (tx) => {
      let segment: { segmentId: string; snapshotId: string } | null = null
      if (prepared) {
        segment = await this.persistSegmentSnapshot(tx, organizationId, prepared)
        await tx.campaignAudience.deleteMany({ where: { campaignId } })
        await tx.campaignAudience.create({
          data: {
            campaignId,
            segmentId: segment.segmentId,
            segmentSnapshotId: segment.snapshotId,
            segmentKey: prepared.key,
            memberCount: prepared.recipientIds.length,
            rule: prepared.rule,
          },
        })
      }

      if (typeof input.message === "string") {
        await tx.campaignMessage.deleteMany({ where: { campaignId, channel: "IN_APP" } })
        await tx.campaignMessage.create({
          data: {
            campaignId,
            channel: "IN_APP",
            body: input.message,
          },
        })
      }

      return tx.campaign.update({
        where: { id: campaignId },
        data: {
          ...(typeof input.title === "string" ? { title: input.title } : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "scheduledAt")
            ? {
                scheduledAt: input.scheduledAt ?? null,
                status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
              }
            : {}),
        },
        include: {
          audiences: true,
          messages: true,
        },
      })
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Campaign",
      entityId: campaignId,
      description: "Campaign draft updated",
      newValue: {
        title: updated.title,
        status: updated.status,
        segmentKey: prepared?.key,
      },
      userId: actorUserId,
      organizationId,
    })

    return updated
  }

  async previewCampaign(organizationId: string, campaignId: string, actorUserId: string) {
    const campaign = await this.getCampaign(organizationId, campaignId)
    const audience = campaign.audiences[0]
    if (!audience) throw new ApiError(400, "Campaign audience is required")

    const context = await this.getOrganizationContext(organizationId)
    const recipientIds = await this.getSegmentRecipients(context, audience.segmentKey as CustomerSegmentKey)

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Campaign",
      entityId: campaignId,
      description: "Campaign delivery previewed",
      newValue: {
        dryRun: true,
        recipientCount: recipientIds.length,
        segmentKey: audience.segmentKey,
        channel: "IN_APP",
      },
      userId: actorUserId,
      organizationId,
    })

    return { dryRun: true, recipientCount: recipientIds.length, created: 0 }
  }

  async sendCampaign(organizationId: string, campaignId: string, actorUserId: string, dryRun = false) {
    if (dryRun) return this.previewCampaign(organizationId, campaignId, actorUserId)

    const campaign = await this.getCampaign(organizationId, campaignId)
    if (campaign.status === "CANCELED") throw new ApiError(409, "Canceled campaigns cannot be sent")
    if (campaign.status === "SENT") throw new ApiError(409, "Campaign has already been sent")
    if (campaign.status === "SENDING") throw new ApiError(409, "Campaign is already sending")

    const audience = campaign.audiences[0]
    const message = campaign.messages.find((item) => item.channel === "IN_APP") ?? campaign.messages[0]
    if (!audience) throw new ApiError(400, "Campaign audience is required")
    if (!message?.body?.trim()) throw new ApiError(400, "Campaign message is required")

    const context = await this.getOrganizationContext(organizationId)
    const recipientIds = await this.getSegmentRecipients(context, audience.segmentKey as CustomerSegmentKey)

    const result = await prisma.$transaction(async (tx) => {
      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: "SENDING" },
      })

      let created = 0
      for (const targetUserId of recipientIds) {
        const notification = await tx.notification.create({
          data: {
            targetUserId,
            organizationId,
            createdByUserId: actorUserId,
            context: message.body,
            type: IN_APP_CAMPAIGN_TYPE,
          },
        })

        await tx.campaignDelivery.upsert({
          where: {
            campaignId_targetUserId_channel: {
              campaignId,
              targetUserId,
              channel: "IN_APP",
            },
          },
          update: {
            messageId: message.id,
            notificationId: notification.id,
            status: "SENT",
            sentAt: new Date(),
            error: null,
          },
          create: {
            campaignId,
            messageId: message.id,
            organizationId,
            targetUserId,
            notificationId: notification.id,
            channel: "IN_APP",
            status: "SENT",
            sentAt: new Date(),
          },
        })
        created += 1
      }

      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      })

      return { created }
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Campaign",
      entityId: campaignId,
      description: "In-app campaign sent",
      newValue: {
        dryRun: false,
        recipientCount: recipientIds.length,
        created: result.created,
        channel: "IN_APP",
      },
      userId: actorUserId,
      organizationId,
    })

    return { dryRun: false, recipientCount: recipientIds.length, created: result.created }
  }

  async cancelCampaign(organizationId: string, campaignId: string, actorUserId: string) {
    const campaign = await this.getCampaign(organizationId, campaignId)
    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      throw new ApiError(409, "Only draft or scheduled campaigns can be canceled")
    }

    const canceled = await prisma.$transaction(async (tx) => {
      await tx.campaignDelivery.updateMany({
        where: {
          campaignId,
          status: "PENDING",
        },
        data: { status: "CANCELED" },
      })

      return tx.campaign.update({
        where: { id: campaignId },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
        },
      })
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "Campaign",
      entityId: campaignId,
      description: "Campaign canceled before send",
      newValue: {
        status: canceled.status,
      },
      userId: actorUserId,
      organizationId,
    })

    return canceled
  }

  private async persistSegmentSnapshot(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prepared: {
      key: CustomerSegmentKey
      name: string
      description: string
      rule: Prisma.JsonObject
      recipientIds: string[]
    },
  ) {
    const segment = await tx.customerSegment.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: prepared.key,
        },
      },
      update: {
        name: prepared.name,
        description: prepared.description,
        rule: prepared.rule,
        isSystem: true,
        isActive: true,
      },
      create: {
        organizationId,
        key: prepared.key,
        name: prepared.name,
        description: prepared.description,
        rule: prepared.rule,
        isSystem: true,
        isActive: true,
      },
    })

    await tx.customerSegmentRule.deleteMany({ where: { segmentId: segment.id } })
    await tx.customerSegmentRule.create({
      data: {
        segmentId: segment.id,
        field: "definition",
        operator: "matches",
        value: prepared.rule,
      },
    })

    const snapshot = await tx.customerSegmentSnapshot.create({
      data: {
        organizationId,
        segmentId: segment.id,
        segmentKey: prepared.key,
        memberCount: prepared.recipientIds.length,
        rule: prepared.rule,
      },
    })

    return { segmentId: segment.id, snapshotId: snapshot.id }
  }

  private async prepareSegmentAudience(organizationId: string, segmentKey: CustomerSegmentKey) {
    const definition = CUSTOMER_SEGMENT_DEFINITIONS.find((segment) => segment.key === segmentKey)
    if (!definition) throw new ApiError(400, "Invalid campaign segment")

    const context = await this.getOrganizationContext(organizationId)
    const recipientIds = await this.getSegmentRecipients(context, segmentKey)
    return {
      ...definition,
      recipientIds,
    }
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

  private async getSegmentRecipients(organization: { id: string; slug: string }, segmentKey: CustomerSegmentKey) {
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
    if (activeCustomerIds.size === 0) return []

    if (segmentKey === "all_club_members") return [...activeCustomerIds]
    if (segmentKey === "new_members_30d") {
      return activeMemberships
        .filter((membership) => membership.joinedAt >= thirtyDaysAgo)
        .map((membership) => membership.customerId)
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

    const recent30Buyers = new Set<string>()
    const recent60Buyers = new Set<string>()
    const orderCountByCustomer = new Map<string, number>()
    const revenueByCustomer = new Map<string, number>()

    for (const order of orders) {
      if (!order.customerId) continue
      orderCountByCustomer.set(order.customerId, (orderCountByCustomer.get(order.customerId) ?? 0) + 1)
      revenueByCustomer.set(order.customerId, (revenueByCustomer.get(order.customerId) ?? 0) + Number(order.total))

      if (order.createdAt >= thirtyDaysAgo) recent30Buyers.add(order.customerId)
      if (order.createdAt >= sixtyDaysAgo) recent60Buyers.add(order.customerId)
    }

    if (segmentKey === "recent_buyers_30d") return [...recent30Buyers]
    if (segmentKey === "inactive_60d") {
      return activeMemberships
        .filter((membership) => !recent60Buyers.has(membership.customerId))
        .map((membership) => membership.customerId)
    }
    if (segmentKey === "vip_by_revenue") {
      return activeMemberships
        .filter((membership) => membership.tier === "VIP" || (revenueByCustomer.get(membership.customerId) ?? 0) >= VIP_REVENUE_THRESHOLD)
        .map((membership) => membership.customerId)
    }
    if (segmentKey === "high_order_count") {
      return activeMemberships
        .filter((membership) => (orderCountByCustomer.get(membership.customerId) ?? 0) >= HIGH_ORDER_COUNT_THRESHOLD)
        .map((membership) => membership.customerId)
    }

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

    return [...new Set(carts.map((cart) => cart.customerId).filter((customerId): customerId is string => Boolean(customerId)))]
  }
}

export const campaignBuilderService = new CampaignBuilderService()
