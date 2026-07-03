import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { smsService } from "@/lib/sms"
import { maskPhoneNumber } from "@/lib/sms/phone-normalization"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"])

    const config = smsService.getConfig()

    return NextResponse.json({
      provider: config.provider,
      dryRun: config.dryRun,
      realSendEnabled: config.realSendEnabled,
      apiKeyConfigured: config.apiKeyConfigured,
      lineNumberConfigured: config.lineNumberConfigured,
      guestRealSendEnabled: false,
      baseUrlConfigured: typeof config.baseUrl === "string" && config.baseUrl.length > 0,
      timeoutMs: config.timeoutMs,
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load SMS diagnostics")
  }
}
