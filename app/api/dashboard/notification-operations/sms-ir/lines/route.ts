import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { smsService } from "@/lib/sms"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"])

    const pageSizeParam = request.nextUrl.searchParams.get("pageSize")
    const pageSize = pageSizeParam ? Math.min(Number(pageSizeParam), 100) : undefined

    const result = await smsService.getProviderLines({ pageSize })

    if (!result.ok) {
      throw new ApiError(409, result.error || "Failed to load SMS lines")
    }

    return NextResponse.json({
      lines: result.lines || [],
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load SMS lines")
  }
}
