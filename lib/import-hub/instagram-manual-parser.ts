import { normalizeImportUrl } from "@/lib/import-hub/source-detection"

export type ParsedInstagramContentDraft = {
  title: string | null
  body: string | null
  mediaUrl: string | null
  mediaType: string | null
  sourceUrl: string | null
  sourceExternalId: string | null
  sourceMetadata: {
    type: "INSTAGRAM_MANUAL"
    hashtags: string[]
    mentions: string[]
    likelyProductMentions: string[]
    mediaReferences: string[]
    remotePreviewOnly: boolean
  }
  rawData: {
    caption: string | null
    sourceUrl: string | null
    mediaReferences: string[]
  }
  warnings: string[]
}

const genericHashtags = new Set([
  "instagram",
  "instagood",
  "reels",
  "reel",
  "shop",
  "store",
  "sale",
  "bazaar",
  "bazarbaz",
  "بازار",
  "فروش",
  "خرید",
  "اینستاگرام",
])

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function extractHashtags(caption: string) {
  return unique(Array.from(caption.matchAll(/#[\p{L}\p{N}_]+/gu), (match) => match[0]))
}

function extractMentions(caption: string) {
  return unique(Array.from(caption.matchAll(/@[\p{L}\p{N}._]+/gu), (match) => match[0]))
}

function normalizeMediaReferences(mediaReferences: string[] | null | undefined) {
  return unique(
    (mediaReferences ?? [])
      .flatMap((value) => value.split(/\r?\n/))
      .map((value) => value.trim())
      .filter((value) => /^https?:\/\//i.test(value)),
  ).slice(0, 10)
}

function inferMediaType(mediaUrl: string | null) {
  if (!mediaUrl) return null
  const lower = mediaUrl.toLowerCase()
  if (/\.(mp4|mov|webm)(\?|$)/.test(lower)) return "video"
  if (/\.(png|jpe?g|webp|gif)(\?|$)/.test(lower)) return "image"
  return "remote"
}

function extractInstagramExternalId(sourceUrl: string | null) {
  if (!sourceUrl) return null

  try {
    const url = new URL(sourceUrl)
    const parts = url.pathname.split("/").filter(Boolean)
    const postTypeIndex = parts.findIndex((part) => ["p", "reel", "tv"].includes(part))
    if (postTypeIndex >= 0 && parts[postTypeIndex + 1]) return parts[postTypeIndex + 1]
    if (parts[0] === "stories" && parts[2]) return parts[2]
    return parts.at(-1) ?? null
  } catch {
    return null
  }
}

function makeTitle(caption: string) {
  const firstTextLine = caption
    .split(/\r?\n/)
    .map((line) => line.replace(/#[\p{L}\p{N}_]+/gu, "").trim())
    .find((line) => line.length > 0)

  return firstTextLine ? firstTextLine.slice(0, 120) : null
}

function detectLikelyProductMentions(caption: string, hashtags: string[]) {
  const fromHashtags = hashtags
    .map((hashtag) => hashtag.replace(/^#/, "").trim())
    .filter((tag) => tag.length >= 3 && !genericHashtags.has(tag.toLowerCase()))

  const productLines = caption
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /(تومان|ريال|ریال|قیمت|قيمت|موجود|سفارش|price|toman|\d{4,})/i.test(line))
    .map((line) => line.replace(/#[\p{L}\p{N}_]+/gu, "").trim())
    .filter(Boolean)

  return unique([...fromHashtags, ...productLines]).slice(0, 12)
}

export function parseManualInstagramContent(input: {
  sourceUrl?: string | null
  caption?: string | null
  mediaReferences?: string[] | null
}): ParsedInstagramContentDraft {
  const normalizedUrl = normalizeImportUrl(input.sourceUrl)
  const caption = input.caption?.trim() || null
  const mediaReferences = normalizeMediaReferences(input.mediaReferences)
  const hashtags = caption ? extractHashtags(caption) : []
  const mentions = caption ? extractMentions(caption) : []
  const likelyProductMentions = caption ? detectLikelyProductMentions(caption, hashtags) : []
  const warnings: string[] = []

  if (!normalizedUrl || !/instagram\.com|instagr\.am/i.test(normalizedUrl)) {
    warnings.push("Source URL is not a recognized Instagram URL.")
  }
  if (!caption) warnings.push("No caption was provided.")
  if (mediaReferences.length === 0) warnings.push("No seller-approved media references were provided.")

  const mediaUrl = mediaReferences[0] ?? null

  return {
    title: caption ? makeTitle(caption) : null,
    body: caption,
    mediaUrl,
    mediaType: inferMediaType(mediaUrl),
    sourceUrl: normalizedUrl,
    sourceExternalId: extractInstagramExternalId(normalizedUrl),
    sourceMetadata: {
      type: "INSTAGRAM_MANUAL",
      hashtags,
      mentions,
      likelyProductMentions,
      mediaReferences,
      remotePreviewOnly: true,
    },
    rawData: {
      caption,
      sourceUrl: normalizedUrl,
      mediaReferences,
    },
    warnings,
  }
}
