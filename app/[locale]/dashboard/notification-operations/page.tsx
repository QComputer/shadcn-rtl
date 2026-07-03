"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock3,
  MessageSquare,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react"
import { toast } from "react-toastify"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Locale = "fa" | "en" | "ar"
type DeliveryStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED"
type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"

type Person = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  email?: string | null
  phone?: string | null
}

type InAppDelivery = {
  id: string
  context: string
  type: string | null
  seen: boolean
  readAt: string | null
  createdAt: string
  targetUser: Person
  createdBy: Person | null
}

type WebPushDelivery = {
  id: string
  title: string
  body: string
  provider: string
  dryRun: boolean
  status: DeliveryStatus
  error: string | null
  sentAt: string | null
  createdAt: string
  customer: Person
  actor: Person | null
}

type SmsDelivery = {
  id: string
  phoneMasked: string
  purpose: string
  message: string
  provider: string
  dryRun: boolean
  status: DeliveryStatus
  providerStatus: number | null
  providerMessage: string | null
  error: string | null
  sentAt: string | null
  createdAt: string
  customer: Person
  actor: Person | null
}

type DeliveryAttempt = {
  id: string
  channel: string
  purpose: string
  status: string
  dryRun: boolean
  retryable: boolean
  retryCount: number
  nextRetryAt: string | null
  lastErrorText: string | null
  createdAt: string
  targetUserId: string | null
}

type NotificationOperationsDashboard = {
  config: {
    webPush: {
      provider: string
      dryRun: boolean
      publicKeyConfigured: boolean
      privateKeyConfigured: boolean
      subjectConfigured: boolean
      configured: boolean
      realSendEnabled: boolean
    }
    sms: {
      provider: string
      dryRun: boolean
      apiKeyConfigured: boolean
      lineNumberConfigured: boolean
      verifyTemplateConfigured: boolean
      configured: boolean
      realSendEnabled: boolean
    }
  }
  stats: {
    inApp: {
      total: number
      unread: number
      read: number
    }
    webPush: Record<DeliveryStatus, number>
    sms: Record<DeliveryStatus, number>
  }
  recent: {
    inApp: InAppDelivery[]
    webPush: WebPushDelivery[]
    sms: SmsDelivery[]
    attempts: DeliveryAttempt[]
  }
}

