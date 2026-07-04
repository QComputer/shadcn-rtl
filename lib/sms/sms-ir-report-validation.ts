export type SmsIrReportValidationError = {
  field: string
  message: string
}

export function validateMessageId(messageId: unknown): SmsIrReportValidationError | null {
  if (!Number.isInteger(messageId) || Number(messageId) <= 0) {
    return { field: "messageId", message: "messageId must be a positive integer" }
  }
  return null
}

export function validatePackId(packId: unknown): SmsIrReportValidationError | null {
  if (typeof packId !== "string" || packId.trim().length === 0) {
    return { field: "packId", message: "packId must be a non-empty string" }
  }
  return null
}

export function validatePageSize(pageSize: unknown): SmsIrReportValidationError | null {
  if (!Number.isInteger(pageSize) || Number(pageSize) < 1 || Number(pageSize) > 100) {
    return { field: "pageSize", message: "pageSize must be an integer between 1 and 100" }
  }
  return null
}

export function validatePageNumber(pageNumber: unknown): SmsIrReportValidationError | null {
  if (!Number.isInteger(pageNumber) || Number(pageNumber) < 1) {
    return { field: "pageNumber", message: "pageNumber must be an integer >= 1" }
  }
  return null
}

export function validateUnixTimestamp(value: unknown, field = "date"): SmsIrReportValidationError | null {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    return { field, message: `${field} must be a Unix timestamp in seconds` }
  }
  return null
}

export function validateArchiveRange(fromDate: unknown, toDate: unknown): SmsIrReportValidationError | null {
  const from = Number(fromDate)
  const to = Number(toDate)

  if (!Number.isInteger(fromDate) || from <= 0) {
    return { field: "fromDate", message: "fromDate must be a Unix timestamp in seconds" }
  }
  if (!Number.isInteger(toDate) || to <= 0) {
    return { field: "toDate", message: "toDate must be a Unix timestamp in seconds" }
  }
  if (from > to) {
    return { field: "range", message: "fromDate must be <= toDate" }
  }

  const maxRangeDays = 365
  const maxRangeSeconds = maxRangeDays * 24 * 60 * 60
  if (to - from > maxRangeSeconds) {
    return { field: "range", message: `archive range cannot exceed ${maxRangeDays} days` }
  }

  return null
}

export function validatePagination(input: { pageSize?: unknown; pageNumber?: unknown }): SmsIrReportValidationError | null {
  if (input.pageSize !== undefined) {
    const error = validatePageSize(input.pageSize)
    if (error) return error
  }
  if (input.pageNumber !== undefined) {
    const error = validatePageNumber(input.pageNumber)
    if (error) return error
  }
  return null
}

export function validateArchiveInput(input: { fromDate?: unknown; toDate?: unknown; pageSize?: unknown; pageNumber?: unknown }): SmsIrReportValidationError | null {
  if (input.fromDate !== undefined || input.toDate !== undefined) {
    if (input.fromDate === undefined || input.toDate === undefined) {
      return { field: "range", message: "archive requires both fromDate and toDate" }
    }
    const error = validateArchiveRange(input.fromDate, input.toDate)
    if (error) return error
  }
  return validatePagination(input)
}

export function maskMobile(mobile: string): string {
  if (!mobile || mobile.length < 4) return "****"
  return `${mobile.slice(0, 3)}***${mobile.slice(-4)}`
}

export function sanitizeProviderRawData<T extends Record<string, unknown>>(data: T): T {
  const sanitized = { ...data } as Record<string, unknown>

  if (typeof sanitized.mobile === "string") {
    sanitized.mobile = maskMobile(sanitized.mobile)
  }
  if (typeof sanitized.messageText === "string" && sanitized.messageText.length > 200) {
    sanitized.messageText = sanitized.messageText.slice(0, 200)
  }

  return sanitized as T
}
