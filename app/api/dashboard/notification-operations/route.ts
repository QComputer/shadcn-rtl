import { NextRequest, NextResponse } from "next/server"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { notificationOperationsService } from "@/lib/services/notification-operations.service"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER", "STAFF"])

    const dashboard = await notificationOperationsService.getDashboard(organizationId)
    return NextResponse.json(dashboard)
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Failed to load notification operations")
  }
}
