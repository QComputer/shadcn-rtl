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

const updateCampaignSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  segmentKey: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).max(500).optional(),
  scheduledAt: z.string().trim().datetime().nullable().optional(),
})

async function resolveCampaignOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
  const session = await requireAuthSession()
  const requestedOrganizationId = organizationIdFromBody ?? request.nextUrl.searchParams.get("organizationId")?.trim() ?? null
  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { organizationId } = await resolveCampaignOrganization(request)
    const campaign = await campaignBuilderService.getCampaign(organizationId, id)
    return NextResponse.json({ campaign })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading campaign")
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = updateCampaignSchema.parse(await request.json())
    const { session, organizationId } = await resolveCampaignOrganization(request, body.organizationId)
    const campaign = await campaignBuilderService.updateCampaign(organizationId, id, session.user.id, {
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.segmentKey === "string" ? { segmentKey: body.segmentKey as CustomerSegmentKey } : {}),
      ...(typeof body.message === "string" ? { message: body.message } : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "scheduledAt")
        ? { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }
        : {}),
    })
    return NextResponse.json({ campaign })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error updating campaign")
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { session, organizationId } = await resolveCampaignOrganization(request)
    const campaign = await campaignBuilderService.cancelCampaign(organizationId, id, session.user.id)
    return NextResponse.json({ campaign })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error canceling campaign")
  }
}
