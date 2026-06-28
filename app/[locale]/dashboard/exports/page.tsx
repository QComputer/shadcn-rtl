"use client"

import { use, useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { AlertTriangle, Download, Eye, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toPersianDigits } from "@/lib/persian"

type ExportDataType = "PRODUCTS" | "PRODUCT_CATEGORIES" | "ORDERS" | "CUSTOMERS" | "FANPAGE_POSTS"
type ExportJobFormat = "JSON" | "CSV"
type ExportJobStatus = "QUEUED" | "COMPLETED" | "FAILED" | "CANCELED"

type OrganizationOption = {
  id: string
  name: string
  slug: string
  type: string
}

type ExportJob = {
  id: string
  organizationId: string
  type: ExportDataType
  format: ExportJobFormat
  status: ExportJobStatus
  fileName?: string | null
  mimeType?: string | null
  rowCount: number
  payload?: {
    columns?: string[]
    rows?: Record<string, unknown>[]
    csv?: string
    generatedAt?: string
  } | null
  createdAt: string
  completedAt?: string | null
  organization?: OrganizationOption
}

type ExportHubCopy = {
  title: string
  subtitle: string
  organization: string
  type: string
  format: string
  create: string
  refresh: string
  jobs: string
  empty: string
  loading: string
  error: string
  preview: string
  rows: string
  file: string
  typeLabels: Record<ExportDataType, string>
  statuses: Record<ExportJobStatus, string>
}

const copyByLocale: Record<string, ExportHubCopy> = {
  fa: {
    title: "مرکز خروجی بازارباز",
    subtitle: "از داده‌های سازمان خروجی CSV یا JSON قابل بررسی بگیرید.",
    organization: "سازمان",
    type: "نوع داده",
    format: "فرمت",
    create: "ساخت خروجی",
    refresh: "تازه‌سازی",
    jobs: "خروجی‌ها",
    empty: "هنوز خروجی ساخته نشده است.",
    loading: "در حال بارگذاری مرکز خروجی...",
    error: "بارگذاری مرکز خروجی ناموفق بود",
    preview: "پیش‌نمایش",
    rows: "ردیف",
    file: "فایل",
    typeLabels: {
      PRODUCTS: "محصولات",
      PRODUCT_CATEGORIES: "دسته‌های محصول",
      ORDERS: "سفارش‌ها",
      CUSTOMERS: "مشتریان",
      FANPAGE_POSTS: "پست‌های فن‌پیج",
    },
    statuses: {
      QUEUED: "در صف",
      COMPLETED: "تکمیل شده",
      FAILED: "ناموفق",
      CANCELED: "لغو شده",
    },
  },
  en: {
    title: "Bazar Baz Export Hub",
    subtitle: "Create reviewable CSV or JSON exports for organization data.",
    organization: "Organization",
    type: "Data type",
    format: "Format",
    create: "Create export",
    refresh: "Refresh",
    jobs: "Exports",
    empty: "No export jobs yet.",
    loading: "Loading export hub...",
    error: "Export hub could not be loaded",
    preview: "Preview",
    rows: "Rows",
    file: "File",
    typeLabels: {
      PRODUCTS: "Products",
      PRODUCT_CATEGORIES: "Product categories",
      ORDERS: "Orders",
      CUSTOMERS: "Customers",
      FANPAGE_POSTS: "Fanpage posts",
    },
    statuses: {
      QUEUED: "Queued",
      COMPLETED: "Completed",
      FAILED: "Failed",
      CANCELED: "Canceled",
    },
  },
  ar: {
    title: "مركز التصدير في بازار باز",
    subtitle: "أنشئ ملفات CSV أو JSON قابلة للمراجعة لبيانات المؤسسة.",
    organization: "المؤسسة",
    type: "نوع البيانات",
    format: "الصيغة",
    create: "إنشاء تصدير",
    refresh: "تحديث",
    jobs: "التصديرات",
    empty: "لا توجد عمليات تصدير بعد.",
    loading: "جاري تحميل مركز التصدير...",
    error: "تعذر تحميل مركز التصدير",
    preview: "معاينة",
    rows: "صفوف",
    file: "ملف",
    typeLabels: {
      PRODUCTS: "المنتجات",
      PRODUCT_CATEGORIES: "فئات المنتجات",
      ORDERS: "الطلبات",
      CUSTOMERS: "العملاء",
      FANPAGE_POSTS: "منشورات الصفحة",
    },
    statuses: {
      QUEUED: "في الانتظار",
      COMPLETED: "مكتمل",
      FAILED: "فشل",
      CANCELED: "ملغى",
    },
  },
}

const exportTypes: ExportDataType[] = ["PRODUCTS", "PRODUCT_CATEGORIES", "ORDERS", "CUSTOMERS", "FANPAGE_POSTS"]
const exportFormats: ExportJobFormat[] = ["JSON", "CSV"]

function formatNumber(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

function downloadLabel(locale: string) {
  if (locale === "fa") return "دانلود فایل"
  if (locale === "ar") return "تنزيل الملف"
  return "Download file"
}

function statusVariant(status: ExportJobStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "FAILED") return "destructive"
  if (status === "COMPLETED") return "default"
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

export default function ExportHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const copy = copyByLocale[locale] ?? copyByLocale.fa
  const { data: session, status: sessionStatus } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [type, setType] = useState<ExportDataType>("PRODUCTS")
  const [format, setFormat] = useState<ExportJobFormat>("JSON")
  const [jobs, setJobs] = useState<ExportJob[]>([])
  const [selectedJob, setSelectedJob] = useState<ExportJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganizations = useCallback(async (signal?: AbortSignal) => {
    if (isSuperAdmin) {
      const response = await fetch("/api/organizations?pageSize=100", { cache: "no-store", signal })
      if (!response.ok) throw new Error(await readError(response, copy.error))
      const data = await response.json()
      const options = (data.data ?? []) as OrganizationOption[]
      setOrganizations(options)
      setOrganizationId((current) => current || options[0]?.id || "")
      return options[0]?.id || ""
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
  }, [copy.error, isSuperAdmin])

  const fetchJobs = useCallback(async (orgId: string, signal?: AbortSignal) => {
    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : ""
    const response = await fetch(`/api/dashboard/exports/jobs${query}`, { cache: "no-store", signal })
    if (!response.ok) throw new Error(await readError(response, copy.error))
    const data = await response.json()
    setJobs((data.jobs ?? []) as ExportJob[])
  }, [copy.error])

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    setLoading(true)
    try {
      const orgId = await fetchOrganizations(signal)
      await fetchJobs(orgId, signal)
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : copy.error)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [copy.error, fetchJobs, fetchOrganizations])

  useEffect(() => {
    if (sessionStatus === "loading") return
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh, sessionStatus])

  async function createJob() {
    if (!organizationId || saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/dashboard/exports/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, type, format }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.error))
      const data = await response.json()
      setSelectedJob(data.job as ExportJob)
      await fetchJobs(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.error)
    } finally {
      setSaving(false)
    }
  }

  async function loadJob(jobId: string) {
    const response = await fetch(`/api/dashboard/exports/jobs/${jobId}`, { cache: "no-store" })
    if (!response.ok) {
      setError(await readError(response, copy.error))
      return
    }
    const data = await response.json()
    setSelectedJob(data.job as ExportJob)
  }

  function downloadJob(jobId: string) {
    window.location.assign(`/api/dashboard/exports/jobs/${encodeURIComponent(jobId)}/download`)
  }

  const previewRows = selectedJob?.payload?.rows?.slice(0, 5) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => refresh()} disabled={loading}>
          <RefreshCw className="size-4" />
          {copy.refresh}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,420px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="size-4" />
              {copy.create}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.organization}</label>
              <Select value={organizationId} onValueChange={setOrganizationId} disabled={!isSuperAdmin}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.type}</label>
              <Select value={type} onValueChange={(value) => setType(value as ExportDataType)}>
                <SelectTrigger>
                  <SelectValue placeholder={copy.type} />
                </SelectTrigger>
                <SelectContent>
                  {exportTypes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {copy.typeLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.format}</label>
              <Select value={format} onValueChange={(value) => setFormat(value as ExportJobFormat)}>
                <SelectTrigger>
                  <SelectValue placeholder={copy.format} />
                </SelectTrigger>
                <SelectContent>
                  {exportFormats.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="button" className="w-full" disabled={!organizationId || saving} onClick={createJob}>
              <Download className="size-4" />
              {copy.create}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{copy.jobs}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{copy.loading}</div>
            ) : jobs.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{copy.empty}</div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="rounded-md border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={statusVariant(job.status)}>{copy.statuses[job.status]}</Badge>
                          <Badge variant="outline">{copy.typeLabels[job.type]}</Badge>
                          <Badge variant="outline">{job.format}</Badge>
                        </div>
                        <div className="text-sm">{job.fileName || job.id}</div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{copy.rows}: {formatNumber(job.rowCount, locale)}</span>
                          <span>{new Date(job.createdAt).toLocaleDateString(locale === "fa" ? "fa-IR" : locale)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => loadJob(job.id)}>
                          <Eye className="size-4" />
                          {copy.preview}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => downloadJob(job.id)}
                          disabled={job.status !== "COMPLETED"}
                        >
                          <Download className="size-4" />
                          {downloadLabel(locale)}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {copy.preview}: {copy.typeLabels[selectedJob.type]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={statusVariant(selectedJob.status)}>{copy.statuses[selectedJob.status]}</Badge>
              <span>{copy.file}: {selectedJob.fileName || selectedJob.id}</span>
              <span>{copy.rows}: {formatNumber(selectedJob.rowCount, locale)}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => downloadJob(selectedJob.id)}
                disabled={selectedJob.status !== "COMPLETED"}
              >
                <Download className="size-4" />
                {downloadLabel(locale)}
              </Button>
            </div>
            {selectedJob.format === "CSV" && selectedJob.payload?.csv ? (
              <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs" dir="ltr">
                {selectedJob.payload.csv}
              </pre>
            ) : previewRows.length > 0 ? (
              <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs" dir="ltr">
                {JSON.stringify(previewRows, null, 2)}
              </pre>
            ) : (
              <div className="py-6 text-sm text-muted-foreground">{copy.empty}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
