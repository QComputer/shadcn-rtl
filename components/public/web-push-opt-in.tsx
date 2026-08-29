"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, BellOff, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { appPath, resolveAppBasePath } from "@/lib/app-base-path"

type NotificationPreference = {
  channel: "IN_APP" | "WEB_PUSH" | "SMS"
  marketingEnabled: boolean
  transactionalEnabled: boolean
}

type PushStatus = {
  config?: {
    publicKey?: string
    publicKeyConfigured?: boolean
    dryRun?: boolean
    provider?: string
    realSendEnabled?: boolean
  }
  active?: boolean
  activeSubscriptionCount?: number
  lastPermissionEvent?: {
    state: string
    reason?: string | null
    createdAt: string
  } | null
  preferences?: NotificationPreference[]
}

type WebPushOptInProps = {
  organizationSlug: string
  organizationName: string
  locale?: string
}

const copy = {
  fa: {
    title: "\u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627",
    description: "\u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627\u06cc \u0645\u0631\u0628\u0648\u0637 \u0628\u0647 \u0627\u06cc\u0646 \u0641\u0631\u0648\u0634\u06af\u0627\u0647 \u0631\u0627 \u0628\u0631\u0627\u06cc \u0647\u0631 \u06a9\u0627\u0646\u0627\u0644 \u0645\u062f\u06cc\u0631\u06cc\u062a \u06a9\u0646\u06cc\u062f.",
    enable: "\u0641\u0639\u0627\u0644\u200c\u0633\u0627\u0632\u06cc",
    unsubscribe: "\u0644\u063a\u0648",
    refresh: "\u0628\u0647\u200c\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc",
    loading: "\u062f\u0631 \u062d\u0627\u0644 \u0628\u0631\u0631\u0633\u06cc \u0648\u0636\u0639\u06cc\u062a...",
    enabled: "\u0627\u0639\u0644\u0627\u0646 \u0645\u0631\u0648\u0631\u06af\u0631 \u0641\u0639\u0627\u0644 \u0627\u0633\u062a.",
    disabled: "\u0627\u0639\u0644\u0627\u0646 \u0645\u0631\u0648\u0631\u06af\u0631 \u0641\u0639\u0627\u0644 \u0646\u06cc\u0633\u062a.",
    preferences: "\u062a\u0631\u062c\u06cc\u062d\u0627\u062a \u067e\u06cc\u0627\u0645\u200c\u0647\u0627\u06cc \u0627\u0637\u0644\u0627\u0639\u200c\u0631\u0633\u0627\u0646\u06cc",
    saved: "\u062a\u0631\u062c\u06cc\u062d\u0627\u062a \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f.",
    unsupportedTitle: "\u0645\u0631\u0648\u0631\u06af\u0631 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0646\u0645\u06cc\u200c\u06a9\u0646\u062f",
    unsupportedDescription: "\u0627\u06cc\u0646 \u0645\u0631\u0648\u0631\u06af\u0631 \u0627\u0639\u0644\u0627\u0646 Web Push \u0631\u0627 \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u0645\u06cc\u200c\u06af\u0630\u0627\u0631\u062f.",
    statusUpdated: "\u0648\u0636\u0639\u06cc\u062a \u0628\u0647\u200c\u0631\u0648\u0632 \u0634\u062f",
    unavailable: "\u0627\u0639\u0644\u0627\u0646 \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u06cc\u0633\u062a",
    pushStatusLoadError: "\u0648\u0636\u0639\u06cc\u062a \u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627 \u0628\u0627\u0631\u06af\u06cc\u0631\u06cc \u0646\u0634\u062f.",
    vapidMissing: "\u06a9\u0644\u06cc\u062f \u0639\u0645\u0648\u0645\u06cc Web Push \u0647\u0646\u0648\u0632 \u062a\u0646\u0638\u06cc\u0645 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.",
    permissionDenied: "\u0627\u062c\u0627\u0632\u0647 \u0646\u0645\u0627\u06cc\u0634 \u0627\u0639\u0644\u0627\u0646 \u062f\u0627\u062f\u0647 \u0646\u0634\u062f.",
    saveError: "\u062a\u0631\u062c\u06cc\u062d\u0627\u062a \u0627\u0639\u0644\u0627\u0646 \u0630\u062e\u06cc\u0631\u0647 \u0646\u0634\u062f.",
    enableError: "\u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627 \u0641\u0639\u0627\u0644 \u0646\u0634\u062f.",
    disableError: "\u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644 \u0646\u0634\u062f.",
    refreshError: "\u0648\u0636\u0639\u06cc\u062a \u0627\u0639\u0644\u0627\u0646\u200c\u0647\u0627 \u0628\u0647\u200c\u0631\u0648\u0632 \u0646\u0634\u062f.",
    unsupportedReason: "\u0645\u0631\u0648\u0631\u06af\u0631 Web Push \u0631\u0627 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0646\u0645\u06cc\u200c\u06a9\u0646\u062f.",
    channels: {
      IN_APP: "\u062f\u0627\u062e\u0644 \u0628\u0631\u0646\u0627\u0645\u0647",
      WEB_PUSH: "\u0645\u0631\u0648\u0631\u06af\u0631",
      SMS: "\u067e\u06cc\u0627\u0645\u06a9",
    },
  },
  en: {
    title: "Notifications",
    description: "Manage notification updates for this shop by channel.",
    enable: "Enable",
    unsubscribe: "Unsubscribe",
    refresh: "Refresh",
    loading: "Checking notification status...",
    enabled: "Browser notifications are enabled.",
    disabled: "Browser notifications are not enabled.",
    preferences: "Marketing message preferences",
    saved: "Preferences saved.",
    unsupportedTitle: "Unsupported browser",
    unsupportedDescription: "This browser does not expose the Web Push APIs.",
    statusUpdated: "Status updated",
    unavailable: "Push unavailable",
    pushStatusLoadError: "Push status could not be loaded.",
    vapidMissing: "Web Push is not configured yet. Add the VAPID public key first.",
    permissionDenied: "Notification permission was not granted.",
    saveError: "Notification preferences could not be saved.",
    enableError: "Push notifications could not be enabled.",
    disableError: "Push notifications could not be disabled.",
    refreshError: "Push status could not be refreshed.",
    unsupportedReason: "Browser does not support Web Push.",
    channels: {
      IN_APP: "In app",
      WEB_PUSH: "Browser",
      SMS: "SMS",
    },
  },
  ar: {
    title: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a",
    description: "\u0623\u062f\u0631 \u062a\u062d\u062f\u064a\u062b\u0627\u062a \u0647\u0630\u0627 \u0627\u0644\u0645\u062a\u062c\u0631 \u062d\u0633\u0628 \u0627\u0644\u0642\u0646\u0627\u0629.",
    enable: "\u062a\u0641\u0639\u064a\u0644",
    unsubscribe: "\u0625\u0644\u063a\u0627\u0621",
    refresh: "\u062a\u062d\u062f\u064a\u062b",
    loading: "\u064a\u062a\u0645 \u0641\u062d\u0635 \u0627\u0644\u062d\u0627\u0644\u0629...",
    enabled: "\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062a\u0635\u0641\u062d \u0645\u0641\u0639\u0644\u0629.",
    disabled: "\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u0645\u062a\u0635\u0641\u062d \u063a\u064a\u0631 \u0645\u0641\u0639\u0644\u0629.",
    preferences: "\u062a\u0641\u0636\u064a\u0644\u0627\u062a \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u062a\u0633\u0648\u064a\u0642",
    saved: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0641\u0636\u064a\u0644\u0627\u062a.",
    unsupportedTitle: "\u0645\u062a\u0635\u0641\u062d \u063a\u064a\u0631 \u0645\u062f\u0639\u0648\u0645",
    unsupportedDescription: "\u0647\u0630\u0627 \u0627\u0644\u0645\u062a\u0635\u0641\u062d \u0644\u0627 \u064a\u0648\u0641\u0631 Web Push.",
    statusUpdated: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629",
    unavailable: "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629",
    pushStatusLoadError: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u062d\u0627\u0644\u0629 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a.",
    vapidMissing: "\u0644\u0645 \u064a\u062a\u0645 \u0625\u0639\u062f\u0627\u062f \u0645\u0641\u062a\u0627\u062d Web Push \u0627\u0644\u0639\u0627\u0645 \u0628\u0639\u062f.",
    permissionDenied: "\u0644\u0645 \u064a\u062a\u0645 \u0645\u0646\u062d \u0625\u0630\u0646 \u0627\u0644\u0625\u0634\u0639\u0627\u0631.",
    saveError: "\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u062a\u0641\u0636\u064a\u0644\u0627\u062a \u0627\u0644\u0625\u0634\u0639\u0627\u0631.",
    enableError: "\u062a\u0639\u0630\u0631 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a.",
    disableError: "\u062a\u0639\u0630\u0631 \u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a.",
    refreshError: "\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u062d\u0627\u0644\u0629 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a.",
    unsupportedReason: "\u0627\u0644\u0645\u062a\u0635\u0641\u062d \u0644\u0627 \u064a\u062f\u0639\u0645 Web Push.",
    channels: {
      IN_APP: "\u062f\u0627\u062e\u0644 \u0627\u0644\u062a\u0637\u0628\u064a\u0642",
      WEB_PUSH: "\u0627\u0644\u0645\u062a\u0635\u0641\u062d",
      SMS: "\u0631\u0633\u0627\u0626\u0644 SMS",
    },
  },
} as const

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

