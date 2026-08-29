"use client"
import { appFetch } from "@/lib/app-base-path";

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Bell, CheckCheck, RefreshCw, Send, Undo2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { getDictionary } from "@/lib/dictionary"
import { toPersianDigits } from "@/lib/persian"

type NotificationItem = {
  id: string
  context?: string | null
  type?: string | null
  seen: boolean
  readAt?: string | null
  createdAt: string
  organization?: {
    id: string
    name: string
    slug: string
  } | null
}

type Membership = {
  organizationId: string
  organizationName: string
  role: string
} | null

type InboxCopy = {
  title: string
  subtitle: string
  inbox: string
  unread: string
  read: string
  markRead: string
  markUnread: string
  refresh: string
  loading: string
  emptyTitle: string
  emptyDescription: string
  errorTitle: string
  sendTitle: string
  sendDescription: string
  message: string
  messagePlaceholder: string
  dryRun: string
  send: string
  sending: string
  sent: string
  recipients: string
  noOrganization: string
  inAppOnly: string
}

const fallbackCopy: Record<string, InboxCopy> = {
  fa: {
    title: "اعلان‌ها",
    subtitle: "پیام‌های داخل برنامه و اعلان‌های باشگاه مشتریان را ببینید.",
    inbox: "صندوق اعلان‌ها",
    unread: "خوانده‌نشده",
    read: "خوانده‌شده",
    markRead: "خواندن",
    markUnread: "خوانده‌نشده",
    refresh: "تازه‌سازی",
    loading: "در حال بارگذاری اعلان‌ها...",
    emptyTitle: "اعلانی وجود ندارد",
    emptyDescription: "پیام‌های داخل برنامه اینجا نمایش داده می‌شوند.",
    errorTitle: "بارگذاری اعلان‌ها ناموفق بود",
    sendTitle: "ارسال اعلان داخل برنامه",
    sendDescription: "برای اعضای فعال باشگاه مشتریان همین سازمان اعلان داخل برنامه بسازید.",
    message: "متن پیام",
    messagePlaceholder: "متن اعلان را بنویسید...",
    dryRun: "پیش‌نمایش تعداد گیرندگان",
    send: "ارسال داخل برنامه",
    sending: "در حال ارسال...",
    sent: "اعلان ثبت شد",
    recipients: "گیرنده",
    noOrganization: "برای ارسال اعلان، عضویت مدیریتی فعال لازم است.",
    inAppOnly: "این فاز فقط اعلان داخل برنامه می‌سازد و پیام خارجی ارسال نمی‌کند.",
  },
  en: {
    title: "Notifications",
    subtitle: "Read in-app messages and customer club notifications.",
    inbox: "Notification inbox",
    unread: "Unread",
    read: "Read",
    markRead: "Mark read",
    markUnread: "Mark unread",
    refresh: "Refresh",
    loading: "Loading notifications...",
    emptyTitle: "No notifications",
    emptyDescription: "In-app messages will appear here.",
    errorTitle: "Notifications could not be loaded",
    sendTitle: "Send in-app notification",
    sendDescription: "Create an in-app notification for active customer club members in this organization.",
    message: "Message",
    messagePlaceholder: "Write the notification message...",
    dryRun: "Preview recipients",
    send: "Send in app",
    sending: "Sending...",
    sent: "Notification created",
    recipients: "recipients",
    noOrganization: "An active management membership is required to send notifications.",
    inAppOnly: "This phase only creates in-app notifications and does not send external messages.",
  },
  ar: {
    title: "الإشعارات",
    subtitle: "اقرأ الرسائل داخل التطبيق وإشعارات نادي العملاء.",
    inbox: "صندوق الإشعارات",
    unread: "غير مقروء",
    read: "مقروء",
    markRead: "تحديد كمقروء",
    markUnread: "تحديد كغير مقروء",
    refresh: "تحديث",
    loading: "جار تحميل الإشعارات...",
    emptyTitle: "لا توجد إشعارات",
    emptyDescription: "ستظهر الرسائل داخل التطبيق هنا.",
    errorTitle: "تعذر تحميل الإشعارات",
    sendTitle: "إرسال إشعار داخل التطبيق",
    sendDescription: "إنشاء إشعار داخل التطبيق لأعضاء نادي العملاء النشطين في هذه المؤسسة.",
    message: "نص الرسالة",
    messagePlaceholder: "اكتب نص الإشعار...",
    dryRun: "معاينة عدد المستلمين",
    send: "إرسال داخل التطبيق",
    sending: "جار الإرسال...",
    sent: "تم إنشاء الإشعار",
    recipients: "مستلم",
    noOrganization: "يلزم وجود عضوية إدارية نشطة لإرسال الإشعارات.",
    inAppOnly: "هذه المرحلة تنشئ إشعارات داخل التطبيق فقط ولا ترسل رسائل خارجية.",
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

export default function DashboardNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const [copy, setCopy] = useState<InboxCopy>(fallbackCopy[locale] ?? fallbackCopy.fa)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [membership, setMembership] = useState<Membership>(null)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dict = getDictionary(locale)
    const inboxCopy = dict.notificationInbox
    setCopy(inboxCopy && typeof inboxCopy === "object" ? (inboxCopy as InboxCopy) : fallbackCopy[locale] ?? fallbackCopy.fa)
  }, [locale])

  const canSend = membership?.role === "ADMIN" || membership?.role === "MANAGER"

  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    setError(null)
    const [notificationResponse, membershipResponse] = await Promise.all([
      appFetch("/api/dashboard/notifications?scope=all&limit=100", { cache: "no-store", signal }),
      appFetch("/api/users/me/membership", { cache: "no-store", signal }).catch(() => null),
    ])

    if (!notificationResponse.ok) {
      throw new Error(await readError(notificationResponse, "Failed to load notifications"))
    }

    const notificationData = await notificationResponse.json()
    setNotifications(Array.isArray(notificationData?.notifications) ? notificationData.notifications : [])

    if (membershipResponse?.ok) {
      const membershipData = await membershipResponse.json()
      setMembership(membershipData?.membership ?? null)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchNotifications(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : copy.errorTitle)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [copy.errorTitle, fetchNotifications])

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.seen).length, [notifications])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await fetchNotifications()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setRefreshing(false)
    }
  }

  const updateNotification = async (id: string, seen: boolean) => {
    setUpdatingId(id)
    setError(null)
    try {
      const response = await appFetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], seen }),
      })
      if (!response.ok) throw new Error(await readError(response, "Failed to update notification"))
      await fetchNotifications()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setUpdatingId(null)
    }
  }

  const sendNotification = async (dryRun: boolean) => {
    if (!membership?.organizationId || !message.trim()) return
    setSending(true)
    setSendResult(null)
    setError(null)
    try {
      const response = await appFetch("/api/dashboard/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: membership.organizationId,
          message: message.trim(),
          dryRun,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, "Failed to send notification"))
      const data = await response.json()
      setSendResult(`${dryRun ? copy.dryRun : copy.sent}: ${formatCount(data.recipientCount ?? data.created ?? 0, locale)} ${copy.recipients}`)
      if (!dryRun) {
        setMessage("")
        await fetchNotifications()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 lg:p-6">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
        <div className="h-56 rounded-lg bg-muted" />
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
        <Button variant="outline" onClick={refresh} disabled={refreshing || sending}>
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
          {copy.refresh}
        </Button>
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

      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{copy.inbox}</CardTitle>
            <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
              {formatCount(unreadCount, locale)} {copy.unread}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={notification.seen ? "secondary" : "default"}>
                          {notification.seen ? copy.read : copy.unread}
                        </Badge>
                        {notification.type && <Badge variant="outline">{notification.type.replaceAll("_", " ")}</Badge>}
                      </div>
                      <p className="text-sm">{notification.context}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.organization?.name ? `${notification.organization.name} · ` : ""}
                        {new Date(notification.createdAt).toLocaleString(locale)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateNotification(notification.id, !notification.seen)}
                      disabled={updatingId === notification.id}
                    >
                      {notification.seen ? <Undo2 className="h-4 w-4" aria-hidden="true" /> : <CheckCheck className="h-4 w-4" aria-hidden="true" />}
                      {notification.seen ? copy.markUnread : copy.markRead}
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="mt-3 font-medium">{copy.emptyTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">{copy.emptyDescription}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{copy.sendTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{copy.sendDescription}</p>
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{copy.inAppOnly}</p>
            {canSend ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{copy.message}</label>
                  <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={copy.messagePlaceholder} maxLength={500} />
                </div>
                {sendResult && <p className="rounded-md border p-3 text-sm text-muted-foreground">{sendResult}</p>}
                <div className="grid gap-2">
                  <Button type="button" variant="outline" onClick={() => sendNotification(true)} disabled={sending || !message.trim()}>
                    {copy.dryRun}
                  </Button>
                  <Button type="button" onClick={() => sendNotification(false)} disabled={sending || !message.trim()}>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {sending ? copy.sending : copy.send}
                  </Button>
                </div>
              </>
            ) : (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">{copy.noOrganization}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
