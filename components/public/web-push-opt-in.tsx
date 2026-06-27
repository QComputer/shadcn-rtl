"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, BellOff, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
}

type WebPushOptInProps = {
  organizationSlug: string
  organizationName: string
}

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

export function WebPushOptIn({ organizationSlug, organizationName }: WebPushOptInProps) {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [supported, setSupported] = useState(true)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    if (!browserSupportsPush()) {
      setSupported(false)
      setLoading(false)
      return
    }

    const response = await fetch(`/api/customer/push-subscriptions?organizationSlug=${encodeURIComponent(organizationSlug)}`, {
      cache: "no-store",
      signal,
    })

    if (!response.ok) throw new Error(await readError(response, "Push status could not be loaded"))
    setStatus(await response.json())
    setSupported(true)
  }, [organizationSlug])

  useEffect(() => {
    const controller = new AbortController()
    fetchStatus(controller.signal)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Push status could not be loaded")
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [fetchStatus])

  const recordPermission = async (state: "DENIED" | "UNSUPPORTED", reason: string) => {
    await fetch("/api/customer/push-subscriptions", {
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
        await recordPermission("UNSUPPORTED", "Browser does not support Web Push")
        setMessage("This browser does not support Web Push notifications.")
        return
      }

      const publicKey = status?.config?.publicKey
      if (!publicKey || !status.config?.publicKeyConfigured) {
        throw new Error("Web Push is not configured yet. Add the VAPID public key first.")
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        await recordPermission("DENIED", `Notification permission returned ${permission}`)
        setMessage("Notification permission was not granted.")
        await fetchStatus()
        return
      }

      const registration = await navigator.serviceWorker.register("/web-push-sw.js")
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const response = await fetch("/api/customer/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          subscription: subscription.toJSON(),
        }),
      })

      if (!response.ok) throw new Error(await readError(response, "Push subscription could not be saved"))

      setMessage(`Push notifications are enabled for ${organizationName}.`)
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push notifications could not be enabled")
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
        const registration = await navigator.serviceWorker.getRegistration("/web-push-sw.js")
        const subscription = await registration?.pushManager.getSubscription()
        endpoint = subscription?.endpoint ?? null
        await subscription?.unsubscribe()
      }

      const response = await fetch("/api/customer/push-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug,
          endpoint,
        }),
      })

      if (!response.ok) throw new Error(await readError(response, "Push subscription could not be disabled"))

      setMessage(`Push notifications are disabled for ${organizationName}.`)
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push notifications could not be disabled")
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
      setError(err instanceof Error ? err.message : "Push status could not be refreshed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5" />
          Web Push notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enable browser notifications for updates from {organizationName}. Your browser will ask for permission after you press enable.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={enablePush} disabled={busy || loading || !supported || status?.active}>
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Enable
          </Button>
          <Button type="button" variant="outline" onClick={disablePush} disabled={busy || loading || !status?.active}>
            <BellOff className="h-4 w-4" />
            Unsubscribe
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={refresh} disabled={busy || loading} aria-label="Refresh push status">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {loading ? "Checking push status..." : status?.active ? `Enabled on ${status.activeSubscriptionCount ?? 1} browser subscription(s).` : "Not enabled for this browser account."}
        </div>

        {!supported && (
          <Alert>
            <BellOff className="h-4 w-4" />
            <AlertTitle>Unsupported browser</AlertTitle>
            <AlertDescription>This browser does not expose the Web Push APIs.</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert>
            <Bell className="h-4 w-4" />
            <AlertTitle>Status updated</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <BellOff className="h-4 w-4" />
            <AlertTitle>Push unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
