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
import type { CustomerSegmentKey } from "@/lib/services/customer-segments.service"

const campaignSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  segmentKey: z.string().trim().min(1),
  message: z.string().trim().min(1).max(500),
  scheduledAt: z.string().trim().datetime().nullable().optional(),
})

async function resolveCampaignOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
  const session = await requireAuthSession()
  const requestedOrganizationId = organizationIdFromBody ?? request.nextUrl.searchParams.get("organizationId")?.trim() ?? null
  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await resolveCampaignOrganization(request)
    const campaigns = await campaignBuilderService.listCampaigns(organizationId)
    return NextResponse.json({ campaigns })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading campaigns")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = campaignSchema.parse(await request.json())
    const { session, organizationId } = await resolveCampaignOrganization(request, body.organizationId)
    const campaign = await campaignBuilderService.createCampaign(organizationId, session.user.id, {
      title: body.title,
      segmentKey: body.segmentKey as CustomerSegmentKey,
      message: body.message,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    })
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error creating campaign")
  }
}
