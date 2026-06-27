import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { prisma } from "@/lib/db"
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
  actorUserId: string
  title: string
  body: string
  dryRun?: boolean
}

export function getWebPushRuntimeConfig() {
  const provider = process.env.WEB_PUSH_PROVIDER || "dry_run"
  const dryRun = process.env.WEB_PUSH_DRY_RUN !== "false" || provider === "dry_run"
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || ""
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || ""
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT || ""
  const realSendEnabled = process.env.WEB_PUSH_REAL_SEND_ENABLED === "true" && !dryRun && provider !== "dry_run"

  return {
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

    return {
      organization,
      config: this.getPublicConfig(),
      active: activeSubscriptions.length > 0,
      subscriptionCount: subscriptions.length,
      activeSubscriptionCount: activeSubscriptions.length,
      subscriptions,
      lastPermissionEvent,
    }
  }

  async listDashboard(organizationId: string) {
    await this.requireOrganizationById(organizationId)

    const [activeCount, totalCount, subscriptions, permissionEvents] = await Promise.all([
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
    ])

    return {
      config: getWebPushRuntimeConfig(),
      activeCount,
      totalCount,
      inactiveCount: Math.max(totalCount - activeCount, 0),
      subscriptions,
      permissionEvents,
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

    return subscription
  }

  async recordPermissionEvent(input: PermissionEventInput) {
    const organization = await this.requireOrganizationBySlug(input.organizationSlug)
    await this.requireCustomer(input.customerId)

    return prisma.notificationPermissionEvent.create({
      data: {
        organizationId: organization.id,
        customerId: input.customerId,
        state: input.state,
        reason: input.reason || null,
        source: input.source || "PUBLIC_SHOP",
        userAgent: input.userAgent || null,
      },
    })
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

    return { updated: result.count }
  }

  async send(input: DryRunSendInput) {
    await this.requireOrganizationById(input.organizationId)
    const config = getWebPushRuntimeConfig()

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        organizationId: input.organizationId,
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

    const recipientCount = new Set(subscriptions.map((subscription) => subscription.customerId)).size

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
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            { TTL: 60 }
          )
          successCount++
        } catch (err) {
          failureCount++
          const statusCode = (err as { statusCode?: number }).statusCode
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.updateMany({
              where: { id: subscription.id, isActive: true },
              data: { isActive: false, unsubscribedAt: new Date() },
            })
            removedCount++
          }
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
      title: input.title,
      body: input.body,
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
