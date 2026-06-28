import type { Prisma } from "@prisma/client"

export type ReimportDraftKind = "product" | "content"

export type ReimportCandidate = {
  key: string
  kind: ReimportDraftKind
  sourceExternalId?: string | null
  sourceUrl?: string | null
  fields: Record<string, unknown>
}

export type ReimportMapping = {
  isDuplicate: true
  existingDraftId: string
  existingStatus: string
  matchFields: string[]
  diffSummary: {
    changedFields: string[]
    unchangedFields: string[]
  }
  suggestedDecision: "MERGE" | "SKIP" | "CREATE_NEW"
  decisionOptions: ["MERGE", "SKIP", "CREATE_NEW"]
}

type SourceMappingTx = Pick<Prisma.TransactionClient, "importedProductDraft" | "importedContentDraft">

const decisionOptions: ["MERGE", "SKIP", "CREATE_NEW"] = ["MERGE", "SKIP", "CREATE_NEW"]

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

function sameValue(left: unknown, right: unknown) {
  return String(left ?? "").trim() === String(right ?? "").trim()
}

function buildReimportDiffSummary(candidateFields: Record<string, unknown>, existingFields: Record<string, unknown>) {
  const changedFields: string[] = []
  const unchangedFields: string[] = []

  for (const [field, value] of Object.entries(candidateFields)) {
    if (value == null || value === "") continue
    if (sameValue(value, existingFields[field])) unchangedFields.push(field)
    else changedFields.push(field)
  }

  return { changedFields, unchangedFields }
}

function toPlainMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...(metadata as Record<string, unknown>) }
    : {}
}

export function withReimportMetadata(metadata: unknown, mapping: ReimportMapping | null) {
  const base = toPlainMetadata(metadata)
  if (!mapping) return base
  return {
    ...base,
    reimport: mapping,
  }
}

export function withReimportWarning(warnings: unknown, mapping: ReimportMapping | null) {
  const existing = Array.isArray(warnings) ? warnings.filter((warning): warning is string => typeof warning === "string") : []
  if (!mapping) return existing
  return [
    ...existing,
    "Potential re-import match found. Review diff before merge, skip, or create-new decision.",
  ]
}

export async function findExistingExternalDraftMappings(
  tx: SourceMappingTx,
  organizationId: string,
  candidates: ReimportCandidate[],
) {
  const mappings = new Map<string, ReimportMapping>()
  const productCandidates = candidates.filter((candidate) => candidate.kind === "product")
  const contentCandidates = candidates.filter((candidate) => candidate.kind === "content")
  const productExternalIds = compactUnique(productCandidates.map((candidate) => candidate.sourceExternalId))
  const productUrls = compactUnique(productCandidates.map((candidate) => candidate.sourceUrl))
  const contentExternalIds = compactUnique(contentCandidates.map((candidate) => candidate.sourceExternalId))
  const contentUrls = compactUnique(contentCandidates.map((candidate) => candidate.sourceUrl))

  const [productDrafts, contentDrafts] = await Promise.all([
    productExternalIds.length > 0 || productUrls.length > 0
      ? tx.importedProductDraft.findMany({
          where: {
            organizationId,
            OR: [
              ...(productExternalIds.length > 0 ? [{ sourceExternalId: { in: productExternalIds } }] : []),
              ...(productUrls.length > 0 ? [{ sourceUrl: { in: productUrls } }] : []),
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            status: true,
            sourceExternalId: true,
            sourceUrl: true,
            name: true,
            description: true,
            sku: true,
            categoryName: true,
            basePrice: true,
            stock: true,
            imageUrl: true,
          },
        })
      : Promise.resolve([]),
    contentExternalIds.length > 0 || contentUrls.length > 0
      ? tx.importedContentDraft.findMany({
          where: {
            organizationId,
            OR: [
              ...(contentExternalIds.length > 0 ? [{ sourceExternalId: { in: contentExternalIds } }] : []),
              ...(contentUrls.length > 0 ? [{ sourceUrl: { in: contentUrls } }] : []),
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 200,
          select: {
            id: true,
            status: true,
            sourceExternalId: true,
            sourceUrl: true,
            title: true,
            body: true,
            mediaUrl: true,
            mediaType: true,
          },
        })
      : Promise.resolve([]),
  ])

  for (const candidate of candidates) {
    const pool = candidate.kind === "product" ? productDrafts : contentDrafts
    const existing = pool.find((draft) => {
      return Boolean(
        (candidate.sourceExternalId && draft.sourceExternalId === candidate.sourceExternalId) ||
        (candidate.sourceUrl && draft.sourceUrl === candidate.sourceUrl),
      )
    })
    if (!existing) continue

    const matchFields = [
      candidate.sourceExternalId && existing.sourceExternalId === candidate.sourceExternalId ? "sourceExternalId" : null,
      candidate.sourceUrl && existing.sourceUrl === candidate.sourceUrl ? "sourceUrl" : null,
    ].filter((field): field is string => Boolean(field))

    const existingFields = "name" in existing
      ? {
          name: existing.name,
          description: existing.description,
          sku: existing.sku,
          categoryName: existing.categoryName,
          basePrice: existing.basePrice,
          stock: existing.stock,
          imageUrl: existing.imageUrl,
        }
      : {
          title: existing.title,
          body: existing.body,
          mediaUrl: existing.mediaUrl,
          mediaType: existing.mediaType,
        }
    const diffSummary = buildReimportDiffSummary(candidate.fields, existingFields)

    mappings.set(candidate.key, {
      isDuplicate: true,
      existingDraftId: existing.id,
      existingStatus: existing.status,
      matchFields,
      diffSummary,
      suggestedDecision: diffSummary.changedFields.length > 0 ? "MERGE" : "SKIP",
      decisionOptions,
    })
  }

  return mappings
}
