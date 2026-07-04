import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { smsDeliveryReportService } from "@/lib/sms/sms-delivery-report.service"

export async function GET(request: NextRequest, { params }: { params: Promise<{ deliveryId: string }> }) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"])

    const resolved = await params
    const row = await smsDeliveryReportService.getDeliveryDetail(organizationId, resolved.deliveryId)

    if (!row) {
      throw new ApiError(404, "SMS delivery not found")
    }

    return NextResponse.json({
      ok: true,
      providerReportAvailable: false,
      reason: "SMS_IR_REPORT_ENDPOINT_NOT_CONFIGURED",
      data: row,
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load SMS delivery detail")
  }
}
