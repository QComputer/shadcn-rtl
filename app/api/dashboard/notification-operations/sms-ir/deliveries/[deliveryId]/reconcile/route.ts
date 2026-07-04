import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { smsDeliveryReportService } from "@/lib/sms/sms-delivery-report.service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ deliveryId: string }> }) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "SUPER_ADMIN"])

    const resolved = await params
    const result = await smsDeliveryReportService.reconcileFromInternalState(organizationId, resolved.deliveryId)

    return NextResponse.json({
      ok: result.ok,
      providerReportAvailable: result.providerReportAvailable,
      reason: result.reason,
      data: result,
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to reconcile SMS delivery")
  }
}

export async function GET() {
  throw new ApiError(405, "Method Not Allowed")
}