const copy = {
  fa: {
    title: "پایش اعلان‌ها",
    subtitle: "وضعیت عملیاتی اعلان‌های درون‌برنامه‌ای، وب‌پوش و پیامک",
    refresh: "به‌روزرسانی",
    loading: "در حال بارگذاری وضعیت اعلان‌ها...",
    error: "بارگذاری پایش اعلان‌ها ناموفق بود",
    empty: "هنوز رکوردی ثبت نشده است.",
    provider: "ارائه‌دهنده",
    dryRun: "آزمایشی",
    live: "ارسال واقعی",
    configured: "آماده",
    missingConfig: "نیازمند تنظیمات",
    inApp: "درون‌برنامه‌ای",
    webPush: "وب‌پوش",
    sms: "پیامک",
    total: "کل",
    unread: "خوانده‌نشده",
    sent: "ارسال‌شده",
    failed: "ناموفق",
    skipped: "نادیده‌گرفته‌شده",
    pending: "در انتظار",
    recentInApp: "آخرین اعلان‌های درون‌برنامه‌ای",
    recentWebPush: "آخرین ارسال‌های وب‌پوش",
    recentSms: "آخرین ارسال‌های پیامک",
    recentAttempts: "آخرین تلاش‌های ارسال اعلان",
    recipient: "گیرنده",
    actor: "اقدام‌کننده",
    system: "سیستم",
    status: "وضعیت",
    createdAt: "زمان ثبت",
    sentAt: "زمان ارسال",
    retryable: "قابل تلاش مجدد",
    retryCount: "تعداد تلاش مجدد",
    nextRetry: "تلاش بعدی",
    targetType: "نوع گیرنده",
    customer: "مشتری",
    staff: "پرسنل",
    guest: "مهمان",
    details: "جزئیات",
    copied: "وضعیت تازه شد",
  },
  en: {
    title: "Notification ops",
    subtitle: "Operational visibility for in-app, web push, and SMS delivery",
    refresh: "Refresh",
    loading: "Loading notification operations...",
    error: "Failed to load notification operations",
    empty: "No records yet.",
    provider: "Provider",
    dryRun: "Dry run",
    live: "Live send",
    configured: "Ready",
    missingConfig: "Needs config",
    inApp: "In-app",
    webPush: "Web Push",
    sms: "SMS",
    total: "Total",
    unread: "Unread",
    sent: "Sent",
    failed: "Failed",
    skipped: "Skipped",
    pending: "Pending",
    recentInApp: "Recent in-app notifications",
    recentWebPush: "Recent web push deliveries",
    recentSms: "Recent SMS deliveries",
    recentAttempts: "Recent notification delivery attempts",
    recipient: "Recipient",
    actor: "Actor",
    system: "System",
    status: "Status",
    createdAt: "Created",
    sentAt: "Sent",
    retryable: "Retryable",
    retryCount: "Retry count",
    nextRetry: "Next retry",
    targetType: "Target type",
    customer: "Customer",
    staff: "Staff",
    guest: "Guest",
    details: "Details",
    copied: "Status refreshed",
  },
  ar: {
    title: "مراقبة الإشعارات",
    subtitle: "رؤية تشغيلية لإشعارات التطبيق والويب بوش والرسائل النصية",
    refresh: "تحديث",
    loading: "جار تحميل مراقبة الإشعارات...",
    error: "تعذر تحميل مراقبة الإشعارات",
    empty: "لا توجد سجلات بعد.",
    provider: "المزوّد",
    dryRun: "تجريبي",
    live: "إرسال فعلي",
    configured: "جاهز",
    missingConfig: "يحتاج إعدادات",
    inApp: "داخل التطبيق",
    webPush: "ويب بوش",
    sms: "رسائل نصية",
    total: "الإجمالي",
    unread: "غير مقروء",
    sent: "مرسل",
    failed: "فشل",
    skipped: "متجاوز",
    pending: "معلّق",
    recentInApp: "أحدث إشعارات التطبيق",
    recentWebPush: "أحدث إرسال ويب بوش",
    recentSms: "أحدث إرسال رسائل نصية",
    recentAttempts: "أحدث محاولات إرسال الإشعارات",
    recipient: "المستلم",
    actor: "المنفذ",
    system: "النظام",
    status: "الحالة",
    createdAt: "وقت الإنشاء",
    sentAt: "وقت الإرسال",
    retryable: "قابل لإعادة المحاولة",
    retryCount: "عدد المحاولات",
    nextRetry: "المحاولة التالية",
    targetType: "نوع المستلم",
    customer: "عميل",
    staff: "موظف",
    guest: "ضيف",
    details: "التفاصيل",
    copied: "تم تحديث الحالة",
  },
} satisfies Record<Locale, Record<string, string>>

const statusCopy: Record<string, { labelKey: string; variant: BadgeVariant; icon: typeof CheckCircle2 }> = {
  PENDING: { labelKey: "pending", variant: "secondary", icon: Clock3 },
  SENT: { labelKey: "sent", variant: "default", icon: CheckCircle2 },
  FAILED: { labelKey: "failed", variant: "destructive", icon: XCircle },
  SKIPPED: { labelKey: "skipped", variant: "outline", icon: AlertTriangle },
  DRY_RUN: { labelKey: "dryRun", variant: "secondary", icon: Clock3 },
  QUEUED: { labelKey: "queued", variant: "secondary", icon: Clock3 },
  RETRY_SCHEDULED: { labelKey: "retryScheduled", variant: "outline", icon: Clock3 },
  RETRY_EXHAUSTED: { labelKey: "retryExhausted", variant: "destructive", icon: XCircle },
}

function asLocale(value: string): Locale {
  return value === "en" || value === "ar" ? value : "fa"
}

