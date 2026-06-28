import { normalizeImportUrl } from "@/lib/import-hub/source-detection"

export type ParsedTelegramContentDraft = {
  title: string | null
  body: string | null
  mediaUrl: string | null
  mediaType: string | null
  sourceUrl: string | null
  sourceExternalId: string | null
  sourceMetadata: {
    type: "TELEGRAM_MANUAL"
    channel: string | null
    postId: string | null
    hashtags: string[]
    mentions: string[]
    likelyProductMentions: string[]
    mediaReferences: string[]
    publicOnly: true
    fetchEnabled: false
  }
  rawData: {
    text: string | null
    sourceUrl: string | null
    mediaReferences: string[]
  }
  warnings: string[]
}

export function telegramFetchEnabled() {
  return false
}

export function isTelegramPublicPostUrl(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return false
  return /(^https?:\/\/)?(t\.me|telegram\.me)\/[A-Za-z0-9_]{3,}\/\d+/.test(sourceUrl)
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeMediaReferences(mediaReferences: string[] | null | undefined) {
  return unique(
    (mediaReferences ?? [])
      .flatMap((value) => value.split(/\r?\n/))
      .map((value) => value.trim())
      .filter((value) => /^https?:\/\//i.test(value)),
  ).slice(0, 10)
}

function extractTelegramParts(sourceUrl: string | null) {
  if (!sourceUrl) return { channel: null, postId: null }
  const match = sourceUrl.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,})\/(\d+)/)
  return {
    channel: match?.[1] ?? null,
    postId: match?.[2] ?? null,
  }
}

function extractHashtags(text: string) {
  return unique(Array.from(text.matchAll(/#[\p{L}\p{N}_]+/gu), (match) => match[0]))
}

function extractMentions(text: string) {
  return unique(Array.from(text.matchAll(/@[\p{L}\p{N}._]+/gu), (match) => match[0]))
}

function detectLikelyProductMentions(text: string, hashtags: string[]) {
  const productLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /(تومان|ريال|ریال|قیمت|قيمت|موجود|سفارش|price|toman|\d{4,})/i.test(line))
    .map((line) => line.replace(/#[\p{L}\p{N}_]+/gu, "").trim())
    .filter(Boolean)

  const productTags = hashtags
    .map((tag) => tag.replace(/^#/, ""))
    .filter((tag) => tag.length >= 3)

  return unique([...productLines, ...productTags]).slice(0, 12)
}

function inferMediaType(mediaUrl: string | null) {
  if (!mediaUrl) return null
  const lower = mediaUrl.toLowerCase()
  if (/\.(mp4|mov|webm)(\?|$)/.test(lower)) return "video"
  if (/\.(png|jpe?g|webp|gif)(\?|$)/.test(lower)) return "image"
  return "remote"
}

function makeTitle(text: string) {
  const firstTextLine = text
    .split(/\r?\n/)
    .map((line) => line.replace(/#[\p{L}\p{N}_]+/gu, "").trim())
    .find((line) => line.length > 0)

  return firstTextLine ? firstTextLine.slice(0, 120) : null
}

export function parseManualTelegramContent(input: {
  sourceUrl?: string | null
  text?: string | null
  mediaReferences?: string[] | null
}): ParsedTelegramContentDraft {
  const normalizedUrl = normalizeImportUrl(input.sourceUrl)
  const text = input.text?.trim() || null
  const mediaReferences = normalizeMediaReferences(input.mediaReferences)
  const hashtags = text ? extractHashtags(text) : []
  const mentions = text ? extractMentions(text) : []
  const likelyProductMentions = text ? detectLikelyProductMentions(text, hashtags) : []
  const { channel, postId } = extractTelegramParts(normalizedUrl)
  const warnings: string[] = []

  if (!normalizedUrl || !isTelegramPublicPostUrl(normalizedUrl)) {
    warnings.push("Source URL is not a recognized public Telegram post URL.")
  }
  if (!text) warnings.push("No pasted Telegram post content was provided.")
  if (mediaReferences.length === 0) warnings.push("No seller-approved media references were provided.")

  const mediaUrl = mediaReferences[0] ?? null

  return {
    title: text ? makeTitle(text) : null,
    body: text,
    mediaUrl,
    mediaType: inferMediaType(mediaUrl),
    sourceUrl: normalizedUrl,
    sourceExternalId: postId,
    sourceMetadata: {
      type: "TELEGRAM_MANUAL",
      channel,
      postId,
      hashtags,
      mentions,
      likelyProductMentions,
      mediaReferences,
      publicOnly: true,
      fetchEnabled: false,
    },
    rawData: {
      text,
      sourceUrl: normalizedUrl,
      mediaReferences,
    },
    warnings,
  }
}
