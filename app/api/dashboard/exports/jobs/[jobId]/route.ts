import { NextResponse } from "next/server"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards"
import { exportHubService } from "@/lib/services/export-hub.service"

type ExportJobRouteContext = {
  params: Promise<{ jobId: string }>
}

async function requireExportJobAccess(jobId: string) {
  const session = await requireAuthSession()
  const organizationId = await exportHubService.getJobOrganizationId(jobId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { organizationId }
}

export async function GET(_request: Request, context: ExportJobRouteContext) {
  try {
    const { jobId } = await context.params
    const { organizationId } = await requireExportJobAccess(jobId)
    const job = await exportHubService.getJob(jobId, organizationId)
    return NextResponse.json({ job })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error loading export job")
  }
}
