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
    await this.requireCustomer(customerId)

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
    await this.requireCustomer(input.customerId)

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
      select: { id: true },
    })

    if (!customer) throw new ApiError(404, "Customer not found")
    return customer
  }
}

export const notificationPreferencesService = new NotificationPreferencesService()
