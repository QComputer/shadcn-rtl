"use client"

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Coins, Gift, Plus, Receipt, RefreshCw, Save, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type LoyaltyRule = {
  id: string
  name: string
  spendAmount: string | number
  pointsAwarded: number
  pointsPerOrder: number
  minOrderTotal: string | number
  isActive: boolean
  startsAt?: string | null
  expiresAt?: string | null
}

type LedgerEntry = {
  id: string
  type: "EARN" | "REDEEM" | "ADJUST" | "EXPIRE" | "REFUND"
  points: number
  reason?: string | null
  createdAt: string
  customer?: CustomerSummary | null
  order?: {
    id: string
    orderNumber: string
    total: string | number
  } | null
}

type CustomerSummary = {
  id: string
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}

type LoyaltyBalance = {
  customerId: string
  points: number
  customer?: CustomerSummary | null
}

type LoyaltyResponse = {
  rules: LoyaltyRule[]
  recentLedger: LedgerEntry[]
  balances: LoyaltyBalance[]
  activeMembers: number
  totalOutstandingPoints: number
}

type LoyaltyCopy = {
  title: string
  subtitle: string
  refresh: string
  loading: string
  emptyRules: string
  emptyLedger: string
  emptyBalances: string
  errorTitle: string
  outstandingPoints: string
  activeMembers: string
  rules: string
  balances: string
  ledger: string
  createRule: string
  ruleName: string
  spendAmount: string
  pointsAwarded: string
  pointsPerOrder: string
  minOrderTotal: string
  saveRule: string
  awardPurchase: string
  orderId: string
  award: string
  manualAdjustment: string
  customerId: string
  points: string
  reason: string
  addAdjustment: string
  coupons: string
  noOrganization: string
  success: string
  appendOnlyNote: string
  types: Record<LedgerEntry["type"], string>
}

const defaultCopy: LoyaltyCopy = {
  title: "Loyalty",
  subtitle: "Manage append-only points for Customer Club purchases and adjustments.",
  refresh: "Refresh",
  loading: "Loading loyalty...",
  emptyRules: "No loyalty rules yet",
  emptyLedger: "No ledger entries yet",
  emptyBalances: "No point balances yet",
  errorTitle: "Loyalty could not be loaded",
  outstandingPoints: "Outstanding points",
  activeMembers: "Active members",
  rules: "Rules",
  balances: "Balances",
  ledger: "Ledger",
  createRule: "Create purchase rule",
  ruleName: "Rule name",
  spendAmount: "Spend amount",
  pointsAwarded: "Points awarded",
  pointsPerOrder: "Points per order",
  minOrderTotal: "Minimum order total",
  saveRule: "Save rule",
  awardPurchase: "Award purchase points",
  orderId: "Order ID",
  award: "Award",
  manualAdjustment: "Manual adjustment",
  customerId: "Customer ID",
  points: "Points",
  reason: "Reason",
  addAdjustment: "Add adjustment",
  coupons: "Coupons",
  noOrganization: "An active management membership is required to manage loyalty.",
  success: "Saved",
  appendOnlyNote: "Point balances are calculated from ledger rows. Existing ledger rows are never edited.",
  types: {
    EARN: "Earn",
    REDEEM: "Redeem",
    ADJUST: "Adjust",
    EXPIRE: "Expire",
    REFUND: "Refund",
  },
}

function formatCount(value: number, locale: string) {
  return locale === "fa" || locale === "ar" ? toPersianDigits(value.toString()) : value.toString()
}

function formatMoney(value: string | number | null | undefined, locale: string) {
  const numeric = Number(value ?? 0)
  const formatted = Number.isFinite(numeric) ? numeric.toLocaleString(locale) : "0"
  return locale === "fa" || locale === "ar" ? toPersianDigits(formatted) : formatted
}

