"use client"

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, BadgePercent, Coins, Gift, RefreshCw, Save, TicketPercent } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type CouponDiscountType = "PERCENTAGE" | "FIXED_AMOUNT"

type Coupon = {
  id: string
  code: string
  name: string
  description?: string | null
  discountType: CouponDiscountType
  discountValue: string | number
  minOrderTotal?: string | number | null
  maxDiscountAmount?: string | number | null
  startsAt?: string | null
  expiresAt?: string | null
  usageLimit?: number | null
  usedCount: number
  perCustomerLimit?: number | null
  segmentKey?: string | null
  isActive: boolean
  createdAt: string
  _count?: { redemptions: number }
}

type CouponsCopy = {
  title: string
  subtitle: string
  refresh: string
  loading: string
  emptyTitle: string
  emptyDescription: string
  errorTitle: string
  createCoupon: string
  code: string
  name: string
  description: string
  discountType: string
  discountValue: string
  minOrderTotal: string
  maxDiscountAmount: string
  startsAt: string
  expiresAt: string
  usageLimit: string
  perCustomerLimit: string
  segment: string
  noSegment: string
  saveCoupon: string
  coupons: string
  activeCoupons: string
  redemptions: string
  loyalty: string
  noOrganization: string
  success: string
  tenantSafeNote: string
  unlimited: string
  discountTypes: Record<CouponDiscountType, string>
  segments: Record<string, string>
}

const defaultCopy: CouponsCopy = {
  title: "Coupons",
  subtitle: "Create organization-scoped coupons for Customer Club members and segments.",
  refresh: "Refresh",
  loading: "Loading coupons...",
  emptyTitle: "No coupons yet",
  emptyDescription: "Coupons will appear here after you create them.",
  errorTitle: "Coupons could not be loaded",
  createCoupon: "Create coupon",
  code: "Code",
  name: "Name",
  description: "Description",
  discountType: "Discount type",
  discountValue: "Discount value",
  minOrderTotal: "Minimum order total",
  maxDiscountAmount: "Maximum discount",
  startsAt: "Starts at",
  expiresAt: "Expires at",
  usageLimit: "Usage limit",
  perCustomerLimit: "Per-customer limit",
  segment: "Segment",
  noSegment: "All active club members",
  saveCoupon: "Save coupon",
  coupons: "Coupons",
  activeCoupons: "Active",
  redemptions: "Redemptions",
  loyalty: "Loyalty",
  noOrganization: "An active management membership is required to manage coupons.",
  success: "Saved",
  tenantSafeNote: "Coupons are scoped to this organization and can be limited by date, usage count, customer count, and segment.",
  unlimited: "Unlimited",
  discountTypes: {
    PERCENTAGE: "Percentage",
    FIXED_AMOUNT: "Fixed amount",
  },
  segments: {
    all_club_members: "All club members",
    new_members_30d: "New members, 30 days",
    recent_buyers_30d: "Recent buyers, 30 days",
    inactive_60d: "Inactive, 60 days",
    vip_by_revenue: "VIP by revenue",
    high_order_count: "High order count",
    abandoned_cart_candidates: "Abandoned cart candidates",
  },
}

const SEGMENT_KEYS = [
  "all_club_members",
  "new_members_30d",
  "recent_buyers_30d",
  "inactive_60d",
  "vip_by_revenue",
  "high_order_count",
  "abandoned_cart_candidates",
]

