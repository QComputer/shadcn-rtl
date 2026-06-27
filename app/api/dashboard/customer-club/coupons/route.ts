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
import type { CustomerSegmentKey } from "@/lib/services/customer-segments.service"

const couponSchema = z.object({
  organizationId: z.string().trim().min(1),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(280).nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  discountValue: z.coerce.number().positive(),
  minOrderTotal: z.coerce.number().min(0).nullable().optional(),
  maxDiscountAmount: z.coerce.number().min(0).nullable().optional(),
  startsAt: z.string().trim().datetime().nullable().optional(),
  expiresAt: z.string().trim().datetime().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  perCustomerLimit: z.coerce.number().int().positive().nullable().optional(),
  segmentKey: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
})

async function resolveCouponOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
  const session = await requireAuthSession()
  const requestedOrganizationId = organizationIdFromBody ?? request.nextUrl.searchParams.get("organizationId")?.trim() ?? null
  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await resolveCouponOrganization(request)
    const coupons = await loyaltyCouponsService.listCoupons(organizationId)
    return NextResponse.json({ coupons })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading coupons")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = couponSchema.parse(await request.json())
    const { session, organizationId } = await resolveCouponOrganization(request, body.organizationId)
    const coupon = await loyaltyCouponsService.createCoupon(organizationId, session.user.id, {
      code: body.code,
      name: body.name,
      description: body.description,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minOrderTotal: body.minOrderTotal,
      maxDiscountAmount: body.maxDiscountAmount,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      usageLimit: body.usageLimit,
      perCustomerLimit: body.perCustomerLimit,
      segmentKey: body.segmentKey as CustomerSegmentKey | null | undefined,
      isActive: body.isActive,
    })
    return NextResponse.json({ coupon }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error creating coupon")
  }
}
