"use client"
import { appFetch } from "@/lib/app-base-path";

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, BarChart3, Megaphone, Plus, RefreshCw, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants, Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELED"

type CampaignListItem = {
  id: string
  title: string
  status: CampaignStatus
  scheduledAt?: string | null
  sentAt?: string | null
  canceledAt?: string | null
  createdAt: string
  audience?: {
    segmentKey: string
    memberCount: number
  } | null
  message?: {
    body: string
  } | null
  deliveryCount: number
}

type CampaignCopy = {
  title: string
  subtitle: string
  newCampaign: string
  refresh: string
  loading: string
  emptyTitle: string
  emptyDescription: string
  errorTitle: string
  campaigns: string
  activeDrafts: string
  sentCampaigns: string
  audience: string
  deliveries: string
  createdAt: string
  open: string
  inAppOnly: string
  noOrganization: string
  segments: string
  statuses: Record<CampaignStatus, string>
}

const defaultCopy: CampaignCopy = {
  title: "Campaigns",
  subtitle: "Build dry-run-safe in-app campaigns for Customer Club segments.",
  newCampaign: "New campaign",
  refresh: "Refresh",
  loading: "Loading campaigns...",
  emptyTitle: "No campaigns yet",
  emptyDescription: "Draft campaigns will appear here after you create them.",
  errorTitle: "Campaigns could not be loaded",
  campaigns: "Campaigns",
  activeDrafts: "Drafts",
  sentCampaigns: "Sent",
  audience: "Audience",
  deliveries: "Deliveries",
  createdAt: "Created",
  open: "Open",
  inAppOnly: "P45 only sends in-app notifications and never sends external messages.",
  noOrganization: "An active management membership is required to view campaigns.",
  segments: "Segments",
  statuses: {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    SENDING: "Sending",
    SENT: "Sent",
    CANCELED: "Canceled",
  },
}

function formatCount(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function CampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const [copy, setCopy] = useState<CampaignCopy>(defaultCopy)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dict = getDictionary(locale)
    const campaignCopy = dict.campaignBuilder
    setCopy(campaignCopy && typeof campaignCopy === "object" ? (campaignCopy as CampaignCopy) : defaultCopy)
  }, [locale])

  const fetchCampaigns = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    const membershipResponse = await appFetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) throw new Error(await readError(membershipResponse, "Failed to load organization membership"))

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error(copy.noOrganization)

    const response = await appFetch(`/api/dashboard/customer-club/campaigns?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) throw new Error(await readError(response, "Failed to load campaigns"))

    const data = await response.json()
    setOrganizationId(orgId)
    setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : [])
  }, [copy.noOrganization])

  useEffect(() => {
    const controller = new AbortController()
    fetchCampaigns(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [copy.errorTitle, fetchCampaigns])

  const stats = useMemo(() => ({
    total: campaigns.length,
    drafts: campaigns.filter((campaign) => campaign.status === "DRAFT" || campaign.status === "SCHEDULED").length,
    sent: campaigns.filter((campaign) => campaign.status === "SENT").length,
  }), [campaigns])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await fetchCampaigns()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-28 rounded-lg bg-muted" />
          <div className="h-28 rounded-lg bg-muted" />
          <div className="h-28 rounded-lg bg-muted" />
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
          <Link href={`/${locale}/dashboard/customer-club/segments`} className={buttonVariants({ variant: "outline" })}>
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            {copy.segments}
          </Link>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {copy.refresh}
          </Button>
          <Link
            href={`/${locale}/dashboard/customer-club/campaigns/new`}
            className={buttonVariants({ variant: "default" })}
            aria-disabled={!organizationId}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {copy.newCampaign}
          </Link>
        </div>
      </div>

      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{copy.inAppOnly}</p>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{copy.errorTitle}</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.campaigns}</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(stats.total, locale)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{copy.activeDrafts}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(stats.drafts, locale)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.sentCampaigns}</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(stats.sent, locale)}</div></CardContent>
        </Card>
      </div>

      {campaigns.length > 0 ? (
        <div className="grid gap-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{campaign.title}</h2>
                      <Badge>{copy.statuses[campaign.status] ?? campaign.status}</Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{campaign.message?.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {copy.audience}: {campaign.audience?.segmentKey ?? "-"} / {formatCount(campaign.audience?.memberCount ?? 0, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{copy.deliveries}: {formatCount(campaign.deliveryCount, locale)}</span>
                    <span>{copy.createdAt}: {new Date(campaign.createdAt).toLocaleDateString(locale)}</span>
                    <Link href={`/${locale}/dashboard/customer-club/campaigns/${campaign.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {copy.open}
                    </Link>
                  </div>
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
