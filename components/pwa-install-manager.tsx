"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
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

const copy = {
  fa: {
    title: "\u0646\u0635\u0628 \u0628\u0627\u0632\u0627\u0631 \u0628\u0627\u0632",
    action: "\u0646\u0635\u0628",
    dismiss: "\u0628\u0633\u062a\u0646",
  },
  en: {
    title: "Install Bazarbaaz",
    action: "Install",
    dismiss: "Close",
  },
  ar: {
    title: "\u062b\u0628\u0651\u062a \u0628\u0627\u0632\u0627\u0631 \u0628\u0627\u0632",
    action: "\u062a\u062b\u0628\u064a\u062a",
    dismiss: "\u0625\u063a\u0644\u0627\u0642",
  },
} as const

export function canRegisterServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false
  return window.isSecureContext
}

export function PwaInstallManager({ enabled, locale, basePath }: PwaInstallManagerProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const text = copy[locale as keyof typeof copy] || copy.fa
  const dir = locale === "en" ? "ltr" : "rtl"

  useEffect(() => {
    if (!enabled || !canRegisterServiceWorker()) return
    if (process.env.NODE_ENV === "development") return
    const scope = basePath ? `${basePath}/` : "/"
    void navigator.serviceWorker.register(`${basePath}/web-push-sw.js`, { scope }).catch(() => undefined)
  }, [basePath, enabled])

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

  if (!enabled || dismissed || !installPrompt) return null

  return (
    <div
      dir={dir}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 text-sm shadow-lg backdrop-blur"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Download className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate font-medium">{text.title}</span>
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
