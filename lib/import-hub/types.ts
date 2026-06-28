import type {
  ExternalImportJobStatus,
  ExternalImportSourceType,
  ImportedDraftStatus,
} from "@prisma/client"

export const importSourceTypes = [
  "INSTAGRAM",
  "TELEGRAM",
  "SNAP_FOOD",
  "SNAP_MARKET",
  "CSV",
  "EXCEL",
  "PDF",
  "IMAGE_MENU",
  "MANUAL_URL",
  "MANUAL_TEXT",
  "UNKNOWN",
] as const satisfies readonly ExternalImportSourceType[]

export const reviewableDraftStatuses = [
  "APPROVED",
  "REJECTED",
] as const satisfies readonly ImportedDraftStatus[]

export type ImportJobSummary = {
  phase: "P68_FOUNDATION" | "P69_CSV_EXCEL_PRODUCT_IMPORTER" | "P70_MANUAL_INSTAGRAM_FANPAGE_IMPORT" | "P71_TEXT_PRODUCT_EXTRACTION" | "P72_IMAGE_PDF_MENU_IMPORT" | "P73_SNAPPFOOD_URL_IMPORT" | "P74_SNAPPMARKET_URL_IMPORT"
  draftFirst: true
  importerEnabled: false | "spreadsheet-draft-parser" | "manual-instagram-content-drafts" | "local-rule-based-text-product-extractor" | "dry-run-menu-ocr-fixture" | "snappfood-url-fallback" | "snappmarket-url-fallback"
  message: string
  productDraftCount: number
  contentDraftCount: number
}

export type CreateImportJobInput = {
  organizationId: string
  actorUserId: string
  sourceType?: ExternalImportSourceType | null
  inputUrl?: string | null
  inputText?: string | null
  inputFilename?: string | null
  fileContent?: string | null
  fileBase64?: string | null
  mediaReferences?: string[] | null
  consentConfirmed: boolean
  consentText?: string | null
}

export type ReviewImportDraftsInput = {
  jobId: string
  organizationId: string
  actorUserId: string
  status: (typeof reviewableDraftStatuses)[number]
  productDraftIds?: string[]
  contentDraftIds?: string[]
}

export type ImportJobListOptions = {
  organizationId?: string | null
  status?: ExternalImportJobStatus | null
  take?: number
}
