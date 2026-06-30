"use client"

import { use, useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  AlertTriangle,
  Eye,
  ImageIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toPersianDigits } from "@/lib/persian"

type CreativeStudioJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED"
type CreativeStudioAssetStatus = "DRAFT" | "SELECTED" | "APPLIED" | "REJECTED"
type CreativeStudioTargetType = "PRODUCT" | "CAMPAIGN" | "FANPAGE_POST" | "ORGANIZATION_BRAND" | "IMPORTED_MEDIA"
type CreativeStudioAssetType = "PRODUCT_IMAGE" | "CAMPAIGN_IMAGE" | "FANPAGE_IMAGE" | "LOGO" | "COVER" | "OG_IMAGE" | "IMPORT_MEDIA"
type CreativeStudioUsageAction = "JOB_CREATED" | "JOB_CANCELED" | "ASSET_DRAFTED" | "ASSET_SELECTED" | "ASSET_APPLIED"

type OrganizationOption = {
  id: string
  name: string
  slug: string
  type: string
}

type CreativeStudioStatus = {
  enabled: boolean
  provider: "MOCK" | string
  realProviderEnabled: boolean
  planningGate: string
  serverFoundation: string
  canCreateJob: boolean
  limits: {
    dailyJobLimit: number
    remainingDailyJobs: number
  }
  policy: {
    sellerInitiated: boolean
    draftOnly: boolean
    applyEndpointRecordsOnly: boolean
    noPublicAssetMutation: boolean
  }
}

type CreativeStudioUsageEvent = {
  id: string
  action: CreativeStudioUsageAction
  provider: string
  targetType?: CreativeStudioTargetType | null
  targetId?: string | null
  jobId?: string | null
  assetId?: string | null
  units: number
  createdAt: string
}

type CreativeStudioUsage = {
  dateStart: string
  dailyJobLimit: number
  jobCreateCount: number
  assetDraftCount: number
  assetAppliedCount: number
  remainingDailyJobs: number
  canCreateJob: boolean
  events: CreativeStudioUsageEvent[]
}

type CreativeStudioAsset = {
  id: string
  assetType: CreativeStudioAssetType
  status: CreativeStudioAssetStatus
  sourceUrl?: string | null
  finalUrl?: string | null
  sourceMetadata?: Record<string, unknown> | null
  createdAt: string
  appliedAt?: string | null
}

type CreativeStudioJob = {
  id: string
  organizationId: string
  targetType: CreativeStudioTargetType
  targetId?: string | null
  status: CreativeStudioJobStatus
  provider: string
  prompt?: string | null
  outputCount: number
  createdAt: string
  completedAt?: string | null
  assets?: CreativeStudioAsset[]
  usageEvents?: CreativeStudioUsageEvent[]
}

type CreativeStudioCopy = {
  title: string
  subtitle: string
  organization: string
  refresh: string
  loading: string
  error: string
  status: string
  usage: string
  jobs: string
  details: string
  assets: string
  events: string
  empty: string
  provider: string
  realProvider: string
  dailyLimit: string
  remaining: string
  jobCreates: string
  draftedAssets: string
  appliedAssets: string
  publicMutation: string
  draftOnly: string
  selectedJob: string
  prompt: string
  target: string
  date: string
  view: string
  noSelection: string
  policyYes: string
  policyNo: string
  statuses: Record<CreativeStudioJobStatus | CreativeStudioAssetStatus, string>
  targetTypes: Record<CreativeStudioTargetType, string>
  assetTypes: Record<CreativeStudioAssetType, string>
  actions: Record<CreativeStudioUsageAction, string>
}

