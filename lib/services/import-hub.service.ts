import { prisma } from "@/lib/db"
import { ApiError } from "@/lib/api-guards"
import { writeAuditLog } from "@/lib/audit-log"
import { buildUniqueCategorySlug } from "@/lib/category-slugs"
import { buildUniqueDetailSlug } from "@/lib/detail-slugs"
import { supportedLocales } from "@/lib/i18n"
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
import { buildImportHubLimitSnapshot, importHubLimits } from "@/lib/import-hub/limits"
import { parseManualInstagramContent } from "@/lib/import-hub/instagram-manual-parser"
import { parseMenuOcrFixture, realMenuOcrEnabled } from "@/lib/import-hub/menu-ocr-fixtures"
import { parseProductSpreadsheet } from "@/lib/import-hub/spreadsheet-parser"
import {
  isSnappfoodUrl,
  parseSnappfoodUrlFixture,
  snappfoodPublicFetchEnabled,
} from "@/lib/import-hub/snappfood-adapter"
import {
  isSnappmarketUrl,
  parseSnappmarketUrlFixture,
  snappmarketPublicFetchEnabled,
} from "@/lib/import-hub/snappmarket-adapter"
import {
  isTelegramPublicPostUrl,
  parseManualTelegramContent,
  telegramFetchEnabled,
} from "@/lib/import-hub/telegram-manual-parser"
import {
  externalTextExtractionEnabled,
  getProductTextExtractionProvider,
} from "@/lib/import-hub/text-extraction-provider"
import {
  findExistingExternalDraftMappings,
  withReimportMetadata,
  withReimportWarning,
  type ReimportCandidate,
} from "@/lib/import-hub/source-mapping"
import type {
  CreateImportJobInput,
  ImportJobListOptions,
  ImportJobSummary,
  ResolveReimportDraftsInput,
  ReviewImportDraftsInput,
} from "@/lib/import-hub/types"
import { reimportResolutionDecisions, reviewableDraftStatuses } from "@/lib/import-hub/types"
import type { ExternalImportSourceType, Prisma } from "@prisma/client"
import { revalidatePath, revalidateTag } from "next/cache"

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

const IMPORTED_CATEGORY_FALLBACK = "واردشده"

function revalidateImportedProductPages(
  organizationSlug: string,
  productSlugs: Array<string | null>,
  categorySlugs: Array<string | null>,
) {
  for (const locale of supportedLocales) {
    revalidatePath(`/${locale}/shop/${organizationSlug}`)
    for (const slug of productSlugs) {
      if (slug) revalidatePath(`/${locale}/shop/${organizationSlug}/product/${slug}`)
    }
    for (const slug of categorySlugs) {
      if (slug) revalidatePath(`/${locale}/shop/${organizationSlug}/category/${slug}`)
    }
  }
  revalidateTag("home-page", "max")
}

