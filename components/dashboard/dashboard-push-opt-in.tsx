"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "react-toastify"
import { Bell, BellOff } from "lucide-react"

type DashboardPushStatus = {
  active: boolean
  subscriptionCount: number
  subscriptions: Array<{ id: string; isActive: boolean; lastSeenAt: string; createdAt: string; updatedAt: string }>
  config: {
    publicKey: string
    publicKeyConfigured: boolean
    dryRun: boolean
    provider: string
  }
  preferences: Array<{
    id: string | null
    channel: string
    marketingEnabled: boolean
    transactionalEnabled: boolean
    persisted: boolean
    updatedAt: string | null
  }> | null
}

const copy = {
  fa: {
    title: "اعلان مرورگر برای مدیران فروشگاه",
    enable: "فعال‌سازی اعلان مرورگر داشبورد",
    disable: "غیرفعال‌سازی اعلان مرورگر داشبورد",
    description: "برای دریافت اعلان سفارش‌های جدید حتی وقتی داشبورد باز نیست، اعلان مرورگر را فعال کنید.",
    unsupported: "اعلان مرورگر در این مرورگر پشتیبانی نمی‌شود",
    insecureContext: "اتصال امن HTTPS برای فعال‌سازی اعلان مرورگر لازم است",
    serviceWorkerUnavailable: "Service Worker در این مرورگر فعال نیست",
    pushApiUnavailable: "Push API در این مرورگر فعال نیست",
    notificationApiUnavailable: "Notification API در این مرورگر فعال نیست",
    permissionDenied: "مجوز اعلان قبلاً رد شده است. لطفاً در تنظیمات مرورگر خود اجازه دهید.",
    permissionPrompt: "برای فعال‌سازی اعلان، اجازه مرورگر لازم است",
    notConfigured: "کلید عمومی اعلان تنظیم نشده است",
    subscribed: "اعلان مرورگر فعال است",
    unsubscribed: "اعلان مرورگر غیرفعال است",
    active: "اعلان مرورگر فعال است",
    dryRun: "حالت آزمایشی - اعلان‌ها ارسال نمی‌شوند",
    error: "خطا در مدیریت اعلان مرورگر",
  },
}

function getCopy() {
  return copy.fa
}

export function DashboardPushOptIn() {
  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<DashboardPushStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [permissionState, setPermissionState] = useState<"granted" | "denied" | "unsupported" | "default">("default")

  const c = getCopy()

  useEffect(() => {
    setMounted(true)
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/dashboard/push-subscriptions")
      if (response.ok) {
        const data = (await response.json()) as DashboardPushStatus
        setStatus(data)
      }
    } catch {
      // Silent fail
    }
  }

  const [capabilityError, setCapabilityError] = useState<string | null>(null)

  const checkPermission = async () => {
    setCapabilityError(null)

    if (!("serviceWorker" in navigator)) {
      setPermissionState("unsupported")
      setCapabilityError(c.serviceWorkerUnavailable)
      return
    }

    if (!("PushManager" in window)) {
      setPermissionState("unsupported")
      setCapabilityError(c.pushApiUnavailable)
      return
    }

    if (!("Notification" in window)) {
      setPermissionState("unsupported")
      setCapabilityError(c.notificationApiUnavailable)
      return
    }

    if (!window.isSecureContext) {
      setPermissionState("unsupported")
      setCapabilityError(c.insecureContext)
      return
    }

    try {
      const permission = await navigator.permissions.query({ name: "push" as PermissionName })
      setPermissionState(permission.state as "granted" | "denied" | "default")
    } catch {
      setPermissionState("default")
    }
  }

  useEffect(() => {
    if (mounted) {
      checkPermission()
    }
  }, [mounted])

  const subscribe = async () => {
    setLoading(true)
    try {
      if (!("serviceWorker" in navigator)) {
        toast.error(c.unsupported)
        return
      }

      if (!("Notification" in window)) {
        toast.error(c.notificationApiUnavailable)
        return
      }

      const registration = await navigator.serviceWorker.ready
      const publicKey = status?.config.publicKey

      if (!publicKey) {
        toast.error(c.notConfigured)
        return
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const response = await fetch("/api/dashboard/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      })

      if (response.ok) {
        setStatus((prev) => prev ? { ...prev, active: true, subscriptionCount: (prev.subscriptionCount || 0) + 1 } : prev)
        toast.success(c.subscribed)
      } else {
        throw new Error("Failed to subscribe")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("Permission denied")) {
        setPermissionState("denied")
        toast.error(c.permissionDenied)
      } else {
        const safeMessage = message.length > 180 ? `${message.slice(0, 177)}...` : message
        toast.error(`${c.error}: ${safeMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/dashboard/push-subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: status?.subscriptions?.[0]?.id }),
      })

      if (response.ok) {
        setStatus((prev) => prev ? { ...prev, active: false, subscriptionCount: 0 } : prev)
        toast.success(c.unsubscribed)
      } else {
        throw new Error("Failed to unsubscribe")
      }
    } catch {
      toast.error(c.error)
    } finally {
      setLoading(false)
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    const arr = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      arr[i] = rawData.charCodeAt(i)
    }
    return arr
  }

  if (!mounted) return null

  if (permissionState === "unsupported") {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <BellOff className="h-5 w-5" />
            <span className="text-sm">{capabilityError || c.unsupported}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isSubscribed = status?.active && status.subscriptionCount > 0

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium">{c.title}</h3>
            <p className="text-xs text-muted-foreground">{c.description}</p>
          </div>
          <Switch
            checked={isSubscribed}
            onCheckedChange={(checked) => {
              if (checked) {
                subscribe()
              } else {
                unsubscribe()
              }
            }}
            disabled={loading || !status?.config.publicKeyConfigured}
          />
        </div>
        {status?.config.dryRun && !isSubscribed && (
          <p className="text-xs text-amber-600">{c.dryRun}</p>
        )}
        {!status?.config.publicKeyConfigured && (
          <p className="text-xs text-destructive">{c.notConfigured}</p>
        )}
        {permissionState === "denied" && (
          <p className="text-xs text-destructive">{c.permissionDenied}</p>
        )}
        {permissionState === "default" && !isSubscribed && (
          <p className="text-xs text-muted-foreground">{c.permissionPrompt}</p>
        )}
        {isSubscribed && (
          <p className="text-xs text-emerald-600">{c.active}</p>
        )}
      </CardContent>
    </Card>
  )
}