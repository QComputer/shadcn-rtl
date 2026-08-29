"use client"
import { appFetch } from "@/lib/app-base-path";

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Ban, RefreshCw, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELED"

type CampaignDetail = {
  id: string
  title: string
  status: CampaignStatus
  scheduledAt?: string | null
  sentAt?: string | null
  canceledAt?: string | null
  createdAt: string
  audiences: Array<{
    segmentKey: string
    memberCount: number
  }>
  messages: Array<{
    id: string
    channel: string
    body: string
  }>
  deliveries: Array<{
    id: string
    status: string
    sentAt?: string | null
    targetUser: {
      name?: string | null
      firstName?: string | null
      lastName?: string | null
      email?: string | null
      phone?: string | null
    }
  }>
  _count: {
    deliveries: number
  }
}

type CampaignCopy = {
  title: string
  backToCampaigns: string
  refresh: string
  loading: string
  errorTitle: string
  audience: string
  message: string
  deliveries: string
  dryRun: string
  send: string
  sending: string
  cancel: string
  canceling: string
  recipients: string
  createdAt: string
  scheduledAt: string
  sentAt: string
  canceledAt: string
  previewResult: string
  sentResult: string
  inAppOnly: string
  noDeliveries: string
  noOrganization: string
  statuses: Record<CampaignStatus, string>
}

const defaultCopy: CampaignCopy = {
  title: "Campaign",
  backToCampaigns: "Campaigns",
  refresh: "Refresh",
  loading: "Loading campaign...",
  errorTitle: "Campaign could not be loaded",
  audience: "Audience",
  message: "Message",
  deliveries: "Deliveries",
  dryRun: "Dry run",
  send: "Send in app",
  sending: "Sending...",
  cancel: "Cancel campaign",
  canceling: "Canceling...",
  recipients: "recipients",
  createdAt: "Created",
  scheduledAt: "Scheduled",
  sentAt: "Sent",
  canceledAt: "Canceled",
  previewResult: "Preview",
  sentResult: "Sent",
  inAppOnly: "P45 only creates in-app notifications. External delivery is not enabled.",
  noDeliveries: "No delivery records yet.",
  noOrganization: "An active management membership is required to view campaigns.",
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

function displayName(delivery: CampaignDetail["deliveries"][number]) {
  const user = delivery.targetUser
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.name || user.email || user.phone || "Customer"
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function CampaignDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale = "fa", id } = use(params)
  const [copy, setCopy] = useState<CampaignCopy>(defaultCopy)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dict = getDictionary(locale)
    const campaignCopy = dict.campaignBuilder
    setCopy(campaignCopy && typeof campaignCopy === "object" ? (campaignCopy as CampaignCopy) : defaultCopy)
  }, [locale])

  const fetchCampaign = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    const membershipResponse = await appFetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) throw new Error(await readError(membershipResponse, "Failed to load organization membership"))

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error(copy.noOrganization)

    const response = await appFetch(`/api/dashboard/customer-club/campaigns/${id}?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) throw new Error(await readError(response, "Failed to load campaign"))

    const data = await response.json()
    setOrganizationId(orgId)
    setCampaign(data.campaign ?? null)
  }, [copy.noOrganization, id])

  useEffect(() => {
    const controller = new AbortController()
    fetchCampaign(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [copy.errorTitle, fetchCampaign])

  const canMutate = campaign?.status === "DRAFT" || campaign?.status === "SCHEDULED"
  const audience = campaign?.audiences[0] ?? null
  const message = useMemo(() => campaign?.messages.find((item) => item.channel === "IN_APP") ?? campaign?.messages[0] ?? null, [campaign])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await fetchCampaign()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setRefreshing(false)
    }
  }

  const sendCampaign = async (dryRun: boolean) => {
    if (!organizationId) return
    setSending(true)
    setNotice(null)
    setError(null)
    try {
      const response = await appFetch(`/api/dashboard/customer-club/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, dryRun }),
      })
      if (!response.ok) throw new Error(await readError(response, "Failed to send campaign"))
      const data = await response.json()
      setNotice(`${dryRun ? copy.previewResult : copy.sentResult}: ${formatCount(data.recipientCount ?? data.created ?? 0, locale)} ${copy.recipients}`)
      await fetchCampaign()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setSending(false)
    }
  }

  const cancelCampaign = async () => {
    if (!organizationId) return
    setCanceling(true)
    setNotice(null)
    setError(null)
    try {
      const response = await appFetch(`/api/dashboard/customer-club/campaigns/${id}?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error(await readError(response, "Failed to cancel campaign"))
      await fetchCampaign()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setCanceling(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="h-72 rounded-lg bg-muted" />
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 lg:p-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-normal">{campaign?.title ?? copy.title}</h1>
            {campaign && <Badge>{copy.statuses[campaign.status] ?? campaign.status}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{copy.inAppOnly}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/dashboard/customer-club/campaigns`} className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {copy.backToCampaigns}
          </Link>
          <Button variant="outline" onClick={refresh} disabled={refreshing || sending || canceling}>
            <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {copy.refresh}
          </Button>
        </div>
      </div>

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

      {campaign && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{copy.audience}</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCount(audience?.memberCount ?? 0, locale)}</div>
                <p className="text-sm text-muted-foreground">{audience?.segmentKey}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{copy.deliveries}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatCount(campaign._count.deliveries, locale)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{copy.createdAt}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{new Date(campaign.createdAt).toLocaleString(locale)}</p></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <Card>
              <CardHeader><CardTitle className="text-base">{copy.message}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="rounded-md border p-3 text-sm">{message?.body}</p>
                {campaign.scheduledAt && <p className="text-sm text-muted-foreground">{copy.scheduledAt}: {new Date(campaign.scheduledAt).toLocaleString(locale)}</p>}
                {campaign.sentAt && <p className="text-sm text-muted-foreground">{copy.sentAt}: {new Date(campaign.sentAt).toLocaleString(locale)}</p>}
                {campaign.canceledAt && <p className="text-sm text-muted-foreground">{copy.canceledAt}: {new Date(campaign.canceledAt).toLocaleString(locale)}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{copy.title}</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="outline" onClick={() => sendCampaign(true)} disabled={sending || canceling || !canMutate}>
                  {copy.dryRun}
                </Button>
                <Button onClick={() => sendCampaign(false)} disabled={sending || canceling || !canMutate}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {sending ? copy.sending : copy.send}
                </Button>
                <Button variant="destructive" onClick={cancelCampaign} disabled={sending || canceling || !canMutate}>
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  {canceling ? copy.canceling : copy.cancel}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">{copy.deliveries}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {campaign.deliveries.length > 0 ? (
                campaign.deliveries.map((delivery) => (
                  <div key={delivery.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{displayName(delivery)}</p>
                      <p className="text-xs text-muted-foreground">{delivery.targetUser.email || delivery.targetUser.phone}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={delivery.status === "SENT" ? "default" : "secondary"}>{delivery.status}</Badge>
                      {delivery.sentAt && <span>{new Date(delivery.sentAt).toLocaleString(locale)}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">{copy.noDeliveries}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
