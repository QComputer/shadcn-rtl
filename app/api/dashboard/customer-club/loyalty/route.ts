import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { loyaltyCouponsService } from "@/lib/services/loyalty-coupons.service"

const organizationIdSchema = z.string().trim().min(1)

const createRuleSchema = z.object({
  action: z.literal("createRule"),
  organizationId: organizationIdSchema,
  name: z.string().trim().min(1).max(120),
  spendAmount: z.coerce.number().positive(),
  pointsAwarded: z.coerce.number().int().positive(),
  pointsPerOrder: z.coerce.number().int().min(0).optional(),
  minOrderTotal: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().trim().datetime().nullable().optional(),
  expiresAt: z.string().trim().datetime().nullable().optional(),
})

const awardPurchaseSchema = z.object({
  action: z.literal("awardPurchase"),
  organizationId: organizationIdSchema,
  orderId: z.string().trim().min(1),
})

const manualAdjustmentSchema = z.object({
  action: z.literal("manualAdjust"),
  organizationId: organizationIdSchema,
  customerId: z.string().trim().min(1),
  points: z.coerce.number().int(),
  reason: z.string().trim().min(1).max(160),
})

const loyaltyActionSchema = z.discriminatedUnion("action", [
  createRuleSchema,
  awardPurchaseSchema,
  manualAdjustmentSchema,
])

async function resolveLoyaltyOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
  const session = await requireAuthSession()
  const requestedOrganizationId = organizationIdFromBody ?? request.nextUrl.searchParams.get("organizationId")?.trim() ?? null
  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await resolveLoyaltyOrganization(request)
    const loyalty = await loyaltyCouponsService.listLoyaltyProgram(organizationId)
    return NextResponse.json(loyalty)
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading loyalty program")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = loyaltyActionSchema.parse(await request.json())
    const { session, organizationId } = await resolveLoyaltyOrganization(request, body.organizationId)

    if (body.action === "createRule") {
      const rule = await loyaltyCouponsService.createLoyaltyRule(organizationId, session.user.id, {
        name: body.name,
        spendAmount: body.spendAmount,
        pointsAwarded: body.pointsAwarded,
        pointsPerOrder: body.pointsPerOrder,
        minOrderTotal: body.minOrderTotal,
        isActive: body.isActive,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      })
      return NextResponse.json({ rule }, { status: 201 })
    }

    if (body.action === "awardPurchase") {
      const ledger = await loyaltyCouponsService.awardPurchasePoints(organizationId, session.user.id, body.orderId)
      return NextResponse.json({ ledger }, { status: 201 })
    }

    const ledger = await loyaltyCouponsService.addManualAdjustment(organizationId, session.user.id, {
      customerId: body.customerId,
      points: body.points,
      reason: body.reason,
    })
    return NextResponse.json({ ledger }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error updating loyalty program")
  }
}