const copyByLocale: Record<string, CreativeStudioCopy> = {
  fa: {
    title: "استودیوی خلاقیت",
    subtitle: "مرور وضعیت، مصرف، درخواست‌ها و دارایی‌های پیش‌نویس",
    organization: "سازمان",
    refresh: "تازه‌سازی",
    loading: "در حال بارگذاری استودیوی خلاقیت...",
    error: "بارگذاری استودیوی خلاقیت ناموفق بود",
    status: "وضعیت",
    usage: "مصرف امروز",
    jobs: "درخواست‌ها",
    details: "جزئیات درخواست",
    assets: "دارایی‌های پیش‌نویس",
    events: "رویدادها",
    empty: "هنوز موردی ثبت نشده است.",
    provider: "ارائه‌دهنده",
    realProvider: "ارائه‌دهنده واقعی",
    dailyLimit: "سقف روزانه",
    remaining: "باقی‌مانده",
    jobCreates: "درخواست ساخته‌شده",
    draftedAssets: "دارایی پیش‌نویس",
    appliedAssets: "ثبت اعمال",
    publicMutation: "تغییر عمومی",
    draftOnly: "فقط پیش‌نویس",
    selectedJob: "درخواست انتخاب‌شده",
    prompt: "پرامپت",
    target: "هدف",
    date: "تاریخ",
    view: "مشاهده",
    noSelection: "برای دیدن جزئیات، یک درخواست را انتخاب کنید.",
    policyYes: "فعال",
    policyNo: "غیرفعال",
    statuses: {
      QUEUED: "در صف",
      PROCESSING: "در حال پردازش",
      COMPLETED: "تکمیل‌شده",
      FAILED: "ناموفق",
      CANCELED: "لغوشده",
      DRAFT: "پیش‌نویس",
      SELECTED: "انتخاب‌شده",
      APPLIED: "ثبت‌شده",
      REJECTED: "ردشده",
    },
    targetTypes: {
      PRODUCT: "محصول",
      CAMPAIGN: "کمپین",
      FANPAGE_POST: "پست فن‌پیج",
      ORGANIZATION_BRAND: "برند سازمان",
      IMPORTED_MEDIA: "رسانه واردشده",
    },
    assetTypes: {
      PRODUCT_IMAGE: "تصویر محصول",
      CAMPAIGN_IMAGE: "تصویر کمپین",
      FANPAGE_IMAGE: "تصویر فن‌پیج",
      LOGO: "لوگو",
      COVER: "کاور",
      OG_IMAGE: "تصویر اشتراک",
      IMPORT_MEDIA: "رسانه وارداتی",
    },
    actions: {
      JOB_CREATED: "درخواست ساخته شد",
      JOB_CANCELED: "درخواست لغو شد",
      ASSET_DRAFTED: "دارایی پیش‌نویس شد",
      ASSET_SELECTED: "دارایی انتخاب شد",
      ASSET_APPLIED: "اعمال دارایی ثبت شد",
    },
  },
  en: {
    title: "Creative Studio",
    subtitle: "Review status, usage, jobs, and draft assets",
    organization: "Organization",
    refresh: "Refresh",
    loading: "Loading Creative Studio...",
    error: "Creative Studio could not be loaded",
    status: "Status",
    usage: "Today usage",
    jobs: "Jobs",
    details: "Job details",
    assets: "Draft assets",
    events: "Events",
    empty: "Nothing has been recorded yet.",
    provider: "Provider",
    realProvider: "Real provider",
    dailyLimit: "Daily limit",
    remaining: "Remaining",
    jobCreates: "Jobs created",
    draftedAssets: "Draft assets",
    appliedAssets: "Apply records",
    publicMutation: "Public mutation",
    draftOnly: "Draft only",
    selectedJob: "Selected job",
    prompt: "Prompt",
    target: "Target",
    date: "Date",
    view: "View",
    noSelection: "Select a job to review its details.",
    policyYes: "Enabled",
    policyNo: "Disabled",
    statuses: {
      QUEUED: "Queued",
      PROCESSING: "Processing",
      COMPLETED: "Completed",
      FAILED: "Failed",
      CANCELED: "Canceled",
      DRAFT: "Draft",
      SELECTED: "Selected",
      APPLIED: "Recorded",
      REJECTED: "Rejected",
    },
    targetTypes: {
      PRODUCT: "Product",
      CAMPAIGN: "Campaign",
      FANPAGE_POST: "Fanpage post",
      ORGANIZATION_BRAND: "Organization brand",
      IMPORTED_MEDIA: "Imported media",
    },
    assetTypes: {
      PRODUCT_IMAGE: "Product image",
      CAMPAIGN_IMAGE: "Campaign image",
      FANPAGE_IMAGE: "Fanpage image",
      LOGO: "Logo",
      COVER: "Cover",
      OG_IMAGE: "Share image",
      IMPORT_MEDIA: "Import media",
    },
    actions: {
      JOB_CREATED: "Job created",
      JOB_CANCELED: "Job canceled",
      ASSET_DRAFTED: "Asset drafted",
      ASSET_SELECTED: "Asset selected",
      ASSET_APPLIED: "Asset apply recorded",
    },
  },
  ar: {
    title: "استوديو الإبداع",
    subtitle: "مراجعة الحالة والاستخدام والطلبات والأصول المسودة",
    organization: "المؤسسة",
    refresh: "تحديث",
    loading: "جار تحميل استوديو الإبداع...",
    error: "تعذر تحميل استوديو الإبداع",
    status: "الحالة",
    usage: "استخدام اليوم",
    jobs: "الطلبات",
    details: "تفاصيل الطلب",
    assets: "الأصول المسودة",
    events: "الأحداث",
    empty: "لا توجد عناصر مسجلة بعد.",
    provider: "المزود",
    realProvider: "المزود الحقيقي",
    dailyLimit: "الحد اليومي",
    remaining: "المتبقي",
    jobCreates: "طلبات منشأة",
    draftedAssets: "أصول مسودة",
    appliedAssets: "سجلات تطبيق",
    publicMutation: "تغيير عام",
    draftOnly: "مسودة فقط",
    selectedJob: "الطلب المحدد",
    prompt: "الموجه",
    target: "الهدف",
    date: "التاريخ",
    view: "عرض",
    noSelection: "اختر طلبا لمراجعة تفاصيله.",
    policyYes: "مفعل",
    policyNo: "غير مفعل",
    statuses: {
      QUEUED: "في الانتظار",
      PROCESSING: "قيد المعالجة",
      COMPLETED: "مكتمل",
      FAILED: "فشل",
      CANCELED: "ملغى",
      DRAFT: "مسودة",
      SELECTED: "محدد",
      APPLIED: "مسجل",
      REJECTED: "مرفوض",
    },
    targetTypes: {
      PRODUCT: "منتج",
      CAMPAIGN: "حملة",
      FANPAGE_POST: "منشور صفحة",
      ORGANIZATION_BRAND: "علامة المؤسسة",
      IMPORTED_MEDIA: "وسائط مستوردة",
    },
    assetTypes: {
      PRODUCT_IMAGE: "صورة منتج",
      CAMPAIGN_IMAGE: "صورة حملة",
      FANPAGE_IMAGE: "صورة صفحة",
      LOGO: "شعار",
      COVER: "غلاف",
      OG_IMAGE: "صورة مشاركة",
      IMPORT_MEDIA: "وسائط مستوردة",
    },
    actions: {
      JOB_CREATED: "تم إنشاء الطلب",
      JOB_CANCELED: "تم إلغاء الطلب",
      ASSET_DRAFTED: "تمت مسودة الأصل",
      ASSET_SELECTED: "تم تحديد الأصل",
      ASSET_APPLIED: "تم تسجيل تطبيق الأصل",
    },
  },
}

