import { NextRequest, NextResponse } from "next/server"
import { ApiError, jsonError, requireAuthSession, requireCurrentOrganizationId, requireOrgAccess } from "@/lib/api-guards"
import { getWebPushRuntimeConfig } from "@/lib/services/web-push-foundation.service"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF", "SUPER_ADMIN"])

    const config = getWebPushRuntimeConfig()

    return NextResponse.json({
      ok: true,
      secureContextRequired: true,
      vapidPublicKeyConfigured: config.publicKeyConfigured,
      vapidPrivateKeyConfigured: config.privateKeyConfigured,
      dashboardPushRouteConfigured: true,
      customerPushRouteConfigured: true,
      provider: config.provider,
      dryRun: config.dryRun,
      realSendEnabled: config.realSendEnabled,
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load Web Push diagnostics")
  }
}
