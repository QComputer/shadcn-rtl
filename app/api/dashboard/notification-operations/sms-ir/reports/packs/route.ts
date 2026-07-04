import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { createSmsIrClient } from "@/lib/sms/sms-ir-client.server"
import { validatePagination } from "@/lib/sms/sms-ir-report-validation"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"])

    const pageSize = Number(request.nextUrl.searchParams.get("pageSize") || 0)
    const pageNumber = Number(request.nextUrl.searchParams.get("pageNumber") || 0)

    const paginationError = validatePagination({
      pageSize: pageSize > 0 ? pageSize : undefined,
      pageNumber: pageNumber > 0 ? pageNumber : undefined,
    })
    if (paginationError) {
      throw new ApiError(400, paginationError.message)
    }

    const client = createSmsIrClient()
    if (!client) {
      return NextResponse.json({
        ok: false,
        providerReportAvailable: false,
        reason: "SMS_IR_REPORT_ENDPOINT_NOT_CONFIGURED",
        data: [],
      })
    }

    const data = await client.getTodayPacks({
      pageSize: pageSize > 0 ? pageSize : undefined,
      pageNumber: pageNumber > 0 ? pageNumber : undefined,
    })

    return NextResponse.json({
      ok: true,
      providerReportAvailable: true,
      data,
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load SMS packs")
  }
}
