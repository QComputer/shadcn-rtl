import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import {
  detectImportSourceType,
  isThirdPartyUrlSource,
  normalizeImportUrl,
} from "@/lib/import-hub/source-detection"
import {
  getImportSourceLabel,
  normalizeImportFilename,
  normalizeImportText,
} from "@/lib/import-hub/normalizers"
import { parseProductSpreadsheet } from "@/lib/import-hub/spreadsheet-parser"
import type {
  CreateImportJobInput,
  ImportJobListOptions,
  ImportJobSummary,
  ReviewImportDraftsInput,
} from "@/lib/import-hub/types"
import { reviewableDraftStatuses } from "@/lib/import-hub/types"
import type { ExternalImportSourceType, ImportedDraftStatus, Prisma } from "@prisma/client"

const importJobInclude = {
  organization: {
    select: { id: true, name: true, slug: true, type: true },
  },
  source: {
    select: {
      id: true,
      type: true,
      status: true,
      displayName: true,
      sourceUrl: true,
      normalizedUrl: true,
      consentConfirmed: true,
      createdAt: true,
    },
  },
  requestedBy: {
    select: { id: true, name: true, email: true },
  },
  _count: {
    select: { productDrafts: true, contentDrafts: true },
  },
} satisfies Prisma.ExternalImportJobInclude

export class ImportHubService {
  async listJobs(options: ImportJobListOptions = {}) {
    return prisma.externalImportJob.findMany({
      where: {
        ...(options.organizationId ? { organizationId: options.organizationId } : {}),
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(options.take ?? 40, 1), 100),
      include: importJobInclude,
    })
  }

  async getJob(jobId: string, organizationId?: string | null) {
    const job = await prisma.externalImportJob.findFirst({
      where: {
        id: jobId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        ...importJobInclude,
        productDrafts: {
          orderBy: { createdAt: "asc" },
          take: 100,
        },
        contentDrafts: {
          orderBy: { createdAt: "asc" },
          take: 100,
        },
      },
    })

    if (!job) throw new ApiError(404, "Import job not found")
    return job
  }

  async getJobOrganizationId(jobId: string) {
    const job = await prisma.externalImportJob.findUnique({
      where: { id: jobId },
      select: { organizationId: true },
    })

    if (!job) throw new ApiError(404, "Import job not found")
    return job.organizationId
  }

  async createJob(input: CreateImportJobInput) {
    const organization = await prisma.organization.findFirst({
      where: { id: input.organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, slug: true },
    })
    if (!organization) throw new ApiError(404, "Organization not found")

    const inputText = normalizeImportText(input.inputText)
    const inputFilename = normalizeImportFilename(input.inputFilename)
    const normalizedUrl = normalizeImportUrl(input.inputUrl)
    const type = detectImportSourceType({
      url: input.inputUrl,
      text: inputText,
      filename: inputFilename,
      fallback: input.sourceType,
    })

    if (!normalizedUrl && !inputText && !inputFilename) {
      throw new ApiError(400, "Import URL, text, or file placeholder is required")
    }

    if (normalizedUrl && isThirdPartyUrlSource(type) && !input.consentConfirmed) {
      throw new ApiError(400, "Seller ownership or permission confirmation is required")
    }

    const consentText = input.consentText?.trim() || null
    const displayName = this.getSourceDisplayName(type, normalizedUrl, inputFilename)
    const spreadsheetType = type === "CSV" || type === "EXCEL" ? type : null
    const parsedProductDrafts = spreadsheetType
      ? parseProductSpreadsheet({
          type: spreadsheetType,
          fileContent: input.fileContent,
          fileBase64: input.fileBase64,
          maxRows: 500,
        })
      : []

    if (spreadsheetType && parsedProductDrafts.length === 0) {
      throw new ApiError(400, "CSV/Excel import did not contain product rows")
    }

    const summary = this.foundationSummary(parsedProductDrafts.length, 0)

    const job = await prisma.$transaction(async (tx) => {
      const source = await tx.externalImportSource.create({
        data: {
          organizationId: organization.id,
          type,
          status: "DRAFT",
          displayName,
          sourceUrl: input.inputUrl?.trim() || null,
          normalizedUrl,
          consentConfirmed: input.consentConfirmed,
          consentText,
          createdByUserId: input.actorUserId,
          metadata: {
            phase: "P68_FOUNDATION",
            draftFirst: true,
            remotePreviewOnly: true,
            blobCopyRequiresReview: true,
          },
        },
      })

      const job = await tx.externalImportJob.create({
        data: {
          organizationId: organization.id,
          sourceId: source.id,
          type,
          status: "NEEDS_REVIEW",
          inputUrl: input.inputUrl?.trim() || null,
          inputText,
          inputFilename,
          consentConfirmed: input.consentConfirmed,
          consentText,
          requestedByUserId: input.actorUserId,
          startedAt: new Date(),
          completedAt: parsedProductDrafts.length > 0 ? null : new Date(),
          summary: summary as unknown as Prisma.InputJsonObject,
        },
        include: importJobInclude,
      })

      if (parsedProductDrafts.length > 0) {
        await tx.importedProductDraft.createMany({
          data: parsedProductDrafts.map((draft) => ({
            organizationId: organization.id,
            jobId: job.id,
            sourceId: source.id,
            status: "DRAFT",
            name: draft.name,
            description: draft.description,
            sku: draft.sku,
            categoryName: draft.categoryName,
            basePrice: draft.basePrice,
            stock: draft.stock,
            imageUrl: draft.imageUrl,
            sourceUrl: draft.sourceUrl,
            sourceExternalId: draft.rowNumber.toString(),
            sourceMetadata: {
              type,
              rowNumber: draft.rowNumber,
              remoteImagePreviewOnly: Boolean(draft.imageUrl),
            },
            rawData: draft.rawData,
            warnings: draft.warnings,
            errors: draft.errors,
            rowNumber: draft.rowNumber,
          })),
        })
      }

      return tx.externalImportJob.findUniqueOrThrow({
        where: { id: job.id },
        include: importJobInclude,
      })
    })

    await writeAuditLog({
      action: "CREATE",
      entityType: "ExternalImportJob",
      entityId: job.id,
      description: "Import Hub foundation job created as draft-first review shell",
      newValue: {
        organizationId: organization.id,
        type,
        status: job.status,
        consentConfirmed: job.consentConfirmed,
        importerEnabled: spreadsheetType ? "spreadsheet-draft-parser" : false,
        productDraftCount: parsedProductDrafts.length,
      },
      userId: input.actorUserId,
      organizationId: organization.id,
    })

    return job
  }

