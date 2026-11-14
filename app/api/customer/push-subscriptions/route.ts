import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCustomerRequestContext,
  requireSameOriginMutation,
} from "@/lib/api-guards"
import { webPushFoundationService } from "@/lib/services/web-push-foundation.service"

const organizationSlugSchema = z.string().trim().min(1)

const subscriptionSchema = z.object({
  endpoint: z.string().trim().min(1),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
})

const subscribeSchema = z.object({
  organizationSlug: organizationSlugSchema,
  subscription: subscriptionSchema,
})

const permissionEventSchema = z.object({
  organizationSlug: organizationSlugSchema,
  state: z.enum(["PROMPT", "GRANTED", "DENIED", "UNSUPPORTED", "REVOKED"]),
  reason: z.string().trim().max(240).nullable().optional(),
})

const unsubscribeSchema = z.object({
  organizationSlug: organizationSlugSchema,
  endpoint: z.string().trim().min(1).nullable().optional(),
})

function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent") || null
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const context = await requireCustomerRequestContext(request, session)
    const organizationSlug = organizationSlugSchema.parse(request.nextUrl.searchParams.get("organizationSlug"))
    if (organizationSlug !== context.slug) throw new ApiError(403, "Customer organization context mismatch")
    const status = await webPushFoundationService.getCustomerStatus(
      organizationSlug,
      session.user.id,
      context.origin,
    )
    return NextResponse.json(status)
  } catch (error) {
    return jsonError(error, "Error loading push subscription status")
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginMutation(request)
    const session = await requireAuthSession()
    const context = await requireCustomerRequestContext(request, session)
    const body = subscribeSchema.parse(await request.json())
    if (body.organizationSlug !== context.slug) throw new ApiError(403, "Customer organization context mismatch")
    const subscription = await webPushFoundationService.subscribe({
      organizationSlug: body.organizationSlug,
      customerId: session.user.id,
      subscription: body.subscription,
      userAgent: getUserAgent(request),
      source: "PUBLIC_SHOP",
      origin: context.origin,
    })

    return NextResponse.json({ subscription }, { status: 201 })
  } catch (error) {
    return jsonError(error, "Error saving push subscription")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOriginMutation(request)
    const session = await requireAuthSession()
    const context = await requireCustomerRequestContext(request, session)
    const body = permissionEventSchema.parse(await request.json())
    if (body.organizationSlug !== context.slug) throw new ApiError(403, "Customer organization context mismatch")
    const event = await webPushFoundationService.recordPermissionEvent({
      organizationSlug: body.organizationSlug,
      customerId: session.user.id,
      state: body.state,
      reason: body.reason,
      userAgent: getUserAgent(request),
      source: "PUBLIC_SHOP",
      origin: context.origin,
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    return jsonError(error, "Error recording push permission")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireSameOriginMutation(request)
    const session = await requireAuthSession()
    const context = await requireCustomerRequestContext(request, session)
    const body = unsubscribeSchema.parse(await request.json().catch(() => ({})))
    if (body.organizationSlug !== context.slug) throw new ApiError(403, "Customer organization context mismatch")
    const result = await webPushFoundationService.unsubscribe({
      organizationSlug: body.organizationSlug,
      customerId: session.user.id,
      endpoint: body.endpoint,
      userAgent: getUserAgent(request),
      source: "PUBLIC_SHOP",
      origin: context.origin,
    })

    return NextResponse.json(result)
  } catch (error) {
    return jsonError(error, "Error unsubscribing from push notifications")
  }
}
