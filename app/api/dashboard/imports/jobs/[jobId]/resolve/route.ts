import { NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards"
import { reimportResolutionDecisions } from "@/lib/import-hub/types"
import { importHubService } from "@/lib/services/import-hub.service"

type ImportJobRouteContext = {
  params: Promise<{ jobId: string }>
}

const resolveSchema = z.object({
  decision: z.enum(reimportResolutionDecisions),
  productDraftIds: z.array(z.string().min(1)).optional(),
  contentDraftIds: z.array(z.string().min(1)).optional(),
})

async function requireImportJobAccess(jobId: string) {
  const session = await requireAuthSession()
  const organizationId = await importHubService.getJobOrganizationId(jobId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { session, organizationId }
}

export async function POST(request: Request, context: ImportJobRouteContext) {
  try {
    const { jobId } = await context.params
    const body = resolveSchema.parse(await request.json())
    const { session, organizationId } = await requireImportJobAccess(jobId)

    const job = await importHubService.resolveReimportDrafts({
      jobId,
      organizationId,
      actorUserId: session.user.id,
      decision: body.decision,
      productDraftIds: body.productDraftIds ?? [],
      contentDraftIds: body.contentDraftIds ?? [],
    })

    return NextResponse.json({ job })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error resolving re-import drafts")
  }
}
