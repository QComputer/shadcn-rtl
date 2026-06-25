import { NextRequest, NextResponse } from "next/server"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { customerClubService } from "@/lib/services/customer-club.service"

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession()
    const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")?.trim() || null
    const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)

    await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])

    const members = await customerClubService.listMembers(organizationId)
    return NextResponse.json({ members })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading customer club members")
  }
}
