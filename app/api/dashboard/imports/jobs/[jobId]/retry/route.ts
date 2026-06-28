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
  return { session, organizationId }
}

export async function POST(_request: Request, context: ImportJobRouteContext) {
  try {
    const { jobId } = await context.params
    const { session, organizationId } = await requireImportJobAccess(jobId)
    const job = await importHubService.retryJob(jobId, organizationId, session.user.id)
    return NextResponse.json({ job })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error retrying import job")
  }
}