function formatCount(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

function formatMoney(value: string | number | null | undefined, locale: string) {
  const numeric = Number(value ?? 0)
  const formatted = Number.isFinite(numeric) ? numeric.toLocaleString(locale) : "0"
  return locale === "fa" || locale === "ar" ? toPersianDigits(formatted) : formatted
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null
}

export default function CouponsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const [copy, setCopy] = useState<CouponsCopy>(defaultCopy)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [discountType, setDiscountType] = useState<CouponDiscountType>("PERCENTAGE")
  const [discountValue, setDiscountValue] = useState("10")
  const [minOrderTotal, setMinOrderTotal] = useState("")
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [perCustomerLimit, setPerCustomerLimit] = useState("1")
  const [segmentKey, setSegmentKey] = useState("__all")

  useEffect(() => {
    const dict = getDictionary(locale)
    const couponsCopy = dict.loyaltyCoupons
    setCopy(couponsCopy && typeof couponsCopy === "object" ? (couponsCopy as CouponsCopy) : defaultCopy)
  }, [locale])

  const fetchCoupons = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    const membershipResponse = await fetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) throw new Error(await readError(membershipResponse, "Failed to load organization membership"))

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error(copy.noOrganization)

    const response = await fetch(`/api/dashboard/customer-club/coupons?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) throw new Error(await readError(response, "Failed to load coupons"))

    const data = await response.json()
    setOrganizationId(orgId)
    setCoupons(Array.isArray(data?.coupons) ? data.coupons : [])
  }, [copy.noOrganization])

  useEffect(() => {
    const controller = new AbortController()
    fetchCoupons(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [copy.errorTitle, fetchCoupons])

  const stats = useMemo(() => ({
    total: coupons.length,
    active: coupons.filter((coupon) => coupon.isActive).length,
    redemptions: coupons.reduce((sum, coupon) => sum + (coupon._count?.redemptions ?? coupon.usedCount ?? 0), 0),
  }), [coupons])

  const refresh = async () => {
    setBusy(true)
    try {
      await fetchCoupons()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  const createCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!organizationId) return

    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch("/api/dashboard/customer-club/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          code,
          name,
          description: description || null,
          discountType,
          discountValue: Number(discountValue),
          minOrderTotal: minOrderTotal ? Number(minOrderTotal) : null,
          maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
          startsAt: toIsoOrNull(startsAt),
          expiresAt: toIsoOrNull(expiresAt),
          usageLimit: usageLimit ? Number(usageLimit) : null,
          perCustomerLimit: perCustomerLimit ? Number(perCustomerLimit) : null,
          segmentKey: segmentKey === "__all" ? null : segmentKey,
          isActive: true,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.errorTitle))
      setNotice(copy.success)
      setCode("")
      setName("")
      setDescription("")
      await fetchCoupons()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
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
          <Link href={`/${locale}/dashboard/customer-club/loyalty`} className={buttonVariants({ variant: "outline" })}>
            <Coins className="h-4 w-4" aria-hidden="true" />
            {copy.loyalty}
          </Link>
          <Button variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {copy.refresh}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.coupons}</CardTitle>
            <TicketPercent className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(stats.total, locale)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.activeCoupons}</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(stats.active, locale)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.redemptions}</CardTitle>
            <BadgePercent className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(stats.redemptions, locale)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{copy.createCoupon}</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-4" onSubmit={createCoupon}>
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder={copy.code} />
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={copy.name} />
            <Select value={discountType} onValueChange={(value) => setDiscountType(value as CouponDiscountType)}>
              <SelectTrigger><SelectValue placeholder={copy.discountType} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">{copy.discountTypes.PERCENTAGE}</SelectItem>
                <SelectItem value="FIXED_AMOUNT">{copy.discountTypes.FIXED_AMOUNT}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min="1" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder={copy.discountValue} />
            <Input type="number" min="0" value={minOrderTotal} onChange={(event) => setMinOrderTotal(event.target.value)} placeholder={copy.minOrderTotal} />
            <Input type="number" min="0" value={maxDiscountAmount} onChange={(event) => setMaxDiscountAmount(event.target.value)} placeholder={copy.maxDiscountAmount} />
            <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} aria-label={copy.startsAt} />
            <Input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} aria-label={copy.expiresAt} />
            <Input type="number" min="1" value={usageLimit} onChange={(event) => setUsageLimit(event.target.value)} placeholder={copy.usageLimit} />
            <Input type="number" min="1" value={perCustomerLimit} onChange={(event) => setPerCustomerLimit(event.target.value)} placeholder={copy.perCustomerLimit} />
            <Select value={segmentKey} onValueChange={setSegmentKey}>
              <SelectTrigger><SelectValue placeholder={copy.segment} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{copy.noSegment}</SelectItem>
                {SEGMENT_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>{copy.segments[key] ?? key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={busy || !organizationId || !code.trim() || !name.trim()}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {copy.saveCoupon}
            </Button>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={copy.description}
              className="lg:col-span-4"
            />
          </form>
        </CardContent>
      </Card>

      {coupons.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{coupon.name}</CardTitle>
                  <Badge variant={coupon.isActive ? "default" : "secondary"}>{coupon.code}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{coupon.description}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{copy.discountType}</span>
                  <span className="font-medium">
                    {copy.discountTypes[coupon.discountType]} / {formatMoney(coupon.discountValue, locale)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{copy.segment}</span>
                  <span className="font-medium">{coupon.segmentKey ? copy.segments[coupon.segmentKey] ?? coupon.segmentKey : copy.noSegment}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{copy.usageLimit}</span>
                  <span className="font-medium">
                    {formatCount(coupon.usedCount, locale)} / {coupon.usageLimit ? formatCount(coupon.usageLimit, locale) : copy.unlimited}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString(locale) : "-"} / {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString(locale) : "-"}
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