function formatNumber(value: number | null | undefined, locale: string) {
  const normalized = String(value ?? 0)
  return locale === "fa" || locale === "ar" ? toPersianDigits(normalized) : normalized
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-"
  return new Date(value).toLocaleString(locale === "fa" ? "fa-IR" : locale)
}

function statusVariant(status: CreativeStudioJobStatus | CreativeStudioAssetStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "FAILED" || status === "REJECTED") return "destructive"
  if (status === "COMPLETED" || status === "APPLIED" || status === "SELECTED") return "default"
  if (status === "CANCELED") return "outline"
  return "secondary"
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

function metric(label: string, value: string) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

export default function CreativeStudioDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const copy = copyByLocale[locale] ?? copyByLocale.fa
  const { data: session, status: sessionStatus } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [status, setStatus] = useState<CreativeStudioStatus | null>(null)
  const [usage, setUsage] = useState<CreativeStudioUsage | null>(null)
  const [jobs, setJobs] = useState<CreativeStudioJob[]>([])
  const [selectedJob, setSelectedJob] = useState<CreativeStudioJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizations = useCallback(async (signal?: AbortSignal) => {
    if (isSuperAdmin) {
      const response = await fetch("/api/organizations?pageSize=100", { cache: "no-store", signal })
      if (!response.ok) throw new Error(await readError(response, copy.error))
      const data = await response.json()
      const options = (data.data ?? []) as OrganizationOption[]
      setOrganizations(options)
      const nextOrganizationId = organizationId || options[0]?.id || ""
      setOrganizationId(nextOrganizationId)
      return nextOrganizationId
    }

    const response = await fetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!response.ok) throw new Error(await readError(response, copy.error))
    const data = await response.json()
    const membership = data.membership
    const option = membership
      ? {
          id: membership.organizationId,
          name: membership.organizationName,
          slug: membership.organizationSlug,
          type: membership.organizationType,
        }
      : null
    setOrganizations(option ? [option] : [])
    setOrganizationId(option?.id || "")
    return option?.id || ""
  }, [copy.error, isSuperAdmin, organizationId])

  const loadOverview = useCallback(async (orgId: string, signal?: AbortSignal) => {
    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : ""
    const [statusResponse, usageResponse, jobsResponse] = await Promise.all([
      fetch(`/api/dashboard/creative-studio/status${query}`, { cache: "no-store", signal }),
      fetch(`/api/dashboard/creative-studio/usage${query}`, { cache: "no-store", signal }),
      fetch(`/api/dashboard/creative-studio/jobs${query}`, { cache: "no-store", signal }),
    ])

    if (!statusResponse.ok) throw new Error(await readError(statusResponse, copy.error))
    if (!usageResponse.ok) throw new Error(await readError(usageResponse, copy.error))
    if (!jobsResponse.ok) throw new Error(await readError(jobsResponse, copy.error))

    const statusData = await statusResponse.json()
    const usageData = await usageResponse.json()
    const jobsData = await jobsResponse.json()
    setStatus(statusData.status as CreativeStudioStatus)
    setUsage(usageData.usage as CreativeStudioUsage)
    setJobs((jobsData.jobs ?? []) as CreativeStudioJob[])
  }, [copy.error])

  const loadJob = useCallback(async (jobId: string, orgId = organizationId, signal?: AbortSignal) => {
    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : ""
    const response = await fetch(`/api/dashboard/creative-studio/jobs/${encodeURIComponent(jobId)}${query}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) {
      setError(await readError(response, copy.error))
      return
    }
    const data = await response.json()
    setSelectedJob(data.job as CreativeStudioJob)
  }, [copy.error, organizationId])

  const refresh = useCallback(async (signal?: AbortSignal, explicitOrganizationId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const orgId = explicitOrganizationId || await fetchOrganizations(signal)
      await loadOverview(orgId, signal)
      if (selectedJob?.organizationId === orgId) {
        await loadJob(selectedJob.id, orgId, signal)
      }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : copy.error)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [copy.error, fetchOrganizations, loadOverview, selectedJob?.id, selectedJob?.organizationId])

  useEffect(() => {
    if (sessionStatus === "loading") return
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh, sessionStatus])

  async function selectOrganization(nextOrganizationId: string) {
    setOrganizationId(nextOrganizationId)
    setSelectedJob(null)
    await refresh(undefined, nextOrganizationId)
  }

  const isReadOnlyPublicMutationBlocked = status?.policy.noPublicAssetMutation === true
  const isDraftOnly = status?.policy.draftOnly === true

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={organizationId} onValueChange={selectOrganization} disabled={!isSuperAdmin || loading}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder={copy.organization} />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name} ({organization.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className="size-4" />
            {copy.refresh}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">{copy.loading}</div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="size-4" />
                  {copy.status}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.provider}</span>
                  <Badge variant="secondary">{status?.provider ?? "MOCK"}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.realProvider}</span>
                  <Badge variant={status?.realProviderEnabled ? "default" : "outline"}>
                    {status?.realProviderEnabled ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.draftOnly}</span>
                  <Badge variant={isDraftOnly ? "default" : "destructive"}>
                    {isDraftOnly ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.publicMutation}</span>
                  <Badge variant={isReadOnlyPublicMutationBlocked ? "outline" : "destructive"}>
                    {isReadOnlyPublicMutationBlocked ? copy.policyNo : copy.policyYes}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4" />
                  {copy.usage}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {metric(copy.dailyLimit, formatNumber(usage?.dailyJobLimit, locale))}
                  {metric(copy.remaining, formatNumber(usage?.remainingDailyJobs, locale))}
                  {metric(copy.jobCreates, formatNumber(usage?.jobCreateCount, locale))}
                  {metric(copy.draftedAssets, formatNumber(usage?.assetDraftCount, locale))}
                  {metric(copy.appliedAssets, formatNumber(usage?.assetAppliedCount, locale))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(320px,520px)_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WandSparkles className="size-4" />
                  {copy.jobs}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">{copy.empty}</div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div key={job.id} className="rounded-md border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={statusVariant(job.status)}>{copy.statuses[job.status]}</Badge>
                              <Badge variant="outline">{copy.targetTypes[job.targetType]}</Badge>
                              <Badge variant="outline">{job.provider}</Badge>
                            </div>
                            <div className="truncate text-sm font-medium">{job.prompt || job.id}</div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{copy.assets}: {formatNumber(job.assets?.length ?? job.outputCount, locale)}</span>
                              <span>{formatDate(job.createdAt, locale)}</span>
                            </div>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => loadJob(job.id)}>
                            <Eye className="size-4" />
                            {copy.view}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{copy.details}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedJob ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">{copy.noSelection}</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(selectedJob.status)}>{copy.statuses[selectedJob.status]}</Badge>
                        <Badge variant="outline">{copy.targetTypes[selectedJob.targetType]}</Badge>
                        <Badge variant="outline">{selectedJob.provider}</Badge>
                      </div>
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.selectedJob}</div>
                          <div className="mt-1 break-all font-medium">{selectedJob.id}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.date}</div>
                          <div className="mt-1 font-medium">{formatDate(selectedJob.createdAt, locale)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.target}</div>
                          <div className="mt-1 break-all font-medium">
                            {copy.targetTypes[selectedJob.targetType]} {selectedJob.targetId ? `- ${selectedJob.targetId}` : ""}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.assets}</div>
                          <div className="mt-1 font-medium">{formatNumber(selectedJob.assets?.length ?? selectedJob.outputCount, locale)}</div>
                        </div>
                      </div>
                      {selectedJob.prompt && (
                        <div className="rounded-md border bg-muted/30 p-3 text-sm">
                          <div className="mb-1 text-xs text-muted-foreground">{copy.prompt}</div>
                          <div>{selectedJob.prompt}</div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedJob && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ImageIcon className="size-4" />
                        {copy.assets}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedJob.assets?.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {selectedJob.assets.map((asset) => (
                            <div key={asset.id} className="rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <Badge variant={statusVariant(asset.status)}>{copy.statuses[asset.status]}</Badge>
                                <span className="text-xs text-muted-foreground">{formatDate(asset.createdAt, locale)}</span>
                              </div>
                              <div className="mt-3 text-sm font-medium">{copy.assetTypes[asset.assetType]}</div>
                              <div className="mt-1 break-all text-xs text-muted-foreground">{asset.sourceUrl || asset.finalUrl || asset.id}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">{copy.empty}</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{copy.events}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedJob.usageEvents?.length ? (
                        <div className="space-y-2">
                          {selectedJob.usageEvents.map((event) => (
                            <div key={event.id} className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                              <span>{copy.actions[event.action] ?? event.action}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(event.createdAt, locale)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">{copy.empty}</div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
