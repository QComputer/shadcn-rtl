import { ApiError } from "@/lib/api-guards"
import { prisma } from "@/lib/db"
import type { NotificationChannel } from "@prisma/client"

export const NOTIFICATION_CHANNELS = ["IN_APP", "WEB_PUSH", "SMS"] as const satisfies readonly NotificationChannel[]
const SUPPORTED_NOTIFICATION_CHANNELS = new Set<string>(NOTIFICATION_CHANNELS)

type PreferenceUpdateInput = {
  organizationSlug: string
  customerId: string
  channel: NotificationChannel
  marketingEnabled?: boolean
  transactionalEnabled?: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  locale?: string | null
  source?: string
}

type DeliveryAllowedInput = {
  organizationId: string
  customerId: string
  channel: NotificationChannel
  kind: "marketing" | "transactional"
}

function defaultMarketingEnabled(channel: NotificationChannel) {
  return channel === "IN_APP"
}

function normalizeQuietHour(value?: string | null) {
  if (value == null || value === "") return null
  if (!/^\d{2}:\d{2}$/.test(value)) throw new ApiError(400, "Quiet hours must use HH:mm format")
  return value
}

function assertSupportedChannel(channel: NotificationChannel) {
  if (!SUPPORTED_NOTIFICATION_CHANNELS.has(channel)) {
    throw new ApiError(400, "Unsupported notification channel")
  }
}

export class NotificationPreferencesService {
  async getCustomerPreferences(organizationSlug: string, customerId: string) {
    const organization = await this.requireOrganizationBySlug(organizationSlug)
    await this.requireRecipient(organization.id, customerId)

    const preferences = await prisma.notificationPreference.findMany({
      where: { organizationId: organization.id, customerId },
      orderBy: { channel: "asc" },
    })
    const byChannel = new Map(preferences.map((preference) => [preference.channel, preference]))

    return NOTIFICATION_CHANNELS.map((channel) => {
      const preference = byChannel.get(channel)
      return {
        id: preference?.id ?? null,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        customerId,
        channel,
        marketingEnabled: preference?.marketingEnabled ?? defaultMarketingEnabled(channel),
        transactionalEnabled: preference?.transactionalEnabled ?? true,
        quietHoursStart: preference?.quietHoursStart ?? null,
        quietHoursEnd: preference?.quietHoursEnd ?? null,
        locale: preference?.locale ?? "fa",
        source: preference?.source ?? "DEFAULT",
        persisted: Boolean(preference),
        updatedAt: preference?.updatedAt ?? null,
      }
    })
  }

  async upsertCustomerPreference(input: PreferenceUpdateInput) {
    assertSupportedChannel(input.channel)

    const organization = await this.requireOrganizationBySlug(input.organizationSlug)
    const recipient = await this.requireRecipient(organization.id, input.customerId)

    const hasQuietHoursStart = Object.prototype.hasOwnProperty.call(input, "quietHoursStart")
    const hasQuietHoursEnd = Object.prototype.hasOwnProperty.call(input, "quietHoursEnd")
    const quietHoursStart = hasQuietHoursStart ? normalizeQuietHour(input.quietHoursStart) : undefined
    const quietHoursEnd = hasQuietHoursEnd ? normalizeQuietHour(input.quietHoursEnd) : undefined
    const locale = input.locale?.trim() || "fa"
    const source = input.source || "PUBLIC_SHOP"

    return prisma.notificationPreference.upsert({
      where: {
        organizationId_customerId_channel: {
          organizationId: organization.id,
          customerId: input.customerId,
          channel: input.channel,
        },
      },
      update: {
        recipientRole: recipient.role,
        ...(input.marketingEnabled !== undefined ? { marketingEnabled: input.marketingEnabled } : {}),
        ...(input.transactionalEnabled !== undefined ? { transactionalEnabled: input.transactionalEnabled } : {}),
        ...(hasQuietHoursStart ? { quietHoursStart } : {}),
        ...(hasQuietHoursEnd ? { quietHoursEnd } : {}),
        locale,
        source,
      },
      create: {
        organizationId: organization.id,
        customerId: input.customerId,
        recipientRole: recipient.role,
        channel: input.channel,
        marketingEnabled: input.marketingEnabled ?? defaultMarketingEnabled(input.channel),
        transactionalEnabled: input.transactionalEnabled ?? true,
        quietHoursStart: quietHoursStart ?? null,
        quietHoursEnd: quietHoursEnd ?? null,
        locale,
        source,
      },
    })
  }

