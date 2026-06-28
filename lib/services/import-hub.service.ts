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
import { parseManualInstagramContent } from "@/lib/import-hub/instagram-manual-parser"
import { parseMenuOcrFixture, realMenuOcrEnabled } from "@/lib/import-hub/menu-ocr-fixtures"
import { parseProductSpreadsheet } from "@/lib/import-hub/spreadsheet-parser"
import {
  isSnappfoodUrl,
  parseSnappfoodUrlFixture,
  snappfoodPublicFetchEnabled,
} from "@/lib/import-hub/snappfood-adapter"
import {
  externalTextExtractionEnabled,
  getProductTextExtractionProvider,
} from "@/lib/import-hub/text-extraction-provider"
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
    const menuImportType = type === "PDF" || type === "IMAGE_MENU" ? type : null
    const parsedSpreadsheetProductDrafts = spreadsheetType
      ? parseProductSpreadsheet({
          type: spreadsheetType,
          fileContent: input.fileContent,
          fileBase64: input.fileBase64,
          maxRows: 500,
        })
      : []
    const textExtractionProvider = getProductTextExtractionProvider()
    const parsedTextProductDrafts = type === "MANUAL_TEXT" && inputText
      ? textExtractionProvider.extractProducts({
          text: inputText,
          maxLines: 200,
        })
      : []
    const parsedMenuProductDrafts = menuImportType
      ? parseMenuOcrFixture({
          type: menuImportType,
          filename: inputFilename,
          sourceUrl: normalizedUrl,
        })
      : []
    const parsedSnappfoodProductDrafts = type === "SNAP_FOOD" && normalizedUrl
      ? parseSnappfoodUrlFixture({ sourceUrl: normalizedUrl })
      : []
    const parsedProductDrafts = [
      ...parsedSpreadsheetProductDrafts,
      ...parsedTextProductDrafts,
      ...parsedMenuProductDrafts,
      ...parsedSnappfoodProductDrafts,
    ]
    const parsedContentDrafts = type === "INSTAGRAM"
      ? [parseManualInstagramContent({
          sourceUrl: input.inputUrl,
          caption: inputText,
          mediaReferences: input.mediaReferences,
        })]
      : []
    const totalDraftCount = parsedProductDrafts.length + parsedContentDrafts.length

    if (spreadsheetType && parsedSpreadsheetProductDrafts.length === 0) {
      throw new ApiError(400, "CSV/Excel import did not contain product rows")
    }
    if (type === "MANUAL_TEXT" && inputText && parsedTextProductDrafts.length === 0) {
      throw new ApiError(400, "Manual text import did not contain product-like lines")
    }
    if (menuImportType && !inputFilename && !normalizedUrl) {
      throw new ApiError(400, "Image/PDF menu import requires a file name or source URL")
    }
    if (type === "SNAP_FOOD" && !normalizedUrl) {
      throw new ApiError(400, "Snappfood import requires a seller-provided source URL")
    }
    if (type === "SNAP_FOOD" && normalizedUrl && !isSnappfoodUrl(normalizedUrl)) {
      throw new ApiError(400, "Snappfood import requires a valid snappfood.ir URL")
    }
    if (type === "INSTAGRAM" && !normalizedUrl) {
      throw new ApiError(400, "Instagram import requires a seller-provided post URL")
    }
    if (type === "INSTAGRAM" && normalizedUrl && !/instagram\.com|instagr\.am/i.test(normalizedUrl)) {
      throw new ApiError(400, "Instagram import requires a valid Instagram post URL")
    }
    if (type === "INSTAGRAM" && !inputText && parsedContentDrafts[0]?.sourceMetadata.mediaReferences.length === 0) {
      throw new ApiError(400, "Instagram import requires a pasted caption or seller-approved media reference")
    }

    const summary = this.buildSummary(
      parsedProductDrafts.length,
      parsedContentDrafts.length,
      type,
      Boolean(spreadsheetType),
      parsedTextProductDrafts.length > 0,
      parsedMenuProductDrafts.length > 0,
      parsedSnappfoodProductDrafts.length > 0,
    )

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
            phase: parsedContentDrafts.length > 0
              ? "P70_MANUAL_INSTAGRAM_FANPAGE_IMPORT"
              : parsedTextProductDrafts.length > 0
                ? "P71_TEXT_PRODUCT_EXTRACTION"
                : parsedMenuProductDrafts.length > 0
                ? "P72_IMAGE_PDF_MENU_IMPORT"
                : parsedSnappfoodProductDrafts.length > 0
                ? "P73_SNAPPFOOD_URL_IMPORT"
                : spreadsheetType
                ? "P69_CSV_EXCEL_PRODUCT_IMPORTER"
                : "P68_FOUNDATION",
            draftFirst: true,
            remotePreviewOnly: true,
            blobCopyRequiresReview: true,
            externalTextExtractionEnabled: externalTextExtractionEnabled(),
            realMenuOcrEnabled: realMenuOcrEnabled(),
            dryRunMenuOcrFixture: parsedMenuProductDrafts.length > 0,
            snappfoodPublicFetchEnabled: snappfoodPublicFetchEnabled(),
            snappfoodFallback: parsedSnappfoodProductDrafts.length > 0,
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
          completedAt: totalDraftCount > 0 ? null : new Date(),
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
            sourceMetadata: "sourceMetadata" in draft
              ? draft.sourceMetadata
              : {
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

      if (parsedContentDrafts.length > 0) {
        await tx.importedContentDraft.createMany({
          data: parsedContentDrafts.map((draft) => ({
            organizationId: organization.id,
            jobId: job.id,
            sourceId: source.id,
            status: "DRAFT",
            title: draft.title,
            body: draft.body,
            mediaUrl: draft.mediaUrl,
            mediaType: draft.mediaType,
            sourceUrl: draft.sourceUrl,
            sourceExternalId: draft.sourceExternalId,
            sourceMetadata: draft.sourceMetadata,
            rawData: draft.rawData,
            warnings: draft.warnings,
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
        importerEnabled: parsedContentDrafts.length > 0
          ? "manual-instagram-content-drafts"
          : parsedTextProductDrafts.length > 0
            ? "local-rule-based-text-product-extractor"
            : parsedMenuProductDrafts.length > 0
            ? "dry-run-menu-ocr-fixture"
            : parsedSnappfoodProductDrafts.length > 0
            ? "snappfood-url-fallback"
            : spreadsheetType
            ? "spreadsheet-draft-parser"
            : false,
        productDraftCount: parsedProductDrafts.length,
        contentDraftCount: parsedContentDrafts.length,
        externalTextExtractionEnabled: externalTextExtractionEnabled(),
        realMenuOcrEnabled: realMenuOcrEnabled(),
        snappfoodPublicFetchEnabled: snappfoodPublicFetchEnabled(),
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

  private buildSummary(
    productDraftCount = 0,
    contentDraftCount = 0,
    type: ExternalImportSourceType = "UNKNOWN",
    spreadsheetImporterEnabled = false,
    textImporterEnabled = false,
    menuImporterEnabled = false,
    snappfoodImporterEnabled = false,
  ): ImportJobSummary {
    if (contentDraftCount > 0 && type === "INSTAGRAM") {
      return {
        phase: "P70_MANUAL_INSTAGRAM_FANPAGE_IMPORT",
        draftFirst: true,
        importerEnabled: "manual-instagram-content-drafts",
        message: "Manual Instagram content was saved as fanpage drafts. Publishing remains disabled until seller review.",
        productDraftCount,
        contentDraftCount,
      }
    }

    if (productDraftCount > 0 && spreadsheetImporterEnabled) {
      return {
        phase: "P69_CSV_EXCEL_PRODUCT_IMPORTER",
        draftFirst: true,
        importerEnabled: "spreadsheet-draft-parser",
        message: "Spreadsheet rows were parsed into product drafts. Publishing remains disabled until seller review.",
        productDraftCount,
        contentDraftCount,
      }
    }

    if (productDraftCount > 0 && type === "MANUAL_TEXT" && textImporterEnabled) {
      return {
        phase: "P71_TEXT_PRODUCT_EXTRACTION",
        draftFirst: true,
        importerEnabled: "local-rule-based-text-product-extractor",
        message: "Pasted text was parsed by the local rule-based extractor into product drafts. External AI calls remain disabled.",
        productDraftCount,
        contentDraftCount,
      }
    }

    if (productDraftCount > 0 && (type === "PDF" || type === "IMAGE_MENU") && menuImporterEnabled) {
      return {
        phase: "P72_IMAGE_PDF_MENU_IMPORT",
        draftFirst: true,
        importerEnabled: "dry-run-menu-ocr-fixture",
        message: "Image/PDF menu intake was recorded with dry-run OCR fixture rows. Real OCR remains disabled.",
        productDraftCount,
        contentDraftCount,
      }
    }

    if (productDraftCount > 0 && type === "SNAP_FOOD" && snappfoodImporterEnabled) {
      return {
        phase: "P73_SNAPPFOOD_URL_IMPORT",
        draftFirst: true,
        importerEnabled: "snappfood-url-fallback",
        message: "Snappfood URL intake was recorded with fallback draft rows. Public fetching remains disabled.",
        productDraftCount,
        contentDraftCount,
      }
    }

    return {
      phase: "P68_FOUNDATION",
      draftFirst: true,
      importerEnabled: false,
      message: "Import intake was recorded. Real external parsing and publishing are disabled in this foundation phase.",
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
