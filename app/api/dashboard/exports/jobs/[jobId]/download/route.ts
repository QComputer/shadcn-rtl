import { NextResponse } from "next/server"
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireOrgAccess,
} from "@/lib/api-guards"
import { exportHubService } from "@/lib/services/export-hub.service"

type ExportJobDownloadRouteContext = {
  params: Promise<{ jobId: string }>
}

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "export.dat"
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

async function requireExportJobAccess(jobId: string) {
  const session = await requireAuthSession()
  const organizationId = await exportHubService.getJobOrganizationId(jobId)
  await requireOrgAccess(session, organizationId, ["ADMIN", "MANAGER"])
  return { organizationId }
}

export async function GET(_request: Request, context: ExportJobDownloadRouteContext) {
  try {
    const { jobId } = await context.params
    const { organizationId } = await requireExportJobAccess(jobId)
    const download = await exportHubService.getJobDownload(jobId, organizationId)

    return new NextResponse(download.content, {
      headers: {
        "Content-Disposition": contentDisposition(download.fileName),
        "Content-Type": `${download.mimeType}; charset=utf-8`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error)
    return jsonError(error, "Error downloading export job")
  }
}
