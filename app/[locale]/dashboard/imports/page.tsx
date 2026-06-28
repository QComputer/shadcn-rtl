"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { AlertTriangle, CheckCircle2, FileInput, RefreshCw, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toPersianDigits } from "@/lib/persian"

type SourceType =
  | "INSTAGRAM"
  | "TELEGRAM"
  | "SNAP_FOOD"
  | "SNAP_MARKET"
  | "CSV"
  | "EXCEL"
  | "PDF"
  | "IMAGE_MENU"
  | "MANUAL_URL"
  | "MANUAL_TEXT"
  | "UNKNOWN"

type JobStatus = "QUEUED" | "NEEDS_REVIEW" | "COMPLETED" | "FAILED" | "CANCELED"

type ImportJob = {
  id: string
  organizationId: string
  type: SourceType
  status: JobStatus
  inputUrl?: string | null
  inputText?: string | null
  inputFilename?: string | null
  consentConfirmed: boolean
  errorMessage?: string | null
  createdAt: string
  organization?: {
    id: string
    name: string
    slug: string
    type: string
  }
  source?: {
    id: string
    displayName?: string | null
    sourceUrl?: string | null
  } | null
  _count?: {
    productDrafts: number
    contentDrafts: number
  }
  productDrafts?: ImportedProductDraft[]
  contentDrafts?: ImportedContentDraft[]
}

type ImportedProductDraft = {
  id: string
  rowNumber?: number | null
  status: "DRAFT" | "APPROVED" | "REJECTED" | "IMPORTED" | "MERGED"
  name?: string | null
  description?: string | null
  sku?: string | null
  categoryName?: string | null
  basePrice?: string | number | null
  stock?: number | null
  imageUrl?: string | null
  warnings?: string[] | null
  errors?: string[] | null
}

type ImportedContentDraft = {
  id: string
  status: "DRAFT" | "APPROVED" | "REJECTED" | "IMPORTED" | "MERGED"
  title?: string | null
  body?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  sourceUrl?: string | null
  warnings?: string[] | null
  sourceMetadata?: {
    hashtags?: string[]
    mentions?: string[]
    likelyProductMentions?: string[]
    mediaReferences?: string[]
  } | null
}

type OrganizationOption = {
  id: string
  name: string
  slug: string
  type: string
}

type ImportHubCopy = {
  title: string
  subtitle: string
  source: string
  organization: string
  url: string
  text: string
  file: string
  mediaReferences: string
  consent: string
  create: string
  refresh: string
  jobs: string
  empty: string
  loading: string
  error: string
  draftCounts: string
  review: string
  cancel: string
  approve: string
  reject: string
  row: string
  product: string
  category: string
  price: string
  stock: string
  content: string
  caption: string
  media: string
  hints: string
  sourceLabels: Record<SourceType, string>
  statuses: Record<JobStatus, string>
}

