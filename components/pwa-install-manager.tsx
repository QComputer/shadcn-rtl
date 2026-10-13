"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type PwaInstallManagerProps = {
  enabled: boolean
  locale: string
  basePath: string
  appName: string
  appIcon: string | null
}

type InstallIdentity = { name: string; icon: string }

type InstallManifest = {
  display?: string
  name?: string
  icons?: Array<{ src?: string; sizes?: string; purpose?: string }>
}

function manifestInstallIdentity(manifest: InstallManifest, appName: string, appIcon: string | null): InstallIdentity | null {
  if (manifest.display !== "standalone" || !manifest.name?.trim()) return null
  const icons = manifest.icons || []
  const regular = icons.find((icon) => icon.sizes === "192x192" && icon.purpose?.includes("any"))
  const has512 = icons.some((icon) => icon.sizes === "512x512" && icon.purpose?.includes("any"))
  const hasMaskable192 = icons.some((icon) => icon.sizes === "192x192" && icon.purpose?.includes("maskable"))
  const hasMaskable512 = icons.some((icon) => icon.sizes === "512x512" && icon.purpose?.includes("maskable"))
  if (!regular?.src || !has512 || !hasMaskable192 || !hasMaskable512) return null
  let iconUrl: URL
  try {
    iconUrl = new URL(regular.src, window.location.origin)
  } catch {
    return null
  }
  if (iconUrl.username || iconUrl.password || (iconUrl.protocol !== "https:" && iconUrl.origin !== window.location.origin)) return null
  const serverIcon = appIcon ? new URL(appIcon, window.location.origin).href : null
  return { name: serverIcon === iconUrl.href && appName.trim() ? appName.trim() : manifest.name.trim(), icon: iconUrl.href }
}

const copy = {
  fa: {
    title: "نصب اپ",
    action: "\u0646\u0635\u0628",
    dismiss: "\u0628\u0633\u062a\u0646",
  },
  en: {
    title: "Install app",
    action: "Install",
    dismiss: "Close",
  },
  ar: {
    title: "تثبيت تطبيق",
    action: "\u062a\u062b\u0628\u064a\u062a",
    dismiss: "\u0625\u063a\u0644\u0627\u0642",
  },
} as const

export function canRegisterServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false
  return window.isSecureContext
}

export function PwaInstallManager({ enabled, locale, basePath, appName, appIcon }: PwaInstallManagerProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [readyIcon, setReadyIcon] = useState<string | null>(null)
  const [identity, setIdentity] = useState<InstallIdentity | null>(null)
  const text = copy[locale as keyof typeof copy] || copy.fa
  const dir = locale === "en" ? "ltr" : "rtl"

  useEffect(() => {
    if (!enabled) return
    let active = true
    // A custom-domain page rewrite can change the Host seen by the layout.
    // Read back the current origin's trusted, non-cacheable manifest before
    // displaying an invitation or registering this origin's worker.
    void fetch(`${basePath}/manifest.webmanifest`, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<InstallManifest> : null)
      .then((manifest) => {
        if (active) setIdentity(manifest ? manifestInstallIdentity(manifest, appName, appIcon) : null)
      })
      .catch(() => { if (active) setIdentity(null) })
    return () => { active = false }
  }, [enabled, basePath, appName, appIcon])

  useEffect(() => {
    if (!identity) return
    let active = true
    const image = new window.Image()
    image.onload = () => {
      if (active) setReadyIcon(image.naturalWidth >= 192 && image.naturalWidth === image.naturalHeight ? identity.icon : null)
    }
    image.onerror = () => { if (active) setReadyIcon(null) }
    image.src = identity.icon
    return () => { active = false }
  }, [identity])

  useEffect(() => {
    if (!enabled || !identity || !canRegisterServiceWorker()) return
    if (process.env.NODE_ENV === "development") return
    const scope = basePath ? `${basePath}/` : "/"
    void navigator.serviceWorker.register(`${basePath}/web-push-sw.js`, { scope }).catch(() => undefined)
  }, [basePath, enabled, identity])

  useEffect(() => {
    if (!enabled) return

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setDismissed(false)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setDismissed(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [enabled])

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice.catch(() => undefined)
    setInstallPrompt(null)
    setDismissed(true)
  }

  if (!enabled || !identity || readyIcon !== identity.icon || dismissed || !installPrompt) return null

  const { name, icon } = identity

  return (
    <div
      data-testid="pwa-install-invitation"
      dir={dir}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 text-sm shadow-lg backdrop-blur"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Image
          data-testid="pwa-install-brand-icon"
          src={icon}
          alt={locale === "fa" ? `نماد اپ ${name}` : locale === "ar" ? `أيقونة تطبيق ${name}` : `${name} app icon`}
          width={40}
          height={40}
          unoptimized
          onError={() => setReadyIcon(null)}
          className="h-10 w-10 shrink-0 rounded-lg object-contain"
        />
        <span data-testid="pwa-install-title" className="truncate font-medium">{`${text.title} ${name}`}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" onClick={install}>
          {text.action}
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => setDismissed(true)} aria-label={text.dismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
