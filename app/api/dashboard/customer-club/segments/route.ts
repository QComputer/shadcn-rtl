import { NextRequest, NextResponse } from "next/server"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { customerSegmentsService } from "@/lib/services/customer-segments.service"

async function resolveSegmentOrganization(request: NextRequest) {
  const session = await requireAuthSession()
  const requestedOrganizationId = request.nextUrl.searchParams.get("organizationId")?.trim() || null
  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await resolveSegmentOrganization(request)
    const segments = await customerSegmentsService.listSegments(organizationId)
    return NextResponse.json({ segments })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading customer segments")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, organizationId } = await resolveSegmentOrganization(request)
    const segments = await customerSegmentsService.saveSnapshot(organizationId, session.user.id)
    return NextResponse.json({ segments, saved: segments.length }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error saving customer segment snapshots")
  }
}