function getDisplayName(customer?: CustomerSummary | null) {
  if (!customer) return "Customer"
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.name || customer.email || customer.phone || "Customer"
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

export default function LoyaltyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const [copy, setCopy] = useState<LoyaltyCopy>(defaultCopy)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [data, setData] = useState<LoyaltyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [ruleName, setRuleName] = useState("Default purchase earn")
  const [spendAmount, setSpendAmount] = useState("100000")
  const [pointsAwarded, setPointsAwarded] = useState("1")
  const [pointsPerOrder, setPointsPerOrder] = useState("0")
  const [minOrderTotal, setMinOrderTotal] = useState("0")
  const [awardOrderId, setAwardOrderId] = useState("")
  const [adjustmentCustomerId, setAdjustmentCustomerId] = useState("")
  const [adjustmentPoints, setAdjustmentPoints] = useState("0")
  const [adjustmentReason, setAdjustmentReason] = useState("Manual adjustment")

  useEffect(() => {
    const dict = getDictionary(locale)
    const loyaltyCopy = dict.loyaltyCoupons
    setCopy(loyaltyCopy && typeof loyaltyCopy === "object" ? (loyaltyCopy as LoyaltyCopy) : defaultCopy)
  }, [locale])

  const fetchLoyalty = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    const membershipResponse = await fetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!membershipResponse.ok) throw new Error(await readError(membershipResponse, "Failed to load organization membership"))

    const membershipData = await membershipResponse.json()
    const orgId = membershipData?.membership?.organizationId
    if (!orgId) throw new Error(copy.noOrganization)

    const response = await fetch(`/api/dashboard/customer-club/loyalty?organizationId=${encodeURIComponent(orgId)}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) throw new Error(await readError(response, "Failed to load loyalty"))

    setOrganizationId(orgId)
    setData(await response.json())
  }, [copy.noOrganization])

  useEffect(() => {
    const controller = new AbortController()
    fetchLoyalty(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [copy.errorTitle, fetchLoyalty])

  const activeRules = useMemo(() => data?.rules.filter((rule) => rule.isActive).length ?? 0, [data?.rules])

  const refresh = async () => {
    setBusy(true)
    try {
      await fetchLoyalty()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  const postAction = async (body: Record<string, unknown>) => {
    if (!organizationId) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch("/api/dashboard/customer-club/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, ...body }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.errorTitle))
      setNotice(copy.success)
      await fetchLoyalty()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  const createRule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void postAction({
      action: "createRule",
      name: ruleName,
      spendAmount: Number(spendAmount),
      pointsAwarded: Number(pointsAwarded),
      pointsPerOrder: Number(pointsPerOrder),
      minOrderTotal: Number(minOrderTotal),
      isActive: true,
    })
  }

  const awardPurchase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void postAction({ action: "awardPurchase", orderId: awardOrderId })
  }

  const addAdjustment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void postAction({
      action: "manualAdjust",
      customerId: adjustmentCustomerId,
      points: Number(adjustmentPoints),
      reason: adjustmentReason,
    })
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
          <Link href={`/${locale}/dashboard/customer-club/coupons`} className={buttonVariants({ variant: "outline" })}>
            <Gift className="h-4 w-4" aria-hidden="true" />
            {copy.coupons}
          </Link>
          <Button variant="outline" onClick={refresh} disabled={busy}>
            <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {copy.refresh}
          </Button>
        </div>
      </div>

      <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{copy.appendOnlyNote}</p>

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
            <CardTitle className="text-sm font-medium">{copy.outstandingPoints}</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(data?.totalOutstandingPoints ?? 0, locale)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.activeMembers}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(data?.activeMembers ?? 0, locale)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{copy.rules}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCount(activeRules, locale)}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">{copy.createRule}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={createRule}>
              <Input value={ruleName} onChange={(event) => setRuleName(event.target.value)} placeholder={copy.ruleName} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input type="number" min="1" value={spendAmount} onChange={(event) => setSpendAmount(event.target.value)} placeholder={copy.spendAmount} />
                <Input type="number" min="1" value={pointsAwarded} onChange={(event) => setPointsAwarded(event.target.value)} placeholder={copy.pointsAwarded} />
                <Input type="number" min="0" value={pointsPerOrder} onChange={(event) => setPointsPerOrder(event.target.value)} placeholder={copy.pointsPerOrder} />
                <Input type="number" min="0" value={minOrderTotal} onChange={(event) => setMinOrderTotal(event.target.value)} placeholder={copy.minOrderTotal} />
              </div>
              <Button type="submit" disabled={busy || !organizationId}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {copy.saveRule}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{copy.awardPurchase}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={awardPurchase}>
              <Input value={awardOrderId} onChange={(event) => setAwardOrderId(event.target.value)} placeholder={copy.orderId} />
              <Button type="submit" disabled={busy || !organizationId || !awardOrderId.trim()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {copy.award}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{copy.manualAdjustment}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={addAdjustment}>
              <Input value={adjustmentCustomerId} onChange={(event) => setAdjustmentCustomerId(event.target.value)} placeholder={copy.customerId} />
              <Input type="number" value={adjustmentPoints} onChange={(event) => setAdjustmentPoints(event.target.value)} placeholder={copy.points} />
              <Input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder={copy.reason} />
              <Button type="submit" disabled={busy || !organizationId || !adjustmentCustomerId.trim() || Number(adjustmentPoints) === 0}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                {copy.addAdjustment}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">{copy.rules}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data?.rules.length ? data.rules.map((rule) => (
              <div key={rule.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{rule.name}</p>
                  <Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "Active" : "Paused"}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {formatCount(rule.pointsAwarded, locale)} / {formatMoney(rule.spendAmount, locale)}
                </p>
              </div>
            )) : <p className="text-sm text-muted-foreground">{copy.emptyRules}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{copy.balances}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data?.balances.length ? data.balances.map((balance) => (
              <div key={balance.customerId} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{getDisplayName(balance.customer)}</p>
                  <p className="truncate text-xs text-muted-foreground">{balance.customer?.email || balance.customer?.phone || balance.customerId}</p>
                </div>
                <Badge>{formatCount(balance.points, locale)}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">{copy.emptyBalances}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{copy.ledger}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data?.recentLedger.length ? data.recentLedger.map((entry) => (
              <div key={entry.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{getDisplayName(entry.customer)}</p>
                  <Badge variant={entry.points >= 0 ? "default" : "secondary"}>
                    {formatCount(entry.points, locale)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.types[entry.type] ?? entry.type} / {entry.order?.orderNumber ?? entry.reason ?? "-"} / {new Date(entry.createdAt).toLocaleDateString(locale)}
                </p>
              </div>
            )) : <p className="text-sm text-muted-foreground">{copy.emptyLedger}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
