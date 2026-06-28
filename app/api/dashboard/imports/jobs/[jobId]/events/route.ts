import { NextResponse } from "next/server"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards"
import { importHubService } from "@/lib/services/import-hub.service"

type ImportJobRouteContext = {
  params: Promise<{ jobId: string }>
}

async function requireImportJobAccess(jobId: string) {
  const session = await requireAuthSession()
  const organizationId = await importHubService.getJobOrganizationId(jobId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { organizationId }
}

export async function GET(_request: Request, context: ImportJobRouteContext) {
  try {
    const { jobId } = await context.params
    const { organizationId } = await requireImportJobAccess(jobId)
    const events = await importHubService.listJobAuditEvents(jobId, organizationId)
    return NextResponse.json({ events })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading import audit events")
  }
}
