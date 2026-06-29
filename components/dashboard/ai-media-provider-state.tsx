"use client"

import { AlertTriangle, CheckCircle2, Clock, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toPersianDigits } from "@/lib/persian"

export type AiMediaSellerState = "loading" | "disabled" | "mock" | "approved" | "budget-exhausted" | "rollback-paused"

export type AiMediaStatusResponse = {
  enabled?: boolean
  ready?: boolean
  paidProvider?: {
    enabled?: boolean
    rollback?: {
      paused?: boolean
    }
  } | null
}

export type AiMediaUsageSummary = {
  dailyJobLimit?: number
  remainingDailyJobs?: number
  paidGenerationEnabled?: boolean
  costTelemetry?: {
    remainingDailyCostCents?: number | null
    remainingMonthlyBudgetCents?: number | null
    rollbackPaused?: boolean
  } | null
} | null

export function getAiMediaSellerState(
  status: AiMediaStatusResponse | null,
  usage: AiMediaUsageSummary,
  loading = false,
): AiMediaSellerState {
  if (loading) return "loading"

  const rollbackPaused = Boolean(status?.paidProvider?.rollback?.paused || usage?.costTelemetry?.rollbackPaused)
  if (rollbackPaused) return "rollback-paused"

  const dailyJobsExhausted = typeof usage?.remainingDailyJobs === "number" && usage.remainingDailyJobs <= 0
  const dailyCostExhausted = typeof usage?.costTelemetry?.remainingDailyCostCents === "number" && usage.costTelemetry.remainingDailyCostCents <= 0
  const monthlyBudgetExhausted = typeof usage?.costTelemetry?.remainingMonthlyBudgetCents === "number" && usage.costTelemetry.remainingMonthlyBudgetCents <= 0
  if (dailyJobsExhausted || dailyCostExhausted || monthlyBudgetExhausted) return "budget-exhausted"

  if (status?.paidProvider?.enabled || usage?.paidGenerationEnabled) return "approved"
  if (status?.enabled || status?.ready) return "mock"

  return "disabled"
}

export function canCreateAiMediaJob(state: AiMediaSellerState) {
  return state === "mock" || state === "approved"
}

const stateCopy: Record<AiMediaSellerState, { title: string; body: string; badge: string; tone: string }> = {
  loading: {
    title: "در حال بررسی وضعیت تصویر AI",
    body: "وضعیت سرویس و سهمیه امروز در حال دریافت است.",
    badge: "در حال بررسی",
    tone: "border-muted bg-muted/30 text-muted-foreground",
  },
  disabled: {
    title: "پیشنهاد تصویر AI غیرفعال است",
    body: "در حال حاضر امکان ساخت تصویر پیشنهادی برای محصولات فعال نیست.",
    badge: "غیرفعال",
    tone: "border-muted bg-muted/30 text-muted-foreground",
  },
  mock: {
    title: "پیشنهاد تصویر AI در حالت آزمایشی آماده است",
    body: "می‌توانید بدون هزینه واقعی، جریان ساخت و انتخاب تصویر محصول را بررسی کنید.",
    badge: "آزمایشی",
    tone: "border-sky-200 bg-sky-50 text-sky-900",
  },
  approved: {
    title: "تولید تصویر حرفه‌ای فعال است",
    body: "ساخت تصویر محصول برای فروشگاه شما آماده است و با سهمیه‌های روزانه کنترل می‌شود.",
    badge: "فعال",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  "budget-exhausted": {
    title: "سهمیه تولید تصویر به پایان رسیده است",
    body: "برای امروز یا بودجه دوره‌ای، امکان ایجاد درخواست تازه باقی نمانده است.",
    badge: "سهمیه تمام شد",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  "rollback-paused": {
    title: "تولید تصویر موقتاً متوقف شده است",
    body: "برای اطمینان از کیفیت یا هزینه، ایجاد درخواست تازه فعلاً متوقف شده است.",
    badge: "متوقف",
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
  },
}

function StateIcon({ state }: { state: AiMediaSellerState }) {
  if (state === "approved") return <CheckCircle2 className="h-4 w-4" />
  if (state === "mock") return <Sparkles className="h-4 w-4" />
  if (state === "loading") return <Clock className="h-4 w-4" />
  return <AlertTriangle className="h-4 w-4" />
}

export function AiMediaProviderState({
  status,
  usage,
  loading = false,
  locale = "fa",
  productSaved = true,
}: {
  status: AiMediaStatusResponse | null
  usage: AiMediaUsageSummary
  loading?: boolean
  locale?: string
  productSaved?: boolean
}) {
  const state = getAiMediaSellerState(status, usage, loading)
  const copy = stateCopy[state]
  const remaining = typeof usage?.remainingDailyJobs === "number" ? usage.remainingDailyJobs : null
  const limit = typeof usage?.dailyJobLimit === "number" ? usage.dailyJobLimit : null
  const quotaText = remaining !== null && limit !== null
    ? `باقی‌مانده امروز: ${toPersianDigits(remaining)} از ${toPersianDigits(limit)} درخواست`
    : null

  return (
    <div className={`rounded-md border p-3 text-sm ${copy.tone}`} dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <StateIcon state={state} />
          <span>{copy.title}</span>
        </div>
        <Badge variant={state === "rollback-paused" || state === "budget-exhausted" ? "destructive" : "secondary"}>
          {copy.badge}
        </Badge>
      </div>
      <p className="mt-2 text-xs opacity-90">{copy.body}</p>
      {!productSaved && (
        <p className="mt-2 text-xs opacity-90">پس از ذخیره محصول، ساخت تصویر از صفحه ویرایش فعال می‌شود.</p>
      )}
      {quotaText && <p className="mt-2 text-xs font-medium">{quotaText}</p>}
    </div>
  )
}