const copyByLocale: Record<string, ImportHubCopy> = {
  fa: {
    title: "مرکز واردسازی بازارباز",
    subtitle: "محصولات و محتوا را از کانال‌های فروش به پیش‌نویس قابل بررسی تبدیل کنید.",
    source: "منبع",
    organization: "سازمان",
    url: "نشانی منبع",
    text: "متن یا کپشن",
    file: "نام فایل",
    mediaReferences: "نشانی رسانه‌های تاییدشده",
    consent: "تایید می‌کنم این صفحه یا محتوا متعلق به کسب‌وکار من است یا اجازه استفاده از آن را دارم.",
    create: "ثبت واردسازی",
    refresh: "تازه‌سازی",
    jobs: "درخواست‌ها",
    empty: "هنوز درخواستی ثبت نشده است.",
    loading: "در حال بارگذاری مرکز واردسازی...",
    error: "بارگذاری مرکز واردسازی ناموفق بود",
    draftCounts: "پیش‌نویس",
    review: "بررسی",
    cancel: "لغو",
    approve: "تایید پیش‌نویس‌ها",
    reject: "رد پیش‌نویس‌ها",
    row: "ردیف",
    product: "محصول",
    category: "دسته",
    price: "قیمت",
    stock: "موجودی",
    content: "پیش‌نویس محتوا",
    caption: "کپشن",
    media: "رسانه",
    hints: "نشانه‌ها",
    sourceLabels: {
      INSTAGRAM: "اینستاگرام",
      TELEGRAM: "تلگرام",
      SNAP_FOOD: "اسنپ‌فود",
      SNAP_MARKET: "اسنپ‌مارکت",
      CSV: "CSV",
      EXCEL: "Excel",
      PDF: "PDF",
      IMAGE_MENU: "منوی تصویری",
      MANUAL_URL: "نشانی دستی",
      MANUAL_TEXT: "متن دستی",
      UNKNOWN: "نامشخص",
    },
    statuses: {
      QUEUED: "در صف",
      NEEDS_REVIEW: "نیازمند بررسی",
      COMPLETED: "تکمیل شده",
      FAILED: "ناموفق",
      CANCELED: "لغو شده",
    },
  },
  en: {
    title: "Bazar Baz Import Hub",
    subtitle: "Turn seller-owned channel content into reviewable drafts.",
    source: "Source",
    organization: "Organization",
    url: "Source URL",
    text: "Text or caption",
    file: "File name",
    mediaReferences: "Approved media references",
    consent: "I confirm this page or content belongs to my business or I have permission to use it.",
    create: "Create import",
    refresh: "Refresh",
    jobs: "Jobs",
    empty: "No import jobs yet.",
    loading: "Loading import hub...",
    error: "Import hub could not be loaded",
    draftCounts: "Drafts",
    review: "Review",
    cancel: "Cancel",
    approve: "Approve drafts",
    reject: "Reject drafts",
    row: "Row",
    product: "Product",
    category: "Category",
    price: "Price",
    stock: "Stock",
    content: "Content draft",
    caption: "Caption",
    media: "Media",
    hints: "Hints",
    sourceLabels: {
      INSTAGRAM: "Instagram",
      TELEGRAM: "Telegram",
      SNAP_FOOD: "Snappfood",
      SNAP_MARKET: "Snappmarket",
      CSV: "CSV",
      EXCEL: "Excel",
      PDF: "PDF",
      IMAGE_MENU: "Image menu",
      MANUAL_URL: "Manual URL",
      MANUAL_TEXT: "Manual text",
      UNKNOWN: "Unknown",
    },
    statuses: {
      QUEUED: "Queued",
      NEEDS_REVIEW: "Needs review",
      COMPLETED: "Completed",
      FAILED: "Failed",
      CANCELED: "Canceled",
    },
  },
  ar: {
    title: "مركز الاستيراد في بازار باز",
    subtitle: "حوّل محتوى قنوات البيع المملوك للبائع إلى مسودات قابلة للمراجعة.",
    source: "المصدر",
    organization: "المؤسسة",
    url: "رابط المصدر",
    text: "النص أو الوصف",
    file: "اسم الملف",
    mediaReferences: "روابط الوسائط المعتمدة",
    consent: "أؤكد أن هذه الصفحة أو المحتوى يخص عملي أو لدي إذن باستخدامه.",
    create: "إنشاء استيراد",
    refresh: "تحديث",
    jobs: "الطلبات",
    empty: "لا توجد طلبات استيراد بعد.",
    loading: "جاري تحميل مركز الاستيراد...",
    error: "تعذر تحميل مركز الاستيراد",
    draftCounts: "مسودات",
    review: "مراجعة",
    cancel: "إلغاء",
    approve: "قبول المسودات",
    reject: "رفض المسودات",
    row: "صف",
    product: "المنتج",
    category: "الفئة",
    price: "السعر",
    stock: "المخزون",
    content: "مسودة محتوى",
    caption: "الوصف",
    media: "وسائط",
    hints: "إشارات",
    sourceLabels: {
      INSTAGRAM: "إنستغرام",
      TELEGRAM: "تلغرام",
      SNAP_FOOD: "سناب فود",
      SNAP_MARKET: "سناب ماركت",
      CSV: "CSV",
      EXCEL: "Excel",
      PDF: "PDF",
      IMAGE_MENU: "قائمة مصورة",
      MANUAL_URL: "رابط يدوي",
      MANUAL_TEXT: "نص يدوي",
      UNKNOWN: "غير معروف",
    },
    statuses: {
      QUEUED: "في الانتظار",
      NEEDS_REVIEW: "بحاجة لمراجعة",
      COMPLETED: "مكتمل",
      FAILED: "فشل",
      CANCELED: "ملغى",
    },
  },
}

