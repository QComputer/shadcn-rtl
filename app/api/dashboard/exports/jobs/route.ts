import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { exportDataTypes, exportJobFormats, exportJobStatuses } from "@/lib/export-hub/types"
import { exportHubService } from "@/lib/services/export-hub.service"
import type { ExportJobStatus } from "@prisma/client"

const createExportJobSchema = z.object({
  organizationId: z.string().trim().min(1),
  type: z.enum(exportDataTypes),
  format: z.enum(exportJobFormats).default("JSON"),
})

async function resolveExportsOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
  const session = await requireAuthSession()
  const requestedOrganizationId = organizationIdFromBody ?? request.nextUrl.searchParams.get("organizationId")?.trim() ?? null

  if (session.user.role === "SUPER_ADMIN" && !requestedOrganizationId) {
    return { session, organizationId: null }
  }

  const organizationId = await requireCurrentOrganizationId(session, requestedOrganizationId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await resolveExportsOrganization(request)
    const statusParam = request.nextUrl.searchParams.get("status")?.trim() || null
    const status = statusParam && exportJobStatuses.includes(statusParam as ExportJobStatus)
      ? (statusParam as ExportJobStatus)
      : null
    const jobs = await exportHubService.listJobs({ organizationId, status })
    return NextResponse.json({ jobs })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading export jobs")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createExportJobSchema.parse(await request.json())
    const { session, organizationId } = await resolveExportsOrganization(request, body.organizationId)
    if (!organizationId) throw new ApiError(400, "Organization ID is required")

    const job = await exportHubService.createJob({
      organizationId,
      actorUserId: session.user.id,
      type: body.type,
      format: body.format,
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error creating export job")
  }
}