function personName(person: Person | null | undefined, fallback: string) {
  if (!person) return fallback
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || person.name || person.email || person.phone || fallback
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Bell
  label: string
  value: number | string
  tone?: "neutral" | "ok" | "warn" | "danger"
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md",
            tone === "ok" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
            tone === "warn" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            tone === "danger" && "bg-destructive/10 text-destructive",
            tone === "neutral" && "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ProviderPanel({
  title,
  provider,
  dryRun,
  configured,
  realSendEnabled,
  checks,
  locale,
}: {
  title: string
  provider: string
  dryRun: boolean
  configured: boolean
  realSendEnabled: boolean
  checks: Array<{ label: string; ok: boolean }>
  locale: Locale
}) {
  const t = copy[locale]
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {t.provider}: <span className="font-mono">{provider}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={dryRun ? "secondary" : "default"}>{dryRun ? t.dryRun : t.live}</Badge>
          <Badge variant={configured ? "outline" : "destructive"}>{configured ? t.configured : t.missingConfig}</Badge>
          {realSendEnabled ? <Badge variant="default">{t.live}</Badge> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{check.label}</span>
            {check.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function StatusBadge({ status, locale }: { status: DeliveryStatus; locale: Locale }) {
  const state = statusCopy[status]
  const Icon = state.icon
  return (
    <Badge variant={state.variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {copy[locale][state.labelKey]}
    </Badge>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>
}

export default function NotificationOperationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = asLocale(resolvedParams.locale)
  const t = copy[locale]
  const [dashboard, setDashboard] = useState<NotificationOperationsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  )

  const formatDate = useCallback(
    (value: string | null) => {
      if (!value) return "-"
      return dateFormatter.format(new Date(value))
    },
    [dateFormatter],
  )

  const loadDashboard = useCallback(
    async (showToast = false) => {
      setError(null)
      setRefreshing(true)
      try {
        const response = await fetch("/api/dashboard/notification-operations", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || t.error)
        setDashboard(payload as NotificationOperationsDashboard)
        if (showToast) toast.success(t.copied, { position: "top-center" })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t.error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t.copied, t.error],
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadDashboard(false)
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadDashboard])

  if (loading) {
    return (
      <div className="space-y-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-3 md:grid-cols-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir={locale === "fa" || locale === "ar" ? "rtl" : "ltr"}>
      <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-2xl font-semibold tracking-normal">{t.title}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadDashboard(true)} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
          {t.refresh}
        </Button>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      ) : null}

      {dashboard ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={Bell} label={`${t.inApp} - ${t.total}`} value={dashboard.stats.inApp.total} />
            <StatTile icon={AlertTriangle} label={`${t.inApp} - ${t.unread}`} value={dashboard.stats.inApp.unread} tone="warn" />
            <StatTile icon={Send} label={`${t.webPush} - ${t.sent}`} value={dashboard.stats.webPush.SENT} tone="ok" />
            <StatTile icon={MessageSquare} label={`${t.sms} - ${t.sent}`} value={dashboard.stats.sms.SENT} tone="ok" />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ProviderPanel
              title={t.webPush}
              provider={dashboard.config.webPush.provider}
              dryRun={dashboard.config.webPush.dryRun}
              configured={dashboard.config.webPush.configured}
              realSendEnabled={dashboard.config.webPush.realSendEnabled}
              locale={locale}
              checks={[
                { label: "VAPID public key", ok: dashboard.config.webPush.publicKeyConfigured },
                { label: "VAPID private key", ok: dashboard.config.webPush.privateKeyConfigured },
                { label: "VAPID subject", ok: dashboard.config.webPush.subjectConfigured },
              ]}
            />
            <ProviderPanel
              title={t.sms}
              provider={dashboard.config.sms.provider}
              dryRun={dashboard.config.sms.dryRun}
              configured={dashboard.config.sms.configured}
              realSendEnabled={dashboard.config.sms.realSendEnabled}
              locale={locale}
              checks={[
                { label: "SMS.ir API key", ok: dashboard.config.sms.apiKeyConfigured },
                { label: "SMS.ir line", ok: dashboard.config.sms.lineNumberConfigured },
                { label: "Verify template", ok: dashboard.config.sms.verifyTemplateConfigured },
              ]}
            />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile icon={Clock3} label={`${t.webPush} - ${t.pending}`} value={dashboard.stats.webPush.PENDING} />
            <StatTile icon={XCircle} label={`${t.webPush} - ${t.failed}`} value={dashboard.stats.webPush.FAILED} tone="danger" />
            <StatTile icon={Clock3} label={`${t.sms} - ${t.pending}`} value={dashboard.stats.sms.PENDING} />
            <StatTile icon={XCircle} label={`${t.sms} - ${t.failed}`} value={dashboard.stats.sms.FAILED} tone="danger" />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t.recentWebPush}</h2>
            {dashboard.recent.webPush.length === 0 ? (
              <EmptyState text={t.empty} />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="divide-y">
                  {dashboard.recent.webPush.map((delivery) => (
                    <article key={delivery.id} className="grid gap-3 p-4 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{delivery.title}</p>
                          <StatusBadge status={delivery.status} locale={locale} />
                          {delivery.dryRun ? <Badge variant="secondary">{t.dryRun}</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{delivery.error || delivery.body}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>{t.recipient}: {personName(delivery.customer, "-")}</p>
                        <p>{t.actor}: {personName(delivery.actor, t.system)}</p>
                      </div>
                      <div className="text-sm text-muted-foreground md:text-end">
                        <p>{t.createdAt}: {formatDate(delivery.createdAt)}</p>
                        <p>{t.sentAt}: {formatDate(delivery.sentAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t.recentSms}</h2>
            {dashboard.recent.sms.length === 0 ? (
              <EmptyState text={t.empty} />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="divide-y">
                  {dashboard.recent.sms.map((delivery) => (
                    <article key={delivery.id} className="grid gap-3 p-4 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{delivery.purpose}</p>
                          <StatusBadge status={delivery.status} locale={locale} />
                          {delivery.dryRun ? <Badge variant="secondary">{t.dryRun}</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {delivery.error || delivery.providerMessage || delivery.message}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>{t.recipient}: {personName(delivery.customer, delivery.phoneMasked)}</p>
                        <p>{t.details}: {delivery.phoneMasked}</p>
                      </div>
                      <div className="text-sm text-muted-foreground md:text-end">
                        <p>{t.createdAt}: {formatDate(delivery.createdAt)}</p>
                        <p>{t.sentAt}: {formatDate(delivery.sentAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t.recentInApp}</h2>
            {dashboard.recent.inApp.length === 0 ? (
              <EmptyState text={t.empty} />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="divide-y">
                  {dashboard.recent.inApp.map((notification) => (
                    <article key={notification.id} className="grid gap-3 p-4 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{notification.type || t.inApp}</p>
                          <Badge variant={notification.seen ? "outline" : "secondary"}>
                            {notification.seen ? t.sent : t.unread}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.context}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>{t.recipient}: {personName(notification.targetUser, "-")}</p>
                        <p>{t.actor}: {personName(notification.createdBy, t.system)}</p>
                      </div>
                      <div className="text-sm text-muted-foreground md:text-end">
                        <p>{t.createdAt}: {formatDate(notification.createdAt)}</p>
                        <p>{t.sentAt}: {formatDate(notification.readAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t.recentAttempts}</h2>
            {!dashboard.recent.attempts || dashboard.recent.attempts.length === 0 ? (
              <EmptyState text={t.empty} />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="divide-y">
                  {dashboard.recent.attempts.map((attempt) => (
                    <article key={attempt.id} className="grid gap-3 p-4 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{attempt.purpose}</p>
                          <StatusBadge status={attempt.status as DeliveryStatus} locale={locale} />
                          <Badge variant="outline">{attempt.channel}</Badge>
                          {attempt.dryRun ? <Badge variant="secondary">{t.dryRun}</Badge> : null}
                          {attempt.retryable ? <Badge variant="outline">{t.retryable}</Badge> : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {attempt.lastErrorText || `تعداد تلاش مجدد: ${attempt.retryCount}`}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>{t.recipient}: {attempt.targetUserId || "-"}</p>
                        <p>{t.retryCount}: {attempt.retryCount}</p>
                      </div>
                      <div className="text-sm text-muted-foreground md:text-end">
                        <p>{t.createdAt}: {formatDate(attempt.createdAt)}</p>
                        <p>{t.nextRetry}: {formatDate(attempt.nextRetryAt)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <EmptyState text={t.empty} />
      )}
    </div>
  )
}