function revalidateImportedFanpagePages(organizationSlug: string) {
  for (const locale of supportedLocales) {
    revalidatePath(`/${locale}/shop/${organizationSlug}/fanpage`)
    revalidatePath(`/${locale}/appointment/${organizationSlug}/fanpage`)
  }
  revalidateTag("home-page", "max")
}

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

  async listJobAuditEvents(jobId: string, organizationId: string) {
    const job = await prisma.externalImportJob.findFirst({
      where: { id: jobId, organizationId },
      select: { id: true },
    })
    if (!job) throw new ApiError(404, "Import job not found")

    return prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: "ExternalImportJob",
        entityId: jobId,
      },
      orderBy: { createdAt: "desc" },
      take: importHubLimits.auditEventPageSize,
      select: {
        id: true,
        action: true,
        description: true,
        previousValue: true,
        newValue: true,
        userId: true,
        createdAt: true,
      },
    })
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
    const parsedSnappmarketProductDrafts = type === "SNAP_MARKET" && normalizedUrl
      ? parseSnappmarketUrlFixture({ sourceUrl: normalizedUrl })
      : []
    const parsedProductDrafts = [
      ...parsedSpreadsheetProductDrafts,
      ...parsedTextProductDrafts,
      ...parsedMenuProductDrafts,
      ...parsedSnappfoodProductDrafts,
      ...parsedSnappmarketProductDrafts,
    ]
    const parsedContentDrafts = type === "INSTAGRAM"
      ? [parseManualInstagramContent({
          sourceUrl: input.inputUrl,
          caption: inputText,
          mediaReferences: input.mediaReferences,
        })]
      : type === "TELEGRAM"
      ? [parseManualTelegramContent({
          sourceUrl: input.inputUrl,
          text: inputText,
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
    if (type === "SNAP_MARKET" && !normalizedUrl) {
      throw new ApiError(400, "Snappmarket import requires a seller-provided source URL")
    }
    if (type === "SNAP_MARKET" && normalizedUrl && !isSnappmarketUrl(normalizedUrl)) {
      throw new ApiError(400, "Snappmarket import requires a valid snapp.market or snappmarket.ir URL")
    }
    if (type === "TELEGRAM" && !normalizedUrl) {
      throw new ApiError(400, "Telegram import requires a seller-provided public post URL")
    }
    if (type === "TELEGRAM" && normalizedUrl && !isTelegramPublicPostUrl(normalizedUrl)) {
      throw new ApiError(400, "Telegram import requires a valid public Telegram post URL")
    }
    if (type === "TELEGRAM" && !inputText && parsedContentDrafts[0]?.sourceMetadata.mediaReferences.length === 0) {
      throw new ApiError(400, "Telegram import requires pasted content or seller-approved media reference")
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
    const limitSnapshot = await this.assertCreateWithinLimits(organization.id, totalDraftCount)

    const created = await prisma.$transaction(async (tx) => {
      const reimportCandidates: ReimportCandidate[] = [
        ...parsedProductDrafts.map((draft, index) => ({
          key: `product:${index}`,
          kind: "product" as const,
          sourceExternalId: "sourceExternalId" in draft && typeof draft.sourceExternalId === "string"
            ? draft.sourceExternalId
            : draft.rowNumber.toString(),
          sourceUrl: draft.sourceUrl,
          fields: {
            name: draft.name,
            description: draft.description,
            sku: draft.sku,
            categoryName: draft.categoryName,
            basePrice: draft.basePrice,
            stock: draft.stock,
            imageUrl: draft.imageUrl,
          },
        })),
        ...parsedContentDrafts.map((draft, index) => ({
          key: `content:${index}`,
          kind: "content" as const,
          sourceExternalId: draft.sourceExternalId,
          sourceUrl: draft.sourceUrl,
          fields: {
            title: draft.title,
            body: draft.body,
            mediaUrl: draft.mediaUrl,
            mediaType: draft.mediaType,
          },
        })),
      ]
      const reimportMappings = await findExistingExternalDraftMappings(tx, organization.id, reimportCandidates)
      const reimportDuplicateCount = reimportMappings.size
      const summary = this.buildSummary(
        parsedProductDrafts.length,
        parsedContentDrafts.length,
        type,
        Boolean(spreadsheetType),
        parsedTextProductDrafts.length > 0,
        parsedMenuProductDrafts.length > 0,
        parsedSnappfoodProductDrafts.length > 0,
        parsedSnappmarketProductDrafts.length > 0,
        reimportDuplicateCount,
      )

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
              ? type === "TELEGRAM"
                ? "P75_TELEGRAM_POST_IMPORT"
                : "P70_MANUAL_INSTAGRAM_FANPAGE_IMPORT"
              : parsedTextProductDrafts.length > 0
                ? "P71_TEXT_PRODUCT_EXTRACTION"
                : parsedMenuProductDrafts.length > 0
                ? "P72_IMAGE_PDF_MENU_IMPORT"
                : parsedSnappfoodProductDrafts.length > 0
                ? "P73_SNAPPFOOD_URL_IMPORT"
                : parsedSnappmarketProductDrafts.length > 0
                ? "P74_SNAPPMARKET_URL_IMPORT"
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
            snappmarketPublicFetchEnabled: snappmarketPublicFetchEnabled(),
            snappmarketFallback: parsedSnappmarketProductDrafts.length > 0,
            telegramFetchEnabled: telegramFetchEnabled(),
            externalSourceMappingEnabled: true,
            reimportDiffEnabled: true,
            reimportDuplicateCount,
            sourceMappingPhase: "P76_EXTERNAL_SOURCE_MAPPING_REIMPORT_DIFF",
            importHubLimits: limitSnapshot,
            planReadinessMode: importHubLimits.planReadinessMode,
            operationalGuardrailsPhase: "P77_IMPORT_HUB_AUDIT_LIMITS_PLAN_READINESS",
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
          data: parsedProductDrafts.map((draft, index) => {
            const mapping = reimportMappings.get(`product:${index}`) ?? null
            const sourceExternalId = "sourceExternalId" in draft && typeof draft.sourceExternalId === "string"
              ? draft.sourceExternalId
              : draft.rowNumber.toString()
            const sourceMetadata = "sourceMetadata" in draft
              ? draft.sourceMetadata
              : {
                  type,
                  rowNumber: draft.rowNumber,
                  remoteImagePreviewOnly: Boolean(draft.imageUrl),
                }

            return {
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
            sourceExternalId,
            sourceMetadata: withReimportMetadata(sourceMetadata, mapping) as Prisma.InputJsonObject,
            rawData: draft.rawData,
            warnings: withReimportWarning(draft.warnings, mapping) as Prisma.InputJsonArray,
            errors: draft.errors,
            rowNumber: draft.rowNumber,
            }
          }),
        })
      }

      if (parsedContentDrafts.length > 0) {
        await tx.importedContentDraft.createMany({
          data: parsedContentDrafts.map((draft, index) => {
            const mapping = reimportMappings.get(`content:${index}`) ?? null
            return {
            organizationId: organization.id,
            jobId: job.id,
            sourceId: source.id,
            status: "DRAFT" as const,
            title: draft.title,
            body: draft.body,
            mediaUrl: draft.mediaUrl,
            mediaType: draft.mediaType,
            sourceUrl: draft.sourceUrl,
            sourceExternalId: draft.sourceExternalId,
            sourceMetadata: withReimportMetadata(draft.sourceMetadata, mapping) as Prisma.InputJsonObject,
            rawData: draft.rawData,
            warnings: withReimportWarning(draft.warnings, mapping) as Prisma.InputJsonArray,
            }
          }),
        })
      }

      const jobWithCounts = await tx.externalImportJob.findUniqueOrThrow({
        where: { id: job.id },
        include: importJobInclude,
      })

      return { job: jobWithCounts, reimportDuplicateCount }
    })
    const { job, reimportDuplicateCount } = created

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
          ? type === "TELEGRAM"
            ? "manual-telegram-content-drafts"
            : "manual-instagram-content-drafts"
          : parsedTextProductDrafts.length > 0
            ? "local-rule-based-text-product-extractor"
            : parsedMenuProductDrafts.length > 0
            ? "dry-run-menu-ocr-fixture"
            : parsedSnappfoodProductDrafts.length > 0
            ? "snappfood-url-fallback"
            : parsedSnappmarketProductDrafts.length > 0
            ? "snappmarket-url-fallback"
            : spreadsheetType
            ? "spreadsheet-draft-parser"
            : false,
        productDraftCount: parsedProductDrafts.length,
        contentDraftCount: parsedContentDrafts.length,
        externalTextExtractionEnabled: externalTextExtractionEnabled(),
        realMenuOcrEnabled: realMenuOcrEnabled(),
        snappfoodPublicFetchEnabled: snappfoodPublicFetchEnabled(),
        snappmarketPublicFetchEnabled: snappmarketPublicFetchEnabled(),
        telegramFetchEnabled: telegramFetchEnabled(),
        externalSourceMappingEnabled: true,
        reimportDiffEnabled: true,
        reimportDuplicateCount,
        importHubLimits: limitSnapshot,
        planReadinessMode: importHubLimits.planReadinessMode,
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
    if (!["QUEUED", "NEEDS_REVIEW", "FAILED"].includes(existing.status)) {
      throw new ApiError(400, "Only queued, review-needed, or failed import jobs can be canceled")
    }

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

  async retryJob(jobId: string, organizationId: string, actorUserId: string) {
    const existing = await prisma.externalImportJob.findFirst({
      where: { id: jobId, organizationId },
      select: {
        id: true,
        status: true,
        organizationId: true,
        _count: { select: { productDrafts: true, contentDrafts: true } },
      },
    })
    if (!existing) throw new ApiError(404, "Import job not found")
    if (!["FAILED", "CANCELED"].includes(existing.status)) {
      throw new ApiError(400, "Only failed or canceled import jobs can be retried")
    }
    if (existing._count.productDrafts + existing._count.contentDrafts === 0) {
      throw new ApiError(400, "Import job has no drafts to return to review")
    }

    const retriedAt = new Date()
    const job = await prisma.externalImportJob.update({
      where: { id: jobId },
      data: {
        status: "NEEDS_REVIEW",
        startedAt: retriedAt,
        completedAt: null,
        canceledAt: null,
        errorMessage: null,
      },
      include: importJobInclude,
    })

    await writeAuditLog({
      action: "UPDATE",
      entityType: "ExternalImportJob",
      entityId: job.id,
      description: "Import job returned to review after retry",
      previousValue: { status: existing.status },
      newValue: {
        status: job.status,
        productDraftCount: existing._count.productDrafts,
        contentDraftCount: existing._count.contentDrafts,
      },
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
      select: {
        id: true,
        organizationId: true,
        organization: { select: { id: true, slug: true, type: true } },
      },
    })
    if (!job) throw new ApiError(404, "Import job not found")

    const productDraftIds = input.productDraftIds ?? []
    const contentDraftIds = input.contentDraftIds ?? []
    const reviewedAt = new Date()

    if (input.status === "REJECTED") {
      const data = {
        status: "REJECTED" as const,
        reviewedByUserId: input.actorUserId,
        reviewedAt,
      }

      const [productResult, contentResult, remainingProductDrafts, remainingContentDrafts] = await prisma.$transaction([
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
        prisma.importedProductDraft.count({
          where: {
            jobId: input.jobId,
            organizationId: input.organizationId,
            status: "DRAFT",
            id: { notIn: productDraftIds },
          },
        }),
        prisma.importedContentDraft.count({
          where: {
            jobId: input.jobId,
            organizationId: input.organizationId,
            status: "DRAFT",
            id: { notIn: contentDraftIds },
          },
        }),
      ])

      if (remainingProductDrafts + remainingContentDrafts === 0) {
        await prisma.externalImportJob.update({
          where: { id: input.jobId },
          data: {
            status: "COMPLETED",
            completedAt: reviewedAt,
          },
        })
      }

      await writeAuditLog({
        action: "UPDATE",
        entityType: "ExternalImportJob",
        entityId: input.jobId,
        description: "Import drafts rejected after seller review",
        newValue: {
          status: input.status,
          productDraftCount: productResult.count,
          contentDraftCount: contentResult.count,
          remainingDraftCount: remainingProductDrafts + remainingContentDrafts,
        },
        userId: input.actorUserId,
        organizationId: input.organizationId,
      })

      return this.getJob(input.jobId, input.organizationId)
    }

    const publishResult = await prisma.$transaction(async (tx) => {
      const productDrafts = productDraftIds.length
        ? await tx.importedProductDraft.findMany({
            where: {
              id: { in: productDraftIds },
              jobId: input.jobId,
              organizationId: input.organizationId,
              status: "DRAFT",
            },
            orderBy: { createdAt: "asc" },
          })
        : []
      const contentDrafts = contentDraftIds.length
        ? await tx.importedContentDraft.findMany({
            where: {
              id: { in: contentDraftIds },
              jobId: input.jobId,
              organizationId: input.organizationId,
              status: "DRAFT",
            },
            orderBy: { createdAt: "asc" },
          })
        : []

      if (productDrafts.length > 0 && job.organization.type !== "SHOP") {
        throw new ApiError(400, "Product import publishing requires a shop organization")
      }

      const productSlugs: Array<string | null> = []
      const categorySlugs: Array<string | null> = []
      const fanpagePostIds: string[] = []

      for (const draft of productDrafts) {
        const productName = draft.name?.trim()
        if (!productName) throw new ApiError(400, "Approved product drafts require a product name")
        if (draft.basePrice === null) throw new ApiError(400, `Approved product draft ${draft.id} requires a base price`)

        const category = await this.findOrCreateImportedCategory(tx, {
          organizationId: job.organization.id,
          organizationSlug: job.organization.slug,
          name: draft.categoryName?.trim() || IMPORTED_CATEGORY_FALLBACK,
        })
        if (category.slug && !categorySlugs.includes(category.slug)) categorySlugs.push(category.slug)

        const productSlug = await buildUniqueDetailSlug(productName, async (candidate) => {
          const existing = await tx.product.findFirst({
            where: {
              organizationId: job.organization.id,
              slug: candidate,
              deletedAt: null,
            },
            select: { id: true },
          })
          return Boolean(existing)
        })

        const product = await tx.product.create({
          data: {
            organizationId: job.organization.id,
            organizationSlug: job.organization.slug,
            categoryId: category.id,
            name: productName,
            slug: productSlug,
            description: draft.description?.trim() || null,
            basePrice: draft.basePrice,
            image: draft.imageUrl?.trim() || null,
            sku: draft.sku?.trim() || null,
            isActive: true,
            trackInventory: true,
          },
          select: { id: true, slug: true, basePrice: true },
        })

        await tx.productVariant.create({
          data: {
            productId: product.id,
            name: "Default",
            price: product.basePrice,
            sku: draft.sku?.trim() || undefined,
            inventory: draft.stock ?? 0,
          },
        })

        await tx.importedProductDraft.update({
          where: { id: draft.id },
          data: {
            status: "IMPORTED",
            reviewedByUserId: input.actorUserId,
            reviewedAt,
            importedAt: reviewedAt,
          },
        })
        productSlugs.push(product.slug)
      }

      for (const draft of contentDrafts) {
        const body = draft.body?.trim()
        if (!body) throw new ApiError(400, "Approved content drafts require body text")

        const mediaUrl = draft.mediaUrl?.trim() || null
        const post = await tx.fanpagePost.create({
          data: {
            organizationId: job.organization.id,
            authorId: input.actorUserId,
            title: draft.title?.trim() || null,
            body,
            image: mediaUrl && draft.mediaType !== "video" ? mediaUrl : null,
            video: mediaUrl && draft.mediaType === "video" ? mediaUrl : null,
            isPublished: true,
          },
          select: { id: true },
        })

        await tx.importedContentDraft.update({
          where: { id: draft.id },
          data: {
            status: "IMPORTED",
            reviewedByUserId: input.actorUserId,
            reviewedAt,
            importedAt: reviewedAt,
          },
        })
        fanpagePostIds.push(post.id)
      }

      const remainingProductDrafts = await tx.importedProductDraft.count({
        where: { jobId: input.jobId, organizationId: input.organizationId, status: "DRAFT" },
      })
      const remainingContentDrafts = await tx.importedContentDraft.count({
        where: { jobId: input.jobId, organizationId: input.organizationId, status: "DRAFT" },
      })

      if (remainingProductDrafts + remainingContentDrafts === 0) {
        await tx.externalImportJob.update({
          where: { id: input.jobId },
          data: {
            status: "COMPLETED",
            completedAt: reviewedAt,
          },
        })
      }

      return {
        productDraftCount: productDrafts.length,
        contentDraftCount: contentDrafts.length,
        remainingDraftCount: remainingProductDrafts + remainingContentDrafts,
        productSlugs,
        categorySlugs,
        fanpagePostIds,
      }
    })

    if (publishResult.productDraftCount > 0) {
      revalidateImportedProductPages(job.organization.slug, publishResult.productSlugs, publishResult.categorySlugs)
    }
    if (publishResult.contentDraftCount > 0) {
      revalidateImportedFanpagePages(job.organization.slug)
    }

    await writeAuditLog({
      action: "UPDATE",
      entityType: "ExternalImportJob",
      entityId: input.jobId,
      description: "Approved import drafts published to live records",
      newValue: {
        status: "IMPORTED",
        productDraftCount: publishResult.productDraftCount,
        contentDraftCount: publishResult.contentDraftCount,
        remainingDraftCount: publishResult.remainingDraftCount,
        fanpagePostCount: publishResult.fanpagePostIds.length,
      },
      userId: input.actorUserId,
      organizationId: input.organizationId,
    })

    return this.getJob(input.jobId, input.organizationId)
  }

  async resolveReimportDrafts(input: ResolveReimportDraftsInput) {
    if (!reimportResolutionDecisions.includes(input.decision)) {
      throw new ApiError(400, "Invalid re-import resolution decision")
    }

    const job = await prisma.externalImportJob.findFirst({
      where: { id: input.jobId, organizationId: input.organizationId },
      select: { id: true, organizationId: true },
    })
    if (!job) throw new ApiError(404, "Import job not found")

    const productDraftIds = input.productDraftIds ?? []
    const contentDraftIds = input.contentDraftIds ?? []
    const reviewedAt = new Date()
    const status = input.decision === "MERGE"
      ? "MERGED"
      : input.decision === "SKIP"
      ? "REJECTED"
      : "DRAFT"

    const [productResult, contentResult] = input.decision === "CREATE_NEW"
      ? await prisma.$transaction([
          prisma.importedProductDraft.updateMany({
            where: {
              id: { in: productDraftIds },
              jobId: input.jobId,
              organizationId: input.organizationId,
              status: "DRAFT",
            },
            data: { status: "DRAFT" },
          }),
          prisma.importedContentDraft.updateMany({
            where: {
              id: { in: contentDraftIds },
              jobId: input.jobId,
              organizationId: input.organizationId,
              status: "DRAFT",
            },
            data: { status: "DRAFT" },
          }),
        ])
      : await prisma.$transaction([
          prisma.importedProductDraft.updateMany({
            where: {
              id: { in: productDraftIds },
              jobId: input.jobId,
              organizationId: input.organizationId,
              status: "DRAFT",
            },
            data: {
              status,
              reviewedByUserId: input.actorUserId,
              reviewedAt,
            },
          }),
          prisma.importedContentDraft.updateMany({
            where: {
              id: { in: contentDraftIds },
              jobId: input.jobId,
              organizationId: input.organizationId,
              status: "DRAFT",
            },
            data: {
              status,
              reviewedByUserId: input.actorUserId,
              reviewedAt,
            },
          }),
        ])

    const [remainingProductDrafts, remainingContentDrafts] = await prisma.$transaction([
      prisma.importedProductDraft.count({
        where: { jobId: input.jobId, organizationId: input.organizationId, status: "DRAFT" },
      }),
      prisma.importedContentDraft.count({
        where: { jobId: input.jobId, organizationId: input.organizationId, status: "DRAFT" },
      }),
    ])

    if (remainingProductDrafts + remainingContentDrafts === 0) {
      await prisma.externalImportJob.update({
        where: { id: input.jobId },
        data: {
          status: "COMPLETED",
          completedAt: reviewedAt,
        },
      })
    }

    await writeAuditLog({
      action: "UPDATE",
      entityType: "ExternalImportJob",
      entityId: input.jobId,
      description: "Re-import draft resolution recorded",
      newValue: {
        decision: input.decision,
        productDraftCount: productResult.count,
        contentDraftCount: contentResult.count,
        remainingDraftCount: remainingProductDrafts + remainingContentDrafts,
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
    snappmarketImporterEnabled = false,
    reimportDuplicateCount = 0,
  ): ImportJobSummary {
    const withReimportSummary = (summary: ImportJobSummary): ImportJobSummary => reimportDuplicateCount > 0
      ? {
          ...summary,
          message: `${summary.message} Potential re-import matches were flagged for merge, skip, or create-new review.`,
          reimportDiffEnabled: true,
          reimportDuplicateCount,
        }
      : {
          ...summary,
          reimportDiffEnabled: true,
          reimportDuplicateCount: 0,
        }

    if (contentDraftCount > 0 && type === "INSTAGRAM") {
      return withReimportSummary({
        phase: "P70_MANUAL_INSTAGRAM_FANPAGE_IMPORT",
        draftFirst: true,
        importerEnabled: "manual-instagram-content-drafts",
        message: "Manual Instagram content was saved as fanpage drafts. Publishing remains disabled until seller review.",
        productDraftCount,
        contentDraftCount,
      })
    }

    if (contentDraftCount > 0 && type === "TELEGRAM") {
      return withReimportSummary({
        phase: "P75_TELEGRAM_POST_IMPORT",
        draftFirst: true,
        importerEnabled: "manual-telegram-content-drafts",
        message: "Manual Telegram post content was saved as drafts. Telegram fetching remains disabled.",
        productDraftCount,
        contentDraftCount,
      })
    }

    if (productDraftCount > 0 && spreadsheetImporterEnabled) {
      return withReimportSummary({
        phase: "P69_CSV_EXCEL_PRODUCT_IMPORTER",
        draftFirst: true,
        importerEnabled: "spreadsheet-draft-parser",
        message: "Spreadsheet rows were parsed into product drafts. Publishing remains disabled until seller review.",
        productDraftCount,
        contentDraftCount,
      })
    }

    if (productDraftCount > 0 && type === "MANUAL_TEXT" && textImporterEnabled) {
      return withReimportSummary({
        phase: "P71_TEXT_PRODUCT_EXTRACTION",
        draftFirst: true,
        importerEnabled: "local-rule-based-text-product-extractor",
        message: "Pasted text was parsed by the local rule-based extractor into product drafts. External AI calls remain disabled.",
        productDraftCount,
        contentDraftCount,
      })
    }

    if (productDraftCount > 0 && (type === "PDF" || type === "IMAGE_MENU") && menuImporterEnabled) {
      return withReimportSummary({
        phase: "P72_IMAGE_PDF_MENU_IMPORT",
        draftFirst: true,
        importerEnabled: "dry-run-menu-ocr-fixture",
        message: "Image/PDF menu intake was recorded with dry-run OCR fixture rows. Real OCR remains disabled.",
        productDraftCount,
        contentDraftCount,
      })
    }

    if (productDraftCount > 0 && type === "SNAP_FOOD" && snappfoodImporterEnabled) {
      return withReimportSummary({
        phase: "P73_SNAPPFOOD_URL_IMPORT",
        draftFirst: true,
        importerEnabled: "snappfood-url-fallback",
        message: "Snappfood URL intake was recorded with fallback draft rows. Public fetching remains disabled.",
        productDraftCount,
        contentDraftCount,
      })
    }

    if (productDraftCount > 0 && type === "SNAP_MARKET" && snappmarketImporterEnabled) {
      return withReimportSummary({
        phase: "P74_SNAPPMARKET_URL_IMPORT",
        draftFirst: true,
        importerEnabled: "snappmarket-url-fallback",
        message: "Snappmarket URL intake was recorded with fallback draft rows. Public fetching remains disabled.",
        productDraftCount,
        contentDraftCount,
      })
    }

    return withReimportSummary({
      phase: "P68_FOUNDATION",
      draftFirst: true,
      importerEnabled: false,
      message: "Import intake was recorded. Real external parsing and publishing are disabled in this foundation phase.",
      productDraftCount,
      contentDraftCount,
    })
  }

  private async assertCreateWithinLimits(organizationId: string, totalDraftCount: number) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [activeJobCount, jobsTodayCount] = await prisma.$transaction([
      prisma.externalImportJob.count({
        where: {
          organizationId,
          status: { in: ["QUEUED", "NEEDS_REVIEW"] },
        },
      }),
      prisma.externalImportJob.count({
        where: {
          organizationId,
          createdAt: { gte: since },
        },
      }),
    ])
    const snapshot = buildImportHubLimitSnapshot({ activeJobCount, jobsTodayCount })

    if (activeJobCount >= importHubLimits.maxActiveJobsPerOrganization) {
      throw new ApiError(429, "Import Hub active job limit reached for this organization")
    }
    if (jobsTodayCount >= importHubLimits.maxJobsPerOrganizationPerDay) {
      throw new ApiError(429, "Import Hub daily job limit reached for this organization")
    }
    if (totalDraftCount > importHubLimits.maxDraftsPerJob) {
      throw new ApiError(413, "Import Hub draft limit exceeded for this job")
    }

    return snapshot
  }

  private getSourceDisplayName(type: ExternalImportSourceType, normalizedUrl: string | null, filename: string | null) {
    if (filename) return filename
    if (normalizedUrl) return `${getImportSourceLabel(type)} - ${normalizedUrl}`
    return getImportSourceLabel(type)
  }

  private async findOrCreateImportedCategory(
    tx: Prisma.TransactionClient,
    input: { organizationId: string; organizationSlug: string; name: string },
  ) {
    const existing = await tx.productCategory.findFirst({
      where: {
        organizationId: input.organizationId,
        deletedAt: null,
        name: { equals: input.name, mode: "insensitive" },
      },
      select: { id: true, slug: true },
    })
    if (existing) return existing

    const slug = await buildUniqueCategorySlug(input.name, async (candidate) => {
      const category = await tx.productCategory.findFirst({
        where: {
          organizationId: input.organizationId,
          slug: candidate,
          deletedAt: null,
        },
        select: { id: true },
      })
      return Boolean(category)
    })

    return tx.productCategory.create({
      data: {
        organizationId: input.organizationId,
        organizationSlug: input.organizationSlug,
        name: input.name,
        slug,
        isActive: true,
      },
      select: { id: true, slug: true },
    })
  }
}

export const importHubService = new ImportHubService()