  async setWebPushOptIn(input: {
    organizationSlug: string
    customerId: string
    enabled: boolean
    locale?: string | null
    source?: string
  }) {
    return this.upsertCustomerPreference({
      organizationSlug: input.organizationSlug,
      customerId: input.customerId,
      channel: "WEB_PUSH",
      marketingEnabled: input.enabled,
      transactionalEnabled: input.enabled,
      locale: input.locale,
      source: input.source || "PUBLIC_SHOP",
    })
  }

  async getDashboardPreferences(organizationId: string, userId: string) {
    const preferences = await prisma.notificationPreference.findMany({
      where: { organizationId, customerId: userId },
      orderBy: { channel: "asc" },
    })
    const byChannel = new Map(preferences.map((preference) => [preference.channel, preference]))

    return NOTIFICATION_CHANNELS.map((channel) => {
      const preference = byChannel.get(channel)
      return {
        id: preference?.id ?? null,
        channel,
        marketingEnabled: preference?.marketingEnabled ?? false,
        transactionalEnabled: preference?.transactionalEnabled ?? true,
        quietHoursStart: preference?.quietHoursStart ?? null,
        quietHoursEnd: preference?.quietHoursEnd ?? null,
        locale: preference?.locale ?? "fa",
        persisted: Boolean(preference),
        updatedAt: preference?.updatedAt ?? null,
      }
    })
  }

  async setDashboardWebPushOptIn(input: {
    organizationId: string
    userId: string
    enabled: boolean
    source?: string
  }) {
    const recipient = await this.requireCustomer(input.userId)
    return prisma.notificationPreference.upsert({
      where: {
        organizationId_customerId_channel: {
          organizationId: input.organizationId,
          customerId: input.userId,
          channel: "WEB_PUSH",
        },
      },
      update: {
        recipientRole: recipient.role,
        marketingEnabled: input.enabled,
        transactionalEnabled: input.enabled,
        source: input.source || "DASHBOARD",
      },
      create: {
        organizationId: input.organizationId,
        customerId: input.userId,
        recipientRole: recipient.role,
        channel: "WEB_PUSH",
        marketingEnabled: input.enabled,
        transactionalEnabled: input.enabled,
        locale: "fa",
        source: input.source || "DASHBOARD",
      },
    })
  }

  async listMarketingEligibleCustomerIds(organizationId: string, channel: NotificationChannel) {
    assertSupportedChannel(channel)

    const memberships = await prisma.customerClubMembership.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        customer: { isActive: true, deletedAt: null },
      },
      select: { customerId: true },
    })

    const customerIds = memberships.map((membership) => membership.customerId)
    if (customerIds.length === 0) return []

    const preferences = await prisma.notificationPreference.findMany({
      where: {
        organizationId,
        customerId: { in: customerIds },
        channel,
      },
      select: { customerId: true, marketingEnabled: true },
    })
    const byCustomer = new Map(preferences.map((preference) => [preference.customerId, preference.marketingEnabled]))

    return customerIds.filter((customerId) => byCustomer.get(customerId) ?? defaultMarketingEnabled(channel))
  }

  async isCustomerDeliveryAllowed(input: DeliveryAllowedInput) {
    assertSupportedChannel(input.channel)

    const preference = await prisma.notificationPreference.findUnique({
      where: {
        organizationId_customerId_channel: {
          organizationId: input.organizationId,
          customerId: input.customerId,
          channel: input.channel,
        },
      },
      select: {
        marketingEnabled: true,
        transactionalEnabled: true,
      },
    })

    if (input.kind === "marketing") {
      return preference?.marketingEnabled ?? defaultMarketingEnabled(input.channel)
    }

    return preference?.transactionalEnabled ?? true
  }

  private async requireOrganizationBySlug(slug: string) {
    const organization = await prisma.organization.findFirst({
      where: { slug, deletedAt: null, isActive: true },
      select: { id: true, slug: true },
    })

    if (!organization) throw new ApiError(404, "Organization not found")
    return organization
  }

  private async requireCustomer(customerId: string) {
    const customer = await prisma.user.findFirst({
      where: { id: customerId, deletedAt: null, isActive: true },
      select: { id: true, role: true },
    })

    if (!customer) throw new ApiError(404, "Customer not found")
    return customer
  }

  private async requireRecipient(organizationId: string, userId: string) {
    const recipient = await this.requireCustomer(userId)
    if (recipient.role !== "CUSTOMER" && recipient.role !== "SUPER_ADMIN") {
      const membership = await prisma.organizationMember.findFirst({
        where: { organizationId, userId, isActive: true },
        select: { id: true },
      })
      if (!membership) throw new ApiError(403, "Recipient is not active in this organization")
    }
    return recipient
  }
}

export const notificationPreferencesService = new NotificationPreferencesService()
