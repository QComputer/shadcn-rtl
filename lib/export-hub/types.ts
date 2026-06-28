import type { ExportDataType, ExportJobFormat, ExportJobStatus } from "@prisma/client"

export const exportDataTypes = [
  "PRODUCTS",
  "PRODUCT_CATEGORIES",
  "ORDERS",
  "CUSTOMERS",
  "FANPAGE_POSTS",
] as const satisfies readonly ExportDataType[]

export const exportJobFormats = [
  "JSON",
  "CSV",
] as const satisfies readonly ExportJobFormat[]

export const exportJobStatuses = [
  "QUEUED",
  "COMPLETED",
  "FAILED",
  "CANCELED",
] as const satisfies readonly ExportJobStatus[]

export type CreateExportJobInput = {
  organizationId: string
  actorUserId: string
  type: (typeof exportDataTypes)[number]
  format: (typeof exportJobFormats)[number]
}

export type ExportJobListOptions = {
  organizationId?: string | null
  status?: (typeof exportJobStatuses)[number] | null
  take?: number
}
