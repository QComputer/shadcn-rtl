import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { campaignBuilderService } from "@/lib/services/campaign-builder.service"

const sendCampaignSchema = z.object({
  organizationId: z.string().min(1),
  dryRun: z.boolean().optional().default(false),
})

async function resolveCampaignOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
  const session = await requireAuthSession()
  const requestedOrganizationId = organizationIdFromBody ?? request.nextUrl.searchParams.get("organizationId")?.trim() ?? null
  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = sendCampaignSchema.parse(await request.json())
    const { session, organizationId } = await resolveCampaignOrganization(request, body.organizationId)
    const result = await campaignBuilderService.sendCampaign(organizationId, id, session.user.id, body.dryRun)
    return NextResponse.json(result, { status: body.dryRun ? 200 : 201 })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error sending campaign")
  }
}
