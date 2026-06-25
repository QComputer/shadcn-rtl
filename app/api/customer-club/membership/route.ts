import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards"
import { customerClubService } from "@/lib/services/customer-club.service"

const statusValues = ["ACTIVE", "PAUSED", "LEFT", "BLOCKED"] as const
const tierValues = ["MEMBER", "LOYAL", "VIP"] as const
const sourceValues = ["PUBLIC_SHOP", "CHECKOUT", "ADMIN_IMPORT", "CAMPAIGN"] as const

const membershipBodySchema = z.object({
  organizationId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  status: z.enum(statusValues).optional(),
  tier: z.enum(tierValues).optional(),
  source: z.enum(sourceValues).optional(),
})

const membershipPatchSchema = z.object({
  organizationId: z.string().min(1),
  membershipId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  status: z.enum(statusValues).optional(),
  tier: z.enum(tierValues).optional(),
})

function getQueryValue(request: NextRequest, key: string) {
  const value = request.nextUrl.searchParams.get(key)
  return value?.trim() || null
}

async function requireManageAccessForOtherCustomer(
  session: Awaited<ReturnType<typeof requireAuthSession>>,
  organizationId: string,
  customerId: string,
) {
  if (customerId === session.user.id) return
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const organizationId = getQueryValue(request, "organizationId")
    if (!organizationId) throw new ApiError(400, "Organization ID is required")

    const customerId = getQueryValue(request, "customerId") || session.user.id
    await requireManageAccessForOtherCustomer(session, organizationId, customerId)

    const membership = await customerClubService.getMembership(organizationId, customerId)
    return NextResponse.json({ membership })
  } catch (error) {
    return jsonError(error, "Error loading customer club membership")
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const body = membershipBodySchema.parse(await request.json())
    const customerId = body.customerId || session.user.id

    await requireManageAccessForOtherCustomer(session, body.organizationId, customerId)

    if (customerId === session.user.id && (body.status || body.tier || body.source === "ADMIN_IMPORT")) {
      throw new ApiError(403, "Only organization managers can set membership details")
    }

    const membership = await customerClubService.join({
      organizationId: body.organizationId,
      customerId,
      actorUserId: session.user.id,
      status: body.status,
      tier: body.tier,
      source: body.source,
    })

    return NextResponse.json({ membership }, { status: 201 })
  } catch (error) {
    return jsonError(error, "Error updating customer club membership")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const body = membershipPatchSchema.parse(await request.json())
    const customerId = body.customerId || session.user.id

    if (customerId === session.user.id) {
      if (body.membershipId) {
        throw new ApiError(403, "Only organization managers can update membership records by ID")
      }
      if (body.tier || (body.status && body.status !== "LEFT")) {
        throw new ApiError(403, "Only organization managers can update membership details")
      }
    } else {
      await requireOrgAccess(session, body.organizationId, ["ADMIN", "MANAGER"])
    }

    const membership = await customerClubService.update({
      organizationId: body.organizationId,
      customerId,
      membershipId: body.membershipId,
      actorUserId: session.user.id,
      status: body.status,
      tier: body.tier,
    })

    return NextResponse.json({ membership })
  } catch (error) {
    return jsonError(error, "Error updating customer club membership")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const organizationId = getQueryValue(request, "organizationId")
    if (!organizationId) throw new ApiError(400, "Organization ID is required")

    const customerId = getQueryValue(request, "customerId") || session.user.id
    await requireManageAccessForOtherCustomer(session, organizationId, customerId)

    const membership = await customerClubService.leave({
      organizationId,
      customerId,
      actorUserId: session.user.id,
    })

    return NextResponse.json({ membership })
  } catch (error) {
    return jsonError(error, "Error leaving customer club")
  }
}
