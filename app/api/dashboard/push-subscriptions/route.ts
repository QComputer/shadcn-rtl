import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { prisma } from "@/lib/db"
import { notificationPreferencesService } from "@/lib/services/notification-preferences.service"
import { getWebPushRuntimeConfig } from "@/lib/services/web-push-foundation.service"

const subscriptionSchema = z.object({
  endpoint: z.string().trim().min(1),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
})

type BrowserPushSubscription = z.infer<typeof subscriptionSchema>

function normalizeSubscription(subscription: BrowserPushSubscription) {
  const endpoint = subscription.endpoint?.trim()
  const p256dh = subscription.keys?.p256dh?.trim()
  const auth = subscription.keys?.auth?.trim()

  if (!endpoint) throw new Error("Push subscription endpoint is required")
  if (!p256dh || !auth) throw new Error("Push subscription keys are required")

  return { endpoint, p256dh, auth }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const organizationId = await requireCurrentOrganizationId(session)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF"])

    const config = getWebPushRuntimeConfig()

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        organizationId,
        customerId: session.user.id,
        isActive: true,
      },
      select: {
        id: true,
        endpoint: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    })

    const preferences = await notificationPreferencesService.getDashboardPreferences(organizationId, session.user.id)

    return NextResponse.json({
      active: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
      subscriptions,
      config: {
        publicKey: config.publicKey,
        publicKeyConfigured: config.publicKeyConfigured,
        dryRun: config.dryRun,
        provider: config.provider,
      },
      preferences,
    })
  } catch (error) {
    return jsonError(error, "Error loading dashboard push subscription status")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const organizationId = await requireCurrentOrganizationId(session)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF"])

    const body = await request.json()
    const subscription = subscriptionSchema.parse(body)
    const normalized = normalizeSubscription(subscription)

    const result = await prisma.pushSubscription.upsert({
      where: {
        organizationId_customerId_endpoint: {
          organizationId,
          customerId: session.user.id,
          endpoint: normalized.endpoint,
        },
      },
      update: {
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        isActive: true,
        lastSeenAt: new Date(),
        unsubscribedAt: null,
      },
      create: {
        organizationId,
        customerId: session.user.id,
        endpoint: normalized.endpoint,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        isActive: true,
      },
      select: {
        id: true,
        endpoint: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await notificationPreferencesService.setDashboardWebPushOptIn({
      organizationId,
      userId: session.user.id,
      enabled: true,
      source: "DASHBOARD",
    })

    return NextResponse.json({ subscription: result }, { status: 201 })
  } catch (error) {
    return jsonError(error, "Error saving dashboard push subscription")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const organizationId = await requireCurrentOrganizationId(session)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF"])

    const body = await request.json().catch(() => ({})) as { endpoint?: string | null }

    const where = {
      organizationId,
      customerId: session.user.id,
      isActive: true,
      ...(body.endpoint ? { endpoint: body.endpoint } : {}),
    }

    const result = await prisma.pushSubscription.updateMany({
      where,
      data: {
        isActive: false,
        unsubscribedAt: new Date(),
        lastSeenAt: new Date(),
      },
    })

    await notificationPreferencesService.setDashboardWebPushOptIn({
      organizationId,
      userId: session.user.id,
      enabled: false,
      source: "DASHBOARD",
    })

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    return jsonError(error, "Error unsubscribing from dashboard push notifications")
  }
}