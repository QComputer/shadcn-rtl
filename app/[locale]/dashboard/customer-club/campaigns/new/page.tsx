"use client"
import { appFetch } from "@/lib/app-base-path";

import { use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Save } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type CustomerSegment = {
  key: string
  name: string
  description: string
  memberCount: number
}

type CampaignCopy = {
  title: string
  subtitle: string
  newCampaign: string
  backToCampaigns: string
  campaignTitle: string
  campaignTitlePlaceholder: string
  segment: string
  message: string
  messagePlaceholder: string
  scheduledAt: string
  createDraft: string
  saving: string
  loading: string
  errorTitle: string
  previewAudience: string
  recipients: string
  inAppOnly: string
  noOrganization: string
}

const defaultCopy: CampaignCopy = {
  title: "New Campaign",
  subtitle: "Create an in-app campaign draft for a Customer Club segment.",
  newCampaign: "New campaign",
  backToCampaigns: "Campaigns",
  campaignTitle: "Campaign title",
  campaignTitlePlaceholder: "Win-back message for inactive customers",
  segment: "Segment",
  message: "Message",
  messagePlaceholder: "Write the in-app campaign message...",
  scheduledAt: "Scheduled time",
  createDraft: "Create draft",
  saving: "Saving...",
  loading: "Loading campaign builder...",
  errorTitle: "Campaign could not be created",
  previewAudience: "Audience preview",
  recipients: "recipients",
  inAppOnly: "Only in-app delivery is available in this phase.",
  noOrganization: "An active management membership is required to create campaigns.",
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

export default function NewCampaignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const router = useRouter()
  const [copy, setCopy] = useState<CampaignCopy>(defaultCopy)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [title, setTitle] = useState("")
  const [segmentKey, setSegmentKey] = useState("")
  const [message, setMessage] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dict = getDictionary(locale)
    const campaignCopy = dict.campaignBuilder
    setCopy(campaignCopy && typeof campaignCopy === "object" ? (campaignCopy as CampaignCopy) : defaultCopy)
  }, [locale])

  const loadBuilder = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    const membershipResponse = await appFetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) throw new Error(await readError(membershipResponse, "Failed to load organization membership"))

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error(copy.noOrganization)

    const segmentsResponse = await appFetch(`/api/dashboard/customer-club/segments?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!segmentsResponse.ok) throw new Error(await readError(segmentsResponse, "Failed to load segments"))

    const data = await segmentsResponse.json()
    const loadedSegments = Array.isArray(data?.segments) ? data.segments : []
    setOrganizationId(orgId)
    setSegments(loadedSegments)
    setSegmentKey(loadedSegments[0]?.key ?? "")
  }, [copy.noOrganization])

  useEffect(() => {
    const controller = new AbortController()
    loadBuilder(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [copy.errorTitle, loadBuilder])

  const selectedSegment = useMemo(() => segments.find((segment) => segment.key === segmentKey) ?? null, [segmentKey, segments])
  const canSubmit = Boolean(organizationId && title.trim() && segmentKey && message.trim())

  const createCampaign = async () => {
    if (!organizationId || !canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const response = await appFetch("/api/dashboard/customer-club/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          title: title.trim(),
          segmentKey,
          message: message.trim(),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, "Failed to create campaign"))
      const data = await response.json()
      router.push(`/${locale}/dashboard/customer-club/campaigns/${data.campaign.id}`)
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
        <div className="h-80 rounded-lg bg-muted" />
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
        <Link href={`/${locale}/dashboard/customer-club/campaigns`} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {copy.backToCampaigns}
        </Link>
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

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader><CardTitle className="text-base">{copy.newCampaign}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.campaignTitle}</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.campaignTitlePlaceholder} maxLength={120} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.segment}</label>
              <Select value={segmentKey} onValueChange={setSegmentKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {segments.map((segment) => (
                    <SelectItem key={segment.key} value={segment.key}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.message}</label>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={copy.messagePlaceholder} maxLength={500} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{copy.scheduledAt}</label>
              <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </div>

            <Button type="button" onClick={createCampaign} disabled={saving || !canSubmit}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? copy.saving : copy.createDraft}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{copy.previewAudience}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{formatCount(selectedSegment?.memberCount ?? 0, locale)}</div>
            <p className="text-sm text-muted-foreground">{copy.recipients}</p>
            {selectedSegment && (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{selectedSegment.name}</p>
                <p className="mt-1 text-muted-foreground">{selectedSegment.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
