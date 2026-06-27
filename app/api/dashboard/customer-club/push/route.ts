import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { webPushFoundationService } from "@/lib/services/web-push-foundation.service"

const organizationIdSchema = z.string().trim().min(1)

const dryRunPushSchema = z.object({
  organizationId: organizationIdSchema,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  dryRun: z.boolean().default(true),
})

async function resolvePushOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
  const session = await requireAuthSession()
  const requestedOrganizationId = organizationIdFromBody ?? request.nextUrl.searchParams.get("organizationId")?.trim() ?? null
  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await resolvePushOrganization(request)
    const push = await webPushFoundationService.listDashboard(organizationId)
    return NextResponse.json(push)
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading Web Push foundation")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = dryRunPushSchema.parse(await request.json())
    const { session, organizationId } = await resolvePushOrganization(request, body.organizationId)
    const result = await webPushFoundationService.send({
      organizationId,
      actorUserId: session.user.id,
      title: body.title,
      body: body.body,
      dryRun: body.dryRun,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error previewing Web Push delivery")
  }
}
