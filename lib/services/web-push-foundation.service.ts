import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
import { notificationPreferencesService } from "@/lib/services/notification-preferences.service"
import webpush from "web-push"
import type { PushPermissionState } from "@prisma/client"

type BrowserPushSubscription = {
  endpoint?: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

type SubscribeInput = {
  organizationSlug: string
  customerId: string
  subscription: BrowserPushSubscription
  userAgent?: string | null
  source?: string
}

type PermissionEventInput = {
  organizationSlug: string
  customerId: string
  state: PushPermissionState
  reason?: string | null
  userAgent?: string | null
  source?: string
}

type UnsubscribeInput = {
  organizationSlug: string
  customerId: string
  endpoint?: string | null
  userAgent?: string | null
  source?: string
}

type DryRunSendInput = {
  organizationId: string
  actorUserId?: string | null
  title: string
  body: string
  dryRun?: boolean
}

type CustomerPushSendInput = DryRunSendInput & {
  customerId: string
  preferenceKind?: "marketing" | "transactional"
}

type ActivePushSubscription = {
  id: string
  customerId: string
  endpoint: string
  p256dh: string
  auth: string
}

export function getWebPushRuntimeConfig() {
  const enabled = process.env.WEB_PUSH_ENABLED === "true"
  const provider = process.env.WEB_PUSH_PROVIDER || "dry_run"
  const dryRun = process.env.WEB_PUSH_DRY_RUN !== "false" || provider === "dry_run"
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || ""
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || ""
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || ""
  const realSendEnabled = enabled && process.env.WEB_PUSH_REAL_SEND_ENABLED === "true" && !dryRun && provider !== "dry_run"

  return {
    enabled,
    provider,
    dryRun,
    publicKey,
    publicKeyConfigured: publicKey.trim().length > 0,
    privateKeyConfigured: privateKey.trim().length > 0,
    subjectConfigured: subject.trim().length > 0,
    configured: publicKey.trim().length > 0 && privateKey.trim().length > 0 && subject.trim().length > 0,
    realSendEnabled,
  }
}

export class WebPushFoundationService {
  async getCustomerStatus(organizationSlug: string, customerId: string) {
    const organization = await this.requireOrganizationBySlug(organizationSlug)
    const [subscriptions, lastPermissionEvent] = await Promise.all([
      prisma.pushSubscription.findMany({
        where: { organizationId: organization.id, customerId },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          endpoint: true,
          isActive: true,
          lastSeenAt: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.notificationPermissionEvent.findFirst({
        where: { organizationId: organization.id, customerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          state: true,
          reason: true,
          source: true,
          createdAt: true,
        },
      }),
    ])

    const activeSubscriptions = subscriptions.filter((subscription) => subscription.isActive)
    const preferences = await notificationPreferencesService.getCustomerPreferences(organizationSlug, customerId)

    return {
      organization,
      config: this.getPublicConfig(),
      active: activeSubscriptions.length > 0,
      subscriptionCount: subscriptions.length,
      activeSubscriptionCount: activeSubscriptions.length,
      subscriptions,
      lastPermissionEvent,
      preferences,
    }
  }

  async listDashboard(organizationId: string) {
    await this.requireOrganizationById(organizationId)

    const [activeCount, totalCount, subscriptions, permissionEvents, recentDeliveries, eligibleCustomerIds] = await Promise.all([
      prisma.pushSubscription.count({ where: { organizationId, isActive: true } }),
      prisma.pushSubscription.count({ where: { organizationId } }),
      prisma.pushSubscription.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          endpoint: true,
          isActive: true,
          lastSeenAt: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
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
        },
      }),
      prisma.notificationPermissionEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          state: true,
          source: true,
          reason: true,
          createdAt: true,
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
        },
      }),
      prisma.webPushDelivery.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          customerId: true,
          subscriptionId: true,
          title: true,
          provider: true,
          dryRun: true,
          status: true,
          error: true,
          sentAt: true,
          createdAt: true,
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
        },
      }),
      notificationPreferencesService.listMarketingEligibleCustomerIds(organizationId, "WEB_PUSH"),
    ])
    const eligibleCustomerSet = new Set(eligibleCustomerIds)
    const activeCustomerIds = new Set(subscriptions.filter((subscription) => subscription.isActive).map((subscription) => subscription.customer.id))
    const eligibleActiveCustomerCount = [...activeCustomerIds].filter((customerId) => eligibleCustomerSet.has(customerId)).length

    return {
      config: getWebPushRuntimeConfig(),
      activeCount,
      totalCount,
      inactiveCount: Math.max(totalCount - activeCount, 0),
      eligibleCustomerCount: eligibleActiveCustomerCount,
      preferenceSkippedCustomerCount: Math.max(activeCustomerIds.size - eligibleActiveCustomerCount, 0),
      subscriptions,
      permissionEvents,
      recentDeliveries,
    }
  }

  async subscribe(input: SubscribeInput) {
    const organization = await this.requireOrganizationBySlug(input.organizationSlug)
    await this.requireCustomer(input.customerId)
    const normalized = this.normalizeSubscription(input.subscription)

    const subscription = await prisma.pushSubscription.upsert({
      where: {
        organizationId_customerId_endpoint: {
          organizationId: organization.id,
          customerId: input.customerId,
          endpoint: normalized.endpoint,
        },
      },
      update: {
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        userAgent: input.userAgent || null,
        isActive: true,
        lastSeenAt: new Date(),
        unsubscribedAt: null,
      },
      create: {
        organizationId: organization.id,
        customerId: input.customerId,
        endpoint: normalized.endpoint,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        userAgent: input.userAgent || null,
        isActive: true,
      },
    })

    await prisma.notificationPermissionEvent.create({
      data: {
        organizationId: organization.id,
        customerId: input.customerId,
        subscriptionId: subscription.id,
        state: "GRANTED",
        source: input.source || "PUBLIC_SHOP",
        userAgent: input.userAgent || null,
      },
    })

    await notificationPreferencesService.setWebPushOptIn({
      organizationSlug: input.organizationSlug,
      customerId: input.customerId,
      enabled: true,
      source: input.source || "PUBLIC_SHOP",
    })

    return subscription
  }

  async recordPermissionEvent(input: PermissionEventInput) {
    const organization = await this.requireOrganizationBySlug(input.organizationSlug)
    await this.requireCustomer(input.customerId)

    const event = await prisma.notificationPermissionEvent.create({
      data: {
        organizationId: organization.id,
        customerId: input.customerId,
        state: input.state,
        reason: input.reason || null,
        source: input.source || "PUBLIC_SHOP",
        userAgent: input.userAgent || null,
      },
    })

    if (input.state === "DENIED" || input.state === "UNSUPPORTED" || input.state === "REVOKED") {
      await notificationPreferencesService.setWebPushOptIn({
        organizationSlug: input.organizationSlug,
        customerId: input.customerId,
        enabled: false,
        source: input.source || "PUBLIC_SHOP",
      })
    }

    return event
  }

  async unsubscribe(input: UnsubscribeInput) {
    const organization = await this.requireOrganizationBySlug(input.organizationSlug)
    const where = {
      organizationId: organization.id,
      customerId: input.customerId,
      isActive: true,
      ...(input.endpoint ? { endpoint: input.endpoint } : {}),
    }

    const result = await prisma.pushSubscription.updateMany({
      where,
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
        lastSeenAt: new Date(),
        userAgent: input.userAgent || undefined,
      },
    })

    await prisma.notificationPermissionEvent.create({
      data: {
        organizationId: organization.id,
        customerId: input.customerId,
        state: "REVOKED",
        reason: "Customer unsubscribed",
        source: input.source || "PUBLIC_SHOP",
        userAgent: input.userAgent || null,
      },
    })

    await notificationPreferencesService.setWebPushOptIn({
      organizationSlug: input.organizationSlug,
      customerId: input.customerId,
      enabled: false,
      source: input.source || "PUBLIC_SHOP",
    })

    return { updated: result.count }
  }

  async send(input: DryRunSendInput) {
    await this.requireOrganizationById(input.organizationId)
    const config = getWebPushRuntimeConfig()
    const deliveryPlan = await this.getEligibleDeliveryPlan(input.organizationId)
    const { subscriptions, recipientCount, activeSubscriptionCount, activeCustomerCount, preferenceSkippedCustomerCount } = deliveryPlan

    if (!input.dryRun) {
      if (!config.realSendEnabled) {
        throw new ApiError(409, "Real Web Push sending is disabled; use dryRun=true")
      }

      const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || ""
      const subject = process.env.WEB_PUSH_VAPID_SUBJECT || ""

      if (!privateKey || !subject) {
        throw new ApiError(409, "VAPID is not configured")
      }

      let successCount = 0
      let failureCount = 0
      let removedCount = 0

      webpush.setVapidDetails(subject, config.publicKey, privateKey)
      const payload = JSON.stringify({ title: input.title, body: input.body })

      for (const subscription of subscriptions) {
        const delivery = await prisma.webPushDelivery.create({
          data: {
            organizationId: input.organizationId,
            customerId: subscription.customerId,
            subscriptionId: subscription.id,
            actorUserId: input.actorUserId,
            title: input.title,
            body: input.body,
            provider: config.provider,
            dryRun: false,
            status: "PENDING",
          },
          select: { id: true },
        })

        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: 60 }
          )
          await prisma.webPushDelivery.update({
            where: { id: delivery.id },
            data: { status: "SENT", sentAt: new Date(), error: null },
          })
          successCount++
        } catch (err) {
          failureCount++
          const statusCode = (err as { statusCode?: number }).statusCode
          const errorMessage = err instanceof Error ? err.message : "Web Push delivery failed"
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.updateMany({
              where: { id: subscription.id, isActive: true },
              data: { isActive: false, unsubscribedAt: new Date() },
            })
            removedCount++
          }
          await prisma.webPushDelivery.update({
            where: { id: delivery.id },
            data: { status: "FAILED", error: errorMessage },
          })
        }
      }

      await writeAuditLog({
        action: "CREATE",
        entityType: "PushSubscription",
        entityId: input.organizationId,
        description: "Web Push real delivery completed",
        newValue: {
          dryRun: false,
          provider: config.provider,
          recipientCount,
          subscriptionCount: subscriptions.length,
          activeSubscriptionCount,
          activeCustomerCount,
          preferenceSkippedCustomerCount,
          successCount,
          failureCount,
          removedCount,
          configured: config.configured,
        },
        userId: input.actorUserId,
        organizationId: input.organizationId,
      })

      return {
        dryRun: false,
        provider: config.provider,
        configured: config.configured,
        realSendEnabled: config.realSendEnabled,
        recipientCount,
        subscriptionCount: subscriptions.length,
        activeSubscriptionCount,
        activeCustomerCount,
        preferenceSkippedCustomerCount,
        successCount,
        failureCount,
        removedCount,
        title: input.title,
        body: input.body,
      }
    }

    await writeAuditLog({
      action: "CREATE",
      entityType: "PushSubscription",
      entityId: input.organizationId,
      description: "Web Push dry-run delivery previewed",
      newValue: {
        dryRun: true,
        provider: config.provider,
        recipientCount,
        subscriptionCount: subscriptions.length,
        activeSubscriptionCount,
        activeCustomerCount,
        preferenceSkippedCustomerCount,
        configured: config.configured,
      },
      userId: input.actorUserId,
      organizationId: input.organizationId,
    })

    return {
      dryRun: true,
      provider: config.provider,
      configured: config.configured,
      realSendEnabled: config.realSendEnabled,
      recipientCount,
      subscriptionCount: subscriptions.length,
      activeSubscriptionCount,
      activeCustomerCount,
      preferenceSkippedCustomerCount,
      title: input.title,
      body: input.body,
    }
  }

  async sendToCustomer(input: CustomerPushSendInput) {
    await this.requireOrganizationById(input.organizationId)
    await this.requireCustomer(input.customerId)
    const config = getWebPushRuntimeConfig()
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        isActive: true,
        customer: {
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        customerId: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    })
    const allowed = await notificationPreferencesService.isCustomerDeliveryAllowed({
      organizationId: input.organizationId,
      customerId: input.customerId,
      channel: "WEB_PUSH",
      kind: input.preferenceKind || "transactional",
    })

    if (!allowed) {
      return {
        dryRun: Boolean(input.dryRun),
        provider: config.provider,
        configured: config.configured,
        realSendEnabled: config.realSendEnabled,
        recipientCount: 0,
        subscriptionCount: 0,
        successCount: 0,
        failureCount: 0,
        removedCount: 0,
        preferenceSkippedCustomerCount: 1,
        skipped: true,
        title: input.title,
        body: input.body,
      }
    }

    if (input.dryRun) {
      return {
        dryRun: true,
        provider: config.provider,
        configured: config.configured,
        realSendEnabled: config.realSendEnabled,
        recipientCount: subscriptions.length > 0 ? 1 : 0,
        subscriptionCount: subscriptions.length,
        successCount: 0,
        failureCount: 0,
        removedCount: 0,
        preferenceSkippedCustomerCount: 0,
        title: input.title,
        body: input.body,
      }
    }

    if (!config.realSendEnabled) {
      throw new ApiError(409, "Real Web Push sending is disabled; use dryRun=true")
    }

    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || ""
    const subject = process.env.WEB_PUSH_VAPID_SUBJECT || ""

    if (!privateKey || !subject) {
      throw new ApiError(409, "VAPID is not configured")
    }

    let successCount = 0
    let failureCount = 0
    let removedCount = 0

    webpush.setVapidDetails(subject, config.publicKey, privateKey)
    const payload = JSON.stringify({ title: input.title, body: input.body })

    for (const subscription of subscriptions) {
      const delivery = await prisma.webPushDelivery.create({
        data: {
          organizationId: input.organizationId,
          customerId: input.customerId,
          subscriptionId: subscription.id,
          actorUserId: input.actorUserId,
          title: input.title,
          body: input.body,
          provider: config.provider,
          dryRun: false,
          status: "PENDING",
        },
        select: { id: true },
      })

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 60 }
        )
        await prisma.webPushDelivery.update({
          where: { id: delivery.id },
          data: { status: "SENT", sentAt: new Date(), error: null },
        })
        successCount++
      } catch (err) {
        failureCount++
        const statusCode = (err as { statusCode?: number }).statusCode
        const errorMessage = err instanceof Error ? err.message : "Web Push delivery failed"
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.updateMany({
            where: { id: subscription.id, isActive: true },
            data: { isActive: false, unsubscribedAt: new Date() },
          })
          removedCount++
        }
        await prisma.webPushDelivery.update({
          where: { id: delivery.id },
          data: { status: "FAILED", error: errorMessage },
        })
      }
    }

    await writeAuditLog({
      action: "CREATE",
      entityType: "PushSubscription",
      entityId: input.organizationId,
      description: "Customer Web Push delivery completed",
      newValue: {
        provider: config.provider,
        recipientCount: subscriptions.length > 0 ? 1 : 0,
        subscriptionCount: subscriptions.length,
        successCount,
        failureCount,
        removedCount,
      },
      userId: input.actorUserId,
      organizationId: input.organizationId,
    })

    return {
      dryRun: false,
      provider: config.provider,
      configured: config.configured,
      realSendEnabled: config.realSendEnabled,
      recipientCount: subscriptions.length > 0 ? 1 : 0,
      subscriptionCount: subscriptions.length,
      successCount,
      failureCount,
      removedCount,
      preferenceSkippedCustomerCount: 0,
      title: input.title,
      body: input.body,
    }
  }

  private async getEligibleDeliveryPlan(organizationId: string) {
    const [subscriptions, eligibleCustomerIds] = await Promise.all([
      prisma.pushSubscription.findMany({
        where: {
          organizationId,
          isActive: true,
          customer: {
            isActive: true,
            deletedAt: null,
          },
        },
        select: {
          id: true,
          customerId: true,
          endpoint: true,
          p256dh: true,
          auth: true,
        },
      }),
      notificationPreferencesService.listMarketingEligibleCustomerIds(organizationId, "WEB_PUSH"),
    ])
    const eligibleCustomerSet = new Set(eligibleCustomerIds)
    const activeCustomerIds = new Set(subscriptions.map((subscription) => subscription.customerId))
    const eligibleSubscriptions: ActivePushSubscription[] = subscriptions.filter((subscription) => eligibleCustomerSet.has(subscription.customerId))
    const eligibleRecipientIds = new Set(eligibleSubscriptions.map((subscription) => subscription.customerId))

    return {
      subscriptions: eligibleSubscriptions,
      recipientCount: eligibleRecipientIds.size,
      activeSubscriptionCount: subscriptions.length,
      activeCustomerCount: activeCustomerIds.size,
      preferenceSkippedCustomerCount: Math.max(activeCustomerIds.size - eligibleRecipientIds.size, 0),
    }
  }

  private getPublicConfig() {
    const config = getWebPushRuntimeConfig()
    return {
      publicKey: config.publicKey,
      publicKeyConfigured: config.publicKeyConfigured,
      dryRun: config.dryRun,
      provider: config.provider,
      realSendEnabled: config.realSendEnabled,
    }
  }

  private normalizeSubscription(subscription: BrowserPushSubscription) {
    const endpoint = subscription.endpoint?.trim()
    const p256dh = subscription.keys?.p256dh?.trim()
    const auth = subscription.keys?.auth?.trim()

    if (!endpoint) throw new ApiError(400, "Push subscription endpoint is required")
    if (!p256dh || !auth) throw new ApiError(400, "Push subscription keys are required")

    return { endpoint, p256dh, auth }
  }

  private async requireOrganizationBySlug(slug: string) {
    const organization = await prisma.organization.findFirst({
      where: {
        slug,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
      },
    })

    if (!organization) throw new ApiError(404, "Organization not found")
    return organization
  }

  private async requireOrganizationById(id: string) {
    const organization = await prisma.organization.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    })

    if (!organization) throw new ApiError(404, "Organization not found")
    return organization
  }

  private async requireCustomer(customerId: string) {
    const customer = await prisma.user.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    })

    if (!customer) throw new ApiError(404, "Customer not found")
    return customer
  }
}

export const webPushFoundationService = new WebPushFoundationService()