  async cancelJob(jobId: string, organizationId: string, actorUserId: string) {
    const existing = await prisma.externalImportJob.findFirst({
      where: { id: jobId, organizationId },
      select: { id: true, status: true, organizationId: true },
    })
    if (!existing) throw new ApiError(404, "Import job not found")
    if (existing.status === "CANCELED") return this.getJob(jobId, organizationId)

    const job = await prisma.externalImportJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        errorMessage: null,
      },
      include: importJobInclude,
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "ExternalImportJob",
      entityId: job.id,
      description: "Import job canceled",
      previousValue: { status: existing.status },
      newValue: { status: job.status },
      userId: actorUserId,
      organizationId,
    })

    return job
  }

  async reviewDrafts(input: ReviewImportDraftsInput) {
    if (!reviewableDraftStatuses.includes(input.status)) {
      throw new ApiError(400, "Only APPROVED or REJECTED draft review is allowed in this phase")
    }

    const job = await prisma.externalImportJob.findFirst({
      where: { id: input.jobId, organizationId: input.organizationId },
      select: { id: true, organizationId: true },
    })
    if (!job) throw new ApiError(404, "Import job not found")

    const productDraftIds = input.productDraftIds ?? []
    const contentDraftIds = input.contentDraftIds ?? []
    const reviewedAt = new Date()
    const data = {
      status: input.status as ImportedDraftStatus,
      reviewedByUserId: input.actorUserId,
      reviewedAt,
    }

    const [productResult, contentResult] = await prisma.$transaction([
      prisma.importedProductDraft.updateMany({
        where: {
          id: { in: productDraftIds },
          jobId: input.jobId,
          organizationId: input.organizationId,
          status: "DRAFT",
        },
        data,
      }),
      prisma.importedContentDraft.updateMany({
        where: {
          id: { in: contentDraftIds },
          jobId: input.jobId,
          organizationId: input.organizationId,
          status: "DRAFT",
        },
        data,
      }),
      prisma.externalImportJob.update({
        where: { id: input.jobId },
        data: {
          status: "COMPLETED",
          completedAt: reviewedAt,
        },
      }),
    ])

    await writeAuditLog({
      action: "UPDATE",
      entityType: "ExternalImportJob",
      entityId: input.jobId,
      description: "Import drafts reviewed without publishing",
      newValue: {
        status: input.status,
        productDraftCount: productResult.count,
        contentDraftCount: contentResult.count,
      },
      userId: input.actorUserId,
      organizationId: input.organizationId,
    })

    return this.getJob(input.jobId, input.organizationId)
  }

  private foundationSummary(productDraftCount = 0, contentDraftCount = 0): ImportJobSummary {
    return {
      phase: "P68_FOUNDATION",
      draftFirst: true,
      importerEnabled: false,
      message: productDraftCount > 0
        ? "Spreadsheet rows were parsed into product drafts. Publishing remains disabled until seller review."
        : "Import intake was recorded. Real external parsing and publishing are disabled in this foundation phase.",
      productDraftCount,
      contentDraftCount,
    }
  }

  private getSourceDisplayName(type: ExternalImportSourceType, normalizedUrl: string | null, filename: string | null) {
    if (filename) return filename
    if (normalizedUrl) return `${getImportSourceLabel(type)} - ${normalizedUrl}`
    return getImportSourceLabel(type)
  }
}

export const importHubService = new ImportHubService()
