"use client"
import { appFetch } from "@/lib/app-base-path";

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bell, BellOff, RefreshCw, Send, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type CustomerSummary = {
  id: string
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

type PushSubscriptionItem = {
  id: string
  endpoint: string
  isActive: boolean
  lastSeenAt: string
  unsubscribedAt?: string | null
  createdAt: string
  updatedAt: string
  customer?: CustomerSummary | null
}

type PermissionEventItem = {
  id: string
  state: "PROMPT" | "GRANTED" | "DENIED" | "UNSUPPORTED" | "REVOKED"
  source: string
  reason?: string | null
  createdAt: string
  customer?: CustomerSummary | null
}

type WebPushDeliveryItem = {
  id: string
  customerId: string
  subscriptionId?: string | null
  title: string
  provider: string
  dryRun: boolean
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED"
  error?: string | null
  sentAt?: string | null
  createdAt: string
  customer?: CustomerSummary | null
}

type PushDashboardResponse = {
  config: {
    provider: string
    dryRun: boolean
    configured: boolean
    publicKeyConfigured: boolean
    privateKeyConfigured: boolean
    subjectConfigured: boolean
    realSendEnabled: boolean
  }
  activeCount: number
  totalCount: number
  inactiveCount: number
  eligibleCustomerCount: number
  preferenceSkippedCustomerCount: number
  subscriptions: PushSubscriptionItem[]
  permissionEvents: PermissionEventItem[]
  recentDeliveries: WebPushDeliveryItem[]
}

type WebPushCopy = {
  title: string
  subtitle: string
  refresh: string
  loading: string
  errorTitle: string
  noOrganization: string
  activeSubscriptions: string
  inactiveSubscriptions: string
  totalSubscriptions: string
  eligibleRecipients: string
  skippedByPreference: string
  config: string
  vapidPublic: string
  vapidPrivate: string
  vapidSubject: string
  configured: string
  missing: string
  dryRun: string
  realSend: string
  dryRunTitle: string
  notificationTitle: string
  notificationBody: string
  previewSend: string
  sendNow: string
  dryRunResult: string
  realSendResult: string
  subscriptions: string
  permissionEvents: string
  deliveryHistory: string
  emptySubscriptions: string
  emptyEvents: string
  emptyDeliveries: string
  customer: string
  status: string
  lastSeen: string
  sentAt: string
  endpoint: string
  active: string
  inactive: string
  delivered: string
  failed: string
  removed: string
  campaigns: string
  members: string
  safetyNote: string
  states: Record<PermissionEventItem["state"], string>
  deliveryStates: Record<WebPushDeliveryItem["status"], string>
}

const defaultCopy: WebPushCopy = {
  title: "Web Push",
  subtitle: "Manage explicit browser opt-ins and dry-run Web Push delivery previews.",
  refresh: "Refresh",
  loading: "Loading Web Push...",
  errorTitle: "Web Push could not be loaded",
  noOrganization: "An active management membership is required to manage Web Push.",
  activeSubscriptions: "Active subscriptions",
  inactiveSubscriptions: "Inactive",
  totalSubscriptions: "Total",
  eligibleRecipients: "Eligible recipients",
  skippedByPreference: "Skipped by preference",
  config: "Configuration",
  vapidPublic: "VAPID public key",
  vapidPrivate: "VAPID private key",
  vapidSubject: "VAPID subject",
  configured: "Configured",
  missing: "Missing",
  dryRun: "Dry-run mode",
  realSend: "Real send feature flag",
  dryRunTitle: "Dry-run push",
  notificationTitle: "Notification title",
  notificationBody: "Notification body",
  previewSend: "Preview send",
  sendNow: "Send now",
  dryRunResult: "Dry-run result",
  realSendResult: "Real send complete",
  subscriptions: "Subscriptions",
  permissionEvents: "Permission events",
  deliveryHistory: "Delivery history",
  emptySubscriptions: "No push subscriptions yet",
  emptyEvents: "No permission events yet",
  emptyDeliveries: "No Web Push deliveries yet",
  customer: "Customer",
  status: "Status",
  lastSeen: "Last seen",
  sentAt: "Sent at",
  endpoint: "Endpoint",
  active: "Active",
  inactive: "Inactive",
  delivered: "Delivered",
  failed: "Failed",
  removed: "Removed",
  campaigns: "Campaigns",
  members: "Members",
  safetyNote: "P100 sends only to customers with active subscriptions and enabled Web Push preferences. Real delivery remains behind explicit environment flags.",
  states: {
    PROMPT: "Prompt",
    GRANTED: "Granted",
    DENIED: "Denied",
    UNSUPPORTED: "Unsupported",
    REVOKED: "Revoked",
  },
  deliveryStates: {
    PENDING: "Pending",
    SENT: "Sent",
    FAILED: "Failed",
    SKIPPED: "Skipped",
  },
}

function formatCount(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

function getDisplayName(customer?: CustomerSummary | null) {
  if (!customer) return "Customer"
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.name || customer.email || customer.phone || "Customer"
}

function shortenEndpoint(endpoint: string) {
  if (endpoint.length <= 52) return endpoint
  return `${endpoint.slice(0, 28)}...${endpoint.slice(-18)}`
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function WebPushDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const [copy, setCopy] = useState<WebPushCopy>(defaultCopy)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [data, setData] = useState<PushDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [title, setTitle] = useState("New update from your shop")
  const [body, setBody] = useState("Open Bazarbaaz to see the latest update.")
  const [dryRun, setDryRun] = useState(true)

  useEffect(() => {
    const dict = getDictionary(locale)
    const webPushCopy = dict.webPush
    setCopy(webPushCopy && typeof webPushCopy === "object" ? (webPushCopy as WebPushCopy) : defaultCopy)
  }, [locale])

  const fetchPush = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    const membershipResponse = await appFetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) throw new Error(await readError(membershipResponse, "Failed to load organization membership"))

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error(copy.noOrganization)

    const response = await appFetch(`/api/dashboard/customer-club/push?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) throw new Error(await readError(response, "Failed to load Web Push"))

    setOrganizationId(orgId)
    setData(await response.json())
  }, [copy.noOrganization])

  useEffect(() => {
    const controller = new AbortController()
    fetchPush(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [copy.errorTitle, fetchPush])

  const stats = useMemo(() => ({
    active: data?.activeCount ?? 0,
    inactive: data?.inactiveCount ?? 0,
    total: data?.totalCount ?? 0,
    eligible: data?.eligibleCustomerCount ?? 0,
    skippedByPreference: data?.preferenceSkippedCustomerCount ?? 0,
  }), [data])

  const refresh = async () => {
    setBusy(true)
    try {
      await fetchPush()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  const previewSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organizationId) return
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      const response = await appFetch("/api/dashboard/customer-club/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          title,
          body,
          dryRun,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, dryRun ? "Dry-run push failed" : "Real push failed"))
      const result = await response.json()
      if (dryRun) {
        setNotice(`${copy.dryRunResult}: ${formatCount(result.recipientCount ?? 0, locale)} customers, ${formatCount(result.subscriptionCount ?? 0, locale)} subscriptions, ${formatCount(result.preferenceSkippedCustomerCount ?? 0, locale)} skipped`)
      } else {
        setNotice(`${copy.realSendResult}: ${formatCount(result.recipientCount ?? 0, locale)} customers, ${formatCount(result.successCount ?? 0, locale)} ${copy.delivered}, ${formatCount(result.failureCount ?? 0, locale)} ${copy.failed}, ${formatCount(result.removedCount ?? 0, locale)} ${copy.removed}`)
      }
      await fetchPush()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto space-y-6 px-4 py-8">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{copy.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline" })} href={`/${locale}/dashboard/customer-club/members`}>
            {copy.members}
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href={`/${locale}/dashboard/customer-club/campaigns`}>
            {copy.campaigns}
          </Link>
          <Button type="button" variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {copy.refresh}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-medium">{copy.errorTitle}</p>
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {notice && (
        <Card className="border-primary/40">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <Send className="mt-0.5 h-5 w-5 text-primary" />
            <p>{notice}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bell className="h-4 w-4" />
              {copy.activeSubscriptions}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatCount(stats.active, locale)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <BellOff className="h-4 w-4" />
              {copy.inactiveSubscriptions}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatCount(stats.inactive, locale)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              {copy.totalSubscriptions}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatCount(stats.total, locale)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Send className="h-4 w-4" />
              {copy.eligibleRecipients}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatCount(stats.eligible, locale)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <BellOff className="h-4 w-4" />
              {copy.skippedByPreference}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{formatCount(stats.skippedByPreference, locale)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{copy.subscriptions}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.subscriptions.length ? data.subscriptions.map((subscription) => (
                <div key={subscription.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{getDisplayName(subscription.customer)}</div>
                    <Badge variant={subscription.isActive ? "default" : "secondary"}>
                      {subscription.isActive ? copy.active : copy.inactive}
                    </Badge>
                  </div>
                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    {copy.endpoint}: {shortenEndpoint(subscription.endpoint)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.lastSeen}: {new Date(subscription.lastSeenAt).toLocaleString(locale)}
                  </p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">{copy.emptySubscriptions}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.permissionEvents}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.permissionEvents.length ? data.permissionEvents.map((event) => (
                <div key={event.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{getDisplayName(event.customer)}</div>
                    <Badge variant={event.state === "GRANTED" ? "default" : "secondary"}>
                      {copy.states[event.state] ?? event.state}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.source} - {new Date(event.createdAt).toLocaleString(locale)}
                  </p>
                  {event.reason && <p className="mt-2 text-xs text-muted-foreground">{event.reason}</p>}
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">{copy.emptyEvents}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.deliveryHistory}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.recentDeliveries.length ? data.recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{getDisplayName(delivery.customer)}</div>
                    <Badge variant={delivery.status === "SENT" ? "default" : delivery.status === "FAILED" ? "destructive" : "secondary"}>
                      {copy.deliveryStates[delivery.status] ?? delivery.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm">{delivery.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {delivery.provider} - {copy.sentAt}: {new Date(delivery.sentAt ?? delivery.createdAt).toLocaleString(locale)}
                  </p>
                  {delivery.error && <p className="mt-2 text-xs text-destructive">{delivery.error}</p>}
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">{copy.emptyDeliveries}</p>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{copy.config}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                [copy.vapidPublic, data?.config.publicKeyConfigured],
                [copy.vapidPrivate, data?.config.privateKeyConfigured],
                [copy.vapidSubject, data?.config.subjectConfigured],
                [copy.dryRun, data?.config.dryRun],
                [copy.realSend, data?.config.realSendEnabled],
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <Badge variant={ok ? "default" : "secondary"}>{ok ? copy.configured : copy.missing}</Badge>
                </div>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">{copy.safetyNote}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.dryRunTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={previewSend}>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.notificationTitle} maxLength={120} />
                <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={copy.notificationBody} rows={5} maxLength={500} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} />
                  {copy.dryRun}
                </label>
                <Button type="submit" disabled={busy || !organizationId || !title.trim() || !body.trim()}>
                  <Send className="h-4 w-4" />
                  {dryRun ? copy.previewSend : copy.sendNow}
                </Button>
              </form>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  )
}
