import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { smsDeliveryReportService } from "@/lib/sms/sms-delivery-report.service"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"])

    const fromDate = request.nextUrl.searchParams.get("fromDate")
    const toDate = request.nextUrl.searchParams.get("toDate")
    const pageSize = Number(request.nextUrl.searchParams.get("pageSize") || 0)
    const pageNumber = Number(request.nextUrl.searchParams.get("pageNumber") || 0)

    const result = await smsDeliveryReportService.getArchiveReports({
      fromDate: fromDate ? Number(fromDate) : undefined,
      toDate: toDate ? Number(toDate) : undefined,
      pageSize: pageSize > 0 ? pageSize : undefined,
      pageNumber: pageNumber > 0 ? pageNumber : undefined,
    })

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        providerReportAvailable: false,
        reason: result.reason,
        data: [],
      })
    }

    return NextResponse.json({
      ok: true,
      providerReportAvailable: true,
      data: result.data,
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load archive SMS reports")
  }
}