function browserSupportsPush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

export function WebPushOptIn({ organizationSlug, organizationName, locale = "fa" }: WebPushOptInProps) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [supported, setSupported] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const text = copy[locale as keyof typeof copy] || copy.fa

  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    if (!browserSupportsPush()) {
      setSupported(false)
      setLoading(false)
      return
    }

    const response = await fetch(appPath(`/api/customer/push-subscriptions?organizationSlug=${encodeURIComponent(organizationSlug)}`), {
      cache: "no-store",
      signal,
    })

    if (!response.ok) throw new Error(await readError(response, text.pushStatusLoadError))
    const data = await response.json()
    setStatus(data)
    setPreferences(Array.isArray(data?.preferences) ? data.preferences : [])
    setSupported(true)
  }, [organizationSlug, text.pushStatusLoadError])

  useEffect(() => {
    const controller = new AbortController()
    fetchStatus(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : text.pushStatusLoadError)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [fetchStatus, text.pushStatusLoadError])

  const recordPermission = async (state: "DENIED" | "UNSUPPORTED", reason: string) => {
    await fetch(appPath("/api/customer/push-subscriptions"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationSlug,
        state,
        reason,
      }),
    }).catch(() => undefined)
  }

  const enablePush = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      if (!browserSupportsPush()) {
        setSupported(false)
        await recordPermission("UNSUPPORTED", text.unsupportedReason)
        setMessage(text.unsupportedDescription)
        return
      }

      const publicKey = status?.config?.publicKey
      if (!publicKey || !status.config?.publicKeyConfigured) {
        throw new Error(text.vapidMissing)
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        await recordPermission("DENIED", `Notification permission returned ${permission}`)
        setMessage(text.permissionDenied)
        await fetchStatus()
        return
      }

      const basePath = resolveAppBasePath()
      const registration = await navigator.serviceWorker.register(appPath("/web-push-sw.js"), { scope: basePath ? `${basePath}/` : "/" })
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      })

      const response = await fetch(appPath("/api/customer/push-subscriptions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          subscription: subscription.toJSON(),
        }),
      })

      if (!response.ok) throw new Error(await readError(response, text.enableError))

      setMessage(`${text.enabled} ${organizationName}`)
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : text.enableError)
    } finally {
      setBusy(false)
    }
  }

  const disablePush = async () => {
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      let endpoint: string | null = null
      if (browserSupportsPush()) {
        const registration = await navigator.serviceWorker.getRegistration(appPath("/web-push-sw.js"))
        const subscription = await registration?.pushManager.getSubscription()
        endpoint = subscription?.endpoint ?? null
        await subscription?.unsubscribe()
      }

      const response = await fetch(appPath("/api/customer/push-subscriptions"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          endpoint,
        }),
      })

      if (!response.ok) throw new Error(await readError(response, text.disableError))

      setMessage(`${text.disabled} ${organizationName}`)
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : text.disableError)
    } finally {
      setBusy(false)
    }
  }

  const updatePreference = async (channel: NotificationPreference["channel"], marketingEnabled: boolean) => {
    const previousPreferences = preferences
    const nextPreferences = preferences.map((preference) =>
      preference.channel === channel ? { ...preference, marketingEnabled } : preference,
    )
    setPreferences(nextPreferences)
    setBusy(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(appPath("/api/customer/notification-preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          locale,
          preferences: [{ channel, marketingEnabled }],
        }),
      })

      if (!response.ok) throw new Error(await readError(response, text.saveError))
      setMessage(text.saved)
      await fetchStatus()
    } catch (err) {
      setPreferences(previousPreferences)
      setError(err instanceof Error ? err.message : text.saveError)
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    setBusy(true)
    setError(null)
    try {
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : text.refreshError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5" />
          {text.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {text.description}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={enablePush} disabled={busy || loading || !supported || status?.active}>
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            {text.enable}
          </Button>
          <Button type="button" variant="outline" onClick={disablePush} disabled={busy || loading || !status?.active}>
            <BellOff className="h-4 w-4" />
            {text.unsubscribe}
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={refresh} disabled={busy || loading} aria-label={text.refresh}>
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {loading ? text.loading : status?.active ? text.enabled : text.disabled}
        </div>

        {preferences.length > 0 && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">{text.preferences}</p>
            {preferences.map((preference) => (
              <div key={preference.channel} className="flex items-center justify-between gap-3">
                <span className="text-sm">{text.channels[preference.channel]}</span>
                <Switch
                  checked={preference.marketingEnabled}
                  onCheckedChange={(checked) => updatePreference(preference.channel, checked)}
                  disabled={busy || loading}
                  aria-label={text.channels[preference.channel]}
                />
              </div>
            ))}
          </div>
        )}

        {!supported && (
          <Alert>
            <BellOff className="h-4 w-4" />
            <AlertTitle>{text.unsupportedTitle}</AlertTitle>
            <AlertDescription>{text.unsupportedDescription}</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>{text.statusUpdated}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <BellOff className="h-4 w-4" />
            <AlertTitle>{text.unavailable}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
