"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
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
}

type InstallIdentity = { name: string; icon: string; pathname: string; assets: Array<{ url: string; size: number }> }

type InstallManifest = {
  display?: string
  name?: string
  icons?: Array<{ src?: string; sizes?: string; purpose?: string }>
}

function manifestInstallIdentity(manifest: InstallManifest): Omit<InstallIdentity, "pathname"> | null {
  if (manifest.display !== "standalone" || !manifest.name?.trim()) return null
  const icons = manifest.icons || []
  const regular = icons.find((icon) => icon.sizes === "192x192" && icon.purpose?.includes("any"))
  const has512 = icons.some((icon) => icon.sizes === "512x512" && icon.purpose?.includes("any"))
  const hasMaskable192 = icons.some((icon) => icon.sizes === "192x192" && icon.purpose?.includes("maskable"))
  const hasMaskable512 = icons.some((icon) => icon.sizes === "512x512" && icon.purpose?.includes("maskable"))
  if (!regular?.src || !has512 || !hasMaskable192 || !hasMaskable512) return null
  const assets: InstallIdentity["assets"] = []
  for (const [size, purpose] of [[192, "any"], [512, "any"], [192, "maskable"], [512, "maskable"]] as const) {
    const candidate = icons.find((entry) => entry.sizes === `${size}x${size}` && entry.purpose?.includes(purpose))
    if (!candidate?.src) return null
    try {
      const url = new URL(candidate.src, window.location.origin)
      if (url.username || url.password || (url.protocol !== "https:" && url.origin !== window.location.origin)) return null
      assets.push({ url: url.href, size })
    } catch { return null }
  }
  return { name: manifest.name.trim(), icon: assets[0].url, assets }
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

export function PwaInstallManager({ enabled, locale, basePath }: PwaInstallManagerProps) {
  const [installPrompt, setInstallPrompt] = useState<{ event: BeforeInstallPromptEvent; pathname: string } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [readyIdentity, setReadyIdentity] = useState<InstallIdentity | null>(null)
  const [identity, setIdentity] = useState<InstallIdentity | null>(null)
  const pathname = usePathname()
  // Rewrites may also leave the parent layout's locale behind the browser URL.
  const publicPath = typeof window === "undefined"
    ? ""
    : basePath && window.location.pathname.startsWith(`${basePath}/`)
      ? window.location.pathname.slice(basePath.length)
      : window.location.pathname
  const pathLocale = publicPath.split("/").filter(Boolean)[0]
  const invitationLocale = pathLocale === "fa" || pathLocale === "en" || pathLocale === "ar" ? pathLocale : locale
  const text = copy[invitationLocale as keyof typeof copy] || copy.fa
  const dir = invitationLocale === "en" ? "ltr" : "rtl"

  useEffect(() => {
    if (!enabled) return
    let active = true
    // A custom-domain page rewrite can change the Host seen by the layout.
    // Read back the current origin's trusted, non-cacheable manifest before
    // displaying an invitation or registering this origin's worker.
    const advertisedManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href
    const fallbackManifest = new URL(`${basePath}/manifest.webmanifest`, window.location.origin).href
    void Promise.resolve()
      .then(() => {
        const manifestUrl = new URL(advertisedManifest || fallbackManifest, window.location.href)
        if (manifestUrl.origin !== window.location.origin) throw new Error("cross-origin manifest")
        return fetch(manifestUrl, { cache: "no-store", credentials: "same-origin" })
      })
      .then(async (response) => response.ok ? response.json() as Promise<InstallManifest> : null)
      .then((manifest) => {
        const resolved = manifest ? manifestInstallIdentity(manifest) : null
        if (active) setIdentity(resolved ? { ...resolved, pathname } : null)
      })
      .catch(() => { if (active) setIdentity(null) })
    return () => { active = false }
  }, [enabled, basePath, pathname])

  useEffect(() => {
    if (!identity) return
    let active = true
    void Promise.all(identity.assets.map(({ url, size }) => new Promise<boolean>((resolve) => {
      const image = new window.Image()
      image.onload = () => resolve(image.naturalWidth >= size && image.naturalWidth === image.naturalHeight)
      image.onerror = () => resolve(false)
      image.src = url
    }))).then((eligible) => {
      if (active) setReadyIdentity(eligible.every(Boolean) ? identity : null)
    })
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
      setInstallPrompt({ event: event as BeforeInstallPromptEvent, pathname })
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
  }, [enabled, pathname])

  const install = async () => {
    if (!installPrompt || installPrompt.pathname !== pathname) return
    await installPrompt.event.prompt()
    await installPrompt.event.userChoice.catch(() => undefined)
    setInstallPrompt(null)
    setDismissed(true)
  }

  const currentIdentity = identity?.pathname === pathname ? identity : null
  if (!enabled || !currentIdentity || readyIdentity !== currentIdentity || dismissed || !installPrompt || installPrompt.pathname !== pathname) return null

  const { name, icon } = currentIdentity

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
          alt={invitationLocale === "fa" ? `نماد اپ ${name}` : invitationLocale === "ar" ? `أيقونة تطبيق ${name}` : `${name} app icon`}
          width={40}
          height={40}
          unoptimized
          onError={() => setReadyIdentity(null)}
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