const sourceTypes: SourceType[] = [
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
]

function formatNumber(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

function statusVariant(status: JobStatus): "default" | "secondary" | "destructive" | "outline" {
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

export default function ImportHubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const copy = copyByLocale[locale] ?? copyByLocale.fa
  const { data: session, status: sessionStatus } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [sourceType, setSourceType] = useState<SourceType>("MANUAL_URL")
  const [inputUrl, setInputUrl] = useState("")
  const [inputText, setInputText] = useState("")
  const [inputFilename, setInputFilename] = useState("")
  const [fileContent, setFileContent] = useState("")
  const [fileBase64, setFileBase64] = useState("")
  const [mediaReferencesText, setMediaReferencesText] = useState("")
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [jobs, setJobs] = useState<ImportJob[]>([])
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === organizationId) ?? null,
    [organizationId, organizations],
  )
  const mediaReferences = useMemo(
    () => mediaReferencesText
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 10),
    [mediaReferencesText],
  )

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
    const response = await fetch(`/api/dashboard/imports/jobs${query}`, { cache: "no-store", signal })
    if (!response.ok) throw new Error(await readError(response, copy.error))
    const data = await response.json()
    setJobs((data.jobs ?? []) as ImportJob[])
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

  useEffect(() => {
    if (!organizationId || loading) return
    const controller = new AbortController()
    fetchJobs(organizationId, controller.signal).catch((err) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : copy.error)
    })
    return () => controller.abort()
  }, [copy.error, fetchJobs, loading, organizationId])

  async function createJob() {
    if (!organizationId || saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/dashboard/imports/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          sourceType,
          inputUrl,
          inputText,
          inputFilename,
          fileContent,
          fileBase64,
          mediaReferences,
          consentConfirmed,
          consentText: copy.consent,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.error))
      setInputUrl("")
      setInputText("")
      setInputFilename("")
      setFileContent("")
      setFileBase64("")
      setMediaReferencesText("")
      setConsentConfirmed(false)
      await fetchJobs(organizationId)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.error)
    } finally {
      setSaving(false)
    }
  }

  async function cancelJob(jobId: string) {
    const response = await fetch(`/api/dashboard/imports/jobs/${jobId}/cancel`, { method: "POST" })
    if (!response.ok) {
      setError(await readError(response, copy.error))
      return
    }
    await fetchJobs(organizationId)
  }

  async function loadJob(jobId: string) {
    const response = await fetch(`/api/dashboard/imports/jobs/${jobId}`, { cache: "no-store" })
    if (!response.ok) {
      setError(await readError(response, copy.error))
      return
    }
    const data = await response.json()
    setSelectedJob(data.job as ImportJob)
  }

  async function reviewDrafts(status: "APPROVED" | "REJECTED") {
    if (!selectedJob) return
    const productDraftIds = (selectedJob.productDrafts ?? [])
      .filter((draft) => draft.status === "DRAFT")
      .map((draft) => draft.id)
    const contentDraftIds = (selectedJob.contentDrafts ?? [])
      .filter((draft) => draft.status === "DRAFT")
      .map((draft) => draft.id)
    const response = await fetch(`/api/dashboard/imports/jobs/${selectedJob.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, productDraftIds, contentDraftIds }),
    })
    if (!response.ok) {
      setError(await readError(response, copy.error))
      return
    }
    const data = await response.json()
    setSelectedJob(data.job as ImportJob)
    await fetchJobs(organizationId)
  }

  async function handleFile(file: File | null) {
    setInputFilename(file?.name ?? "")
    setFileContent("")
    setFileBase64("")
    if (!file) return

    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith(".csv")) {
      setSourceType("CSV")
      setFileContent(await file.text())
      return
    }

    if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
      setSourceType("EXCEL")
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ""
      for (const byte of bytes) binary += String.fromCharCode(byte)
      setFileBase64(btoa(binary))
    }
  }

  const hasInput = Boolean(inputUrl.trim() || inputText.trim() || inputFilename.trim() || fileContent || fileBase64 || mediaReferences.length > 0)

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
              <FileInput className="size-4" />
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
              <label className="text-sm font-medium">{copy.source}</label>
              <Select value={sourceType} onValueChange={(value) => setSourceType(value as SourceType)}>
                <SelectTrigger>
                  <SelectValue placeholder={copy.source} />
                </SelectTrigger>
                <SelectContent>
                  {sourceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {copy.sourceLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.url}</label>
              <Input value={inputUrl} onChange={(event) => setInputUrl(event.target.value)} dir="ltr" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.text}</label>
              <Textarea value={inputText} onChange={(event) => setInputText(event.target.value)} rows={5} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.mediaReferences}</label>
              <Textarea
                value={mediaReferencesText}
                onChange={(event) => setMediaReferencesText(event.target.value)}
                rows={3}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.file}</label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              />
              {inputFilename && <div className="text-xs text-muted-foreground">{inputFilename}</div>}
            </div>

            <label className="flex items-start gap-3 rounded-md border p-3 text-sm leading-6">
              <Checkbox checked={consentConfirmed} onCheckedChange={(checked) => setConsentConfirmed(checked === true)} />
              <span>{copy.consent}</span>
            </label>

            <Button type="button" className="w-full" disabled={!organizationId || !hasInput || !consentConfirmed || saving} onClick={createJob}>
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
                {jobs.map((job) => {
                  const productDrafts = job._count?.productDrafts ?? 0
                  const contentDrafts = job._count?.contentDrafts ?? 0
                  return (
                    <div key={job.id} id={`job-${job.id}`} className="rounded-md border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusVariant(job.status)}>{copy.statuses[job.status]}</Badge>
                            <Badge variant="outline">{copy.sourceLabels[job.type]}</Badge>
                            {selectedOrganization ? (
                              <span className="text-sm text-muted-foreground">{selectedOrganization.name}</span>
                            ) : job.organization ? (
                              <span className="text-sm text-muted-foreground">{job.organization.name}</span>
                            ) : null}
                          </div>
                          <div className="break-all text-sm">
                            {job.inputUrl || job.inputFilename || job.inputText?.slice(0, 120) || job.id}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {copy.draftCounts}: {formatNumber(productDrafts + contentDrafts, locale)}
                            </span>
                            <span>{new Date(job.createdAt).toLocaleDateString(locale === "fa" ? "fa-IR" : locale)}</span>
                          </div>
                          {job.errorMessage && <div className="text-sm text-destructive">{job.errorMessage}</div>}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Link href={`#job-${job.id}`} className={buttonVariants({ variant: "outline", size: "sm" })} onClick={() => loadJob(job.id)}>
                            <CheckCircle2 className="size-4" />
                            {copy.review}
                          </Link>
                          {job.status !== "CANCELED" && job.status !== "COMPLETED" && (
                            <Button variant="outline" size="sm" onClick={() => cancelJob(job.id)}>
                              <XCircle className="size-4" />
                              {copy.cancel}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {copy.review}: {copy.sourceLabels[selectedJob.type]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={
                  !selectedJob.productDrafts?.some((draft) => draft.status === "DRAFT") &&
                  !selectedJob.contentDrafts?.some((draft) => draft.status === "DRAFT")
                }
                onClick={() => reviewDrafts("APPROVED")}
              >
                {copy.approve}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={
                  !selectedJob.productDrafts?.some((draft) => draft.status === "DRAFT") &&
                  !selectedJob.contentDrafts?.some((draft) => draft.status === "DRAFT")
                }
                onClick={() => reviewDrafts("REJECTED")}
              >
                {copy.reject}
              </Button>
            </div>

            {(selectedJob.productDrafts ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-2 py-2 text-start">{copy.row}</th>
                    <th className="px-2 py-2 text-start">{copy.product}</th>
                    <th className="px-2 py-2 text-start">{copy.category}</th>
                    <th className="px-2 py-2 text-start">{copy.price}</th>
                    <th className="px-2 py-2 text-start">{copy.stock}</th>
                    <th className="px-2 py-2 text-start">{copy.review}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedJob.productDrafts ?? []).map((draft) => (
                    <tr key={draft.id} className="border-b last:border-0">
                      <td className="px-2 py-2">{formatNumber(draft.rowNumber ?? 0, locale)}</td>
                      <td className="px-2 py-2">{draft.name || "-"}</td>
                      <td className="px-2 py-2">{draft.categoryName || draft.sku || "-"}</td>
                      <td className="px-2 py-2">{draft.basePrice ? String(draft.basePrice) : "-"}</td>
                      <td className="px-2 py-2">{draft.stock != null ? formatNumber(draft.stock, locale) : "-"}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          <Badge variant={draft.status === "DRAFT" ? "secondary" : draft.status === "APPROVED" ? "default" : "outline"}>
                            {draft.status}
                          </Badge>
                          {Array.isArray(draft.errors) && draft.errors.length > 0 && (
                            <span className="text-xs text-destructive">{draft.errors.join(", ")}</span>
                          )}
                          {Array.isArray(draft.warnings) && draft.warnings.length > 0 && (
                            <span className="text-xs text-muted-foreground">{draft.warnings.join(", ")}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}

            {(selectedJob.contentDrafts ?? []).length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-2 py-2 text-start">{copy.content}</th>
                      <th className="px-2 py-2 text-start">{copy.caption}</th>
                      <th className="px-2 py-2 text-start">{copy.media}</th>
                      <th className="px-2 py-2 text-start">{copy.hints}</th>
                      <th className="px-2 py-2 text-start">{copy.review}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedJob.contentDrafts ?? []).map((draft) => {
                      const hints = [
                        ...(draft.sourceMetadata?.hashtags ?? []),
                        ...(draft.sourceMetadata?.likelyProductMentions ?? []),
                      ].slice(0, 8)
                      return (
                        <tr key={draft.id} className="border-b last:border-0 align-top">
                          <td className="px-2 py-2">{draft.title || copy.content}</td>
                          <td className="max-w-[320px] px-2 py-2">
                            <div className="line-clamp-4 whitespace-pre-wrap">{draft.body || "-"}</div>
                            {draft.sourceUrl && <div className="mt-1 break-all text-xs text-muted-foreground">{draft.sourceUrl}</div>}
                          </td>
                          <td className="max-w-[220px] break-all px-2 py-2">
                            {draft.mediaUrl || "-"}
                            {draft.mediaType && <div className="mt-1 text-xs text-muted-foreground">{draft.mediaType}</div>}
                          </td>
                          <td className="px-2 py-2">{hints.length > 0 ? hints.join(", ") : "-"}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-1">
                              <Badge variant={draft.status === "DRAFT" ? "secondary" : draft.status === "APPROVED" ? "default" : "outline"}>
                                {draft.status}
                              </Badge>
                              {Array.isArray(draft.warnings) && draft.warnings.length > 0 && (
                                <span className="text-xs text-muted-foreground">{draft.warnings.join(", ")}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
