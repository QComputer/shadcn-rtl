import { NextResponse } from "next/server"
import { z } from "zod"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards"
import { importHubService } from "@/lib/services/import-hub.service"
import { reviewableDraftStatuses } from "@/lib/import-hub/types"

type ImportJobRouteContext = {
  params: Promise<{ jobId: string }>
}

const reviewSchema = z.object({
  status: z.enum(reviewableDraftStatuses),
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
    const body = reviewSchema.parse(await request.json())
    const { session, organizationId } = await requireImportJobAccess(jobId)

    const job = await importHubService.reviewDrafts({
      jobId,
      organizationId,
      actorUserId: session.user.id,
      status: body.status,
      productDraftIds: body.productDraftIds ?? [],
      contentDraftIds: body.contentDraftIds ?? [],
    })

    return NextResponse.json({ job })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error reviewing import drafts")
  }
}
