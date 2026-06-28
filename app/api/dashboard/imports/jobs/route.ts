import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  requireOrgAccess,
} from "@/lib/api-guards"
import { importHubService } from "@/lib/services/import-hub.service"
import { importSourceTypes } from "@/lib/import-hub/types"
import type { ExternalImportJobStatus } from "@prisma/client"

const createImportJobSchema = z.object({
  organizationId: z.string().trim().min(1),
  sourceType: z.enum(importSourceTypes).optional(),
  inputUrl: z.string().trim().max(2000).optional().nullable(),
  inputText: z.string().trim().max(12000).optional().nullable(),
  inputFilename: z.string().trim().max(180).optional().nullable(),
  consentConfirmed: z.boolean().default(false),
  consentText: z.string().trim().max(600).optional().nullable(),
})

const statusValues = ["QUEUED", "NEEDS_REVIEW", "COMPLETED", "FAILED", "CANCELED"] as const

async function resolveImportsOrganization(request: NextRequest, organizationIdFromBody?: string | null) {
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
    const { organizationId } = await resolveImportsOrganization(request)
    const statusParam = request.nextUrl.searchParams.get("status")?.trim() || null
    const status = statusParam && statusValues.includes(statusParam as ExternalImportJobStatus)
      ? (statusParam as ExternalImportJobStatus)
      : null

    const jobs = await importHubService.listJobs({ organizationId, status })
    return NextResponse.json({ jobs })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading import jobs")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createImportJobSchema.parse(await request.json())
    const { session, organizationId } = await resolveImportsOrganization(request, body.organizationId)
    if (!organizationId) throw new ApiError(400, "Organization ID is required")

    const job = await importHubService.createJob({
      organizationId,
      actorUserId: session.user.id,
      sourceType: body.sourceType ?? null,
      inputUrl: body.inputUrl ?? null,
      inputText: body.inputText ?? null,
      inputFilename: body.inputFilename ?? null,
      consentConfirmed: body.consentConfirmed,
      consentText: body.consentText ?? null,
    })

    return NextResponse.json({ job }, { status: 201 })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error creating import job")
  }
}
