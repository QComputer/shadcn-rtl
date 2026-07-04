import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { smsDeliveryReportService } from "@/lib/sms/sms-delivery-report.service"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"])

    const dryRunParam = request.nextUrl.searchParams.get("dryRun")
    const statusParam = request.nextUrl.searchParams.get("status")
    const purposeParam = request.nextUrl.searchParams.get("purpose")
    const from = request.nextUrl.searchParams.get("from")
    const to = request.nextUrl.searchParams.get("to")

    const filter: {
      dryRun?: boolean
      status?: "PENDING" | "SENT" | "FAILED" | "SKIPPED"
      purpose?: string
      from?: string
      to?: string
    } = {}

    if (dryRunParam === "true") filter.dryRun = true
    else if (dryRunParam === "false") filter.dryRun = false
    if (statusParam) filter.status = statusParam as typeof filter.status
    if (purposeParam) filter.purpose = purposeParam
    if (from) filter.from = from
    if (to) filter.to = to

    const rows = await smsDeliveryReportService.getDeliveries(organizationId, filter)

    return NextResponse.json({
      ok: true,
      data: rows,
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load SMS delivery reports")
  }
}
