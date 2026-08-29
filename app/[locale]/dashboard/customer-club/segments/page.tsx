"use client"
import { appFetch } from "@/lib/app-base-path";

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, BarChart3, Megaphone, RefreshCw, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type CustomerSegment = {
  key: string
  name: string
  description: string
  memberCount: number
  rule: Record<string, unknown>
  latestSnapshot?: {
    memberCount: number
    calculatedAt: string
  } | null
}

type SegmentCopy = {
  title: string
  subtitle: string
  refresh: string
  saveSnapshot: string
  saving: string
  loading: string
  emptyTitle: string
  emptyDescription: string
  errorTitle: string
  currentCount: string
  latestSnapshot: string
  neverSnapshotted: string
  rule: string
  saved: string
  tenantSafeNote: string
  noOrganization: string
  campaigns?: string
}

const defaultCopy: SegmentCopy = {
  title: "Customer Segments",
  subtitle: "Review ready-made customer club groups for future notifications and campaigns.",
  refresh: "Refresh",
  saveSnapshot: "Save snapshot",
  saving: "Saving...",
  loading: "Calculating segments...",
  emptyTitle: "No segments to show",
  emptyDescription: "Segment counts will appear here when the customer club has data.",
  errorTitle: "Segments could not be calculated",
  currentCount: "Active club members",
  latestSnapshot: "Latest snapshot",
  neverSnapshotted: "Not saved yet",
  rule: "Rule",
  saved: "Snapshot saved",
  tenantSafeNote: "All counts are calculated only from this organization's data.",
  noOrganization: "An active management membership is required to view segments.",
  campaigns: "Campaigns",
}

const fallbackCopy: Record<string, SegmentCopy> = {
  fa: defaultCopy,
  en: defaultCopy,
  ar: defaultCopy,
}

function formatCount(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

function formatRule(rule: Record<string, unknown>) {
  return Object.entries(rule)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
    .join(" / ")
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function CustomerSegmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const [copy, setCopy] = useState<SegmentCopy>(fallbackCopy[locale] ?? defaultCopy)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const dict = getDictionary(locale)
    const segmentCopy = dict.customerSegments
    setCopy(segmentCopy && typeof segmentCopy === "object" ? (segmentCopy as SegmentCopy) : fallbackCopy[locale] ?? defaultCopy)
  }, [locale])

  const fetchSegments = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    setNotice(null)

    const membershipResponse = await appFetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) {
      throw new Error(await readError(membershipResponse, "Failed to load organization membership"))
    }

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error(copy.noOrganization)

    const response = await appFetch(`/api/dashboard/customer-club/segments?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) {
      throw new Error(await readError(response, "Failed to load customer segments"))
    }

    const data = await response.json()
    setOrganizationId(orgId)
    setSegments(Array.isArray(data?.segments) ? data.segments : [])
  }, [copy.noOrganization])

  useEffect(() => {
    const controller = new AbortController()
    fetchSegments(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [copy.errorTitle, fetchSegments])

  const activeMemberCount = useMemo(
    () => segments.find((segment) => segment.key === "all_club_members")?.memberCount ?? 0,
    [segments],
  )

  const refresh = async () => {
    setRefreshing(true)
    try {
      await fetchSegments()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setRefreshing(false)
    }
  }

  const saveSnapshot = async () => {
    if (!organizationId) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const response = await appFetch(`/api/dashboard/customer-club/segments?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "POST",
      })
      if (!response.ok) {
        throw new Error(await readError(response, "Failed to save segment snapshot"))
      }
      const data = await response.json()
      setNotice(`${copy.saved}: ${formatCount(data.saved ?? 0, locale)}`)
      await fetchSegments()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={`segment-loading-${item}`} className="h-36 rounded-lg bg-muted" />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-normal">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/dashboard/customer-club/campaigns`} className={buttonVariants({ variant: "outline" })}>
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            {copy.campaigns ?? "Campaigns"}
          </Link>
          <Button variant="outline" onClick={refresh} disabled={refreshing || saving}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {copy.refresh}
          </Button>
          <Button onClick={saveSnapshot} disabled={saving || !organizationId}>
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? copy.saving : copy.saveSnapshot}
          </Button>
        </div>
      </div>

      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{copy.tenantSafeNote}</p>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{copy.errorTitle}</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {notice && <p className="rounded-md border p-3 text-sm text-muted-foreground">{notice}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{copy.currentCount}</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCount(activeMemberCount, locale)}</div>
        </CardContent>
      </Card>

      {segments.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {segments.map((segment) => (
            <Card key={segment.key}>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{segment.name}</CardTitle>
                  <Badge>{formatCount(segment.memberCount, locale)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{segment.description}</p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">{copy.rule}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRule(segment.rule)}</p>
                </div>
                <div>
                  <p className="font-medium">{copy.latestSnapshot}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {segment.latestSnapshot
                      ? `${formatCount(segment.latestSnapshot.memberCount, locale)} / ${new Date(segment.latestSnapshot.calculatedAt).toLocaleString(locale)}`
                      : copy.neverSnapshotted}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">{copy.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.emptyDescription}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
