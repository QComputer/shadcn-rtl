"use client"
import { appFetch } from "@/lib/app-base-path";

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { ImageIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toPersianDigits } from "@/lib/persian"

type AiMediaAssetItem = {
  id: string
  mimeType: string | null
  width: number | null
  height: number | null
  byteSize: number | null
  storageProvider: string | null
  checksumSha256: string | null
  visibilityScope: string
  acceptedAt: string | null
  createdAt: string
  previewUrl: string | null
  sourceType: string | null
  requestedByUserId: string
}

type AssetsResponse = {
  items: AiMediaAssetItem[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

type Copy = {
  title: string
  subtitle: string
  loading: string
  error: string
  empty: string
  assets: string
  type: string
  size: string
  dimensions: string
  source: string
  created: string
  accepted: string
  preview: string
  page: string
  of: string
  mimeTypes: Record<string, string>
  unknown: string
}

const copyByLocale: Record<string, Copy> = {
  fa: {
    title: "کتابخانه رسانه هوش مصنوعی",
    subtitle: "رسانه‌های واردشده از خروجی‌های هوش مصنوعی سازمان",
    loading: "در حال بارگذاری رسانه‌ها...",
    error: "بارگذاری کتابخانه رسانه ناموفق بود",
    empty: "هنوز رسانه‌ای از خروجی هوش مصنوعی به کتابخانه شما وارد نشده است.",
    assets: "رسانه‌های واردشده",
    type: "نوع",
    size: "حجم",
    dimensions: "ابعاد",
    source: "منبع",
    created: "تاریخ ایجاد",
    accepted: "تاریخ پذیرش",
    preview: "پیش‌نمایش",
    page: "صفحه",
    of: "از",
    mimeTypes: {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "image/gif": "GIF",
    },
    unknown: "نامشخص",
  },
  en: {
    title: "AI Media Library",
    subtitle: "Imported media from your organization's AI outputs",
    loading: "Loading media...",
    error: "Failed to load media library",
    empty: "No AI-generated media has been imported into your library yet.",
    assets: "Imported assets",
    type: "Type",
    size: "Size",
    dimensions: "Dimensions",
    source: "Source",
    created: "Created",
    accepted: "Accepted",
    preview: "Preview",
    page: "Page",
    of: "of",
    mimeTypes: {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "image/gif": "GIF",
    },
    unknown: "Unknown",
  },
  ar: {
    title: "مكتبة الوسائط الذكية",
    subtitle: "الوسائط المستوردة من مخرجات الذكاء الاصطناعي للمؤسسة",
    loading: "جار تحميل الوسائط...",
    error: "تعذر تحميل مكتبة الوسائط",
    empty: "لم يتم استيراد أي وسائط مولدة بالذكاء الاصطناعي إلى مكتبتك بعد.",
    assets: "الوسائط المستوردة",
    type: "النوع",
    size: "الحجم",
    dimensions: "الأبعاد",
    source: "المصدر",
    created: "تاريخ الإنشاء",
    accepted: "تاريخ القبول",
    preview: "معاينة",
    page: "صفحة",
    of: "من",
    mimeTypes: {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "image/gif": "GIF",
    },
    unknown: "غير معروف",
  },
}

function formatBytes(bytes: number | null) {
  if (!bytes && bytes !== 0) return "-"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(value: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("fa-IR")
}

function formatNumber(value: number | null | undefined, locale: string) {
  const normalized = String(value ?? 0)
  return locale === "fa" || locale === "ar" ? toPersianDigits(normalized) : normalized
}

export default function AiMediaAssetsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const copy = copyByLocale[locale] ?? copyByLocale.fa
  const { data: session } = useSession()
  const [assets, setAssets] = useState<AssetsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const organizationId = session?.user?.organizationId

  const loadAssets = useCallback(async (pageNum: number) => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        organizationId,
        page: String(pageNum),
        pageSize: "20",
      })
      const response = await appFetch(`/api/dashboard/ai-media/assets?${query.toString()}`, { cache: "no-store" })
      if (!response.ok) throw new Error(copy.error)
      const data = (await response.json()) as AssetsResponse
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.error)
    } finally {
      setLoading(false)
    }
  }, [organizationId, copy.error])

  useEffect(() => {
    if (organizationId) {
      loadAssets(page)
    }
  }, [organizationId, page, loadAssets])

  const totalPages = useMemo(() => assets?.totalPages ?? 1, [assets])
  const items = useMemo(() => assets?.items ?? [], [assets])

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {copy.empty}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>

      {error && (
        <Card className="mb-4 border-destructive">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={index}>
              <Skeleton className="aspect-square w-full" />
              <CardContent className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{copy.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  {asset.previewUrl ? (
                    <img
                      src={asset.previewUrl}
                      alt={asset.id}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-1.5 p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {copy.mimeTypes[asset.mimeType ?? ""] ?? copy.unknown}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatBytes(asset.byteSize)}</span>
                  </div>
                  {asset.width && asset.height && (
                    <p className="text-xs text-muted-foreground">
                      {copy.dimensions}: {formatNumber(asset.width, locale)} × {formatNumber(asset.height, locale)}
                    </p>
                  )}
                  {asset.sourceType && (
                    <p className="text-xs text-muted-foreground">
                      {copy.source}: {asset.sourceType}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {copy.created}: {formatDate(asset.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {"<"}
              </button>
              <span className="text-sm text-muted-foreground">
                {copy.page} {toPersianDigits(String(page))} {copy.of} {toPersianDigits(String(totalPages))}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {">"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
