"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import ToastProvider from "@/components/ToastProvider"
import { SocketProvider } from "@/context/SocketContext"
import { DashboardAccessBoundary } from "@/components/dashboard/dashboard-access-boundary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { DashboardSidebarWithDict } from "@/components/dashboard/dashboard-sidebar"
import { DashboardRouteAccessBoundary } from "@/components/dashboard/dashboard-route-access-boundary"
import { DashboardPushOptIn } from "@/components/dashboard/dashboard-push-opt-in"
import type { SupportedLocale } from "@/lib/i18n"

type DashboardNotification = {
  id: string
  context?: string | null
  type?: string | null
}

interface DashboardShellProps {
  children: React.ReactNode
  locale: SupportedLocale
}

const dashboardShellCopy = {
  fa: {
    title: "داشبورد",
    subtitle: "مدیریت سریع کسب‌وکار",
    skipToContent: "رفتن به محتوای داشبورد",
    mainContent: "محتوای اصلی داشبورد",
  },
  en: {
    title: "Dashboard",
    subtitle: "Fast business management",
    skipToContent: "Skip to dashboard content",
    mainContent: "Main dashboard content",
  },
  ar: {
    title: "لوحة التحكم",
    subtitle: "إدارة الأعمال بسرعة",
    skipToContent: "الانتقال إلى محتوى لوحة التحكم",
    mainContent: "المحتوى الرئيسي للوحة التحكم",
  },
} satisfies Record<SupportedLocale, {
  title: string
  subtitle: string
  skipToContent: string
  mainContent: string
}>

function getDashboardShellCopy(locale: SupportedLocale) {
  return dashboardShellCopy[locale] ?? dashboardShellCopy.fa
}

function DashboardNotificationPoller() {
  const stopPollingRef = useRef(false)

  useEffect(() => {
    stopPollingRef.current = false

    async function fetchNotifications() {
      if (stopPollingRef.current || document.hidden) {
        return
      }

      try {
        const response = await fetch("/api/dashboard/notifications", {
          cache: "no-store",
        })

        if (response.status === 401 || response.status === 403) {
          stopPollingRef.current = true
          return
        }

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as {
          trigger?: boolean
          notifications?: DashboardNotification[]
        }

        const notifications = Array.isArray(data.notifications) ? data.notifications : []

        if (data.trigger && notifications.length > 0) {
          const audio = new Audio("/Alarm10.wav")
          audio.play().catch(() => undefined)

          for (const notification of notifications) {
            if (notification.context) {
              toast.success(notification.context, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
              })
            }
          }

          await fetch("/api/dashboard/notifications", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: notifications.map((notification) => notification.id) }),
          }).catch(() => undefined)
        }
      } catch {
        // Keep dashboard rendering stable; notification polling will retry later.
      }
    }

    fetchNotifications()
    const intervalId = window.setInterval(fetchNotifications, 30000)

    return () => {
      stopPollingRef.current = true
      window.clearInterval(intervalId)
    }
  }, [])

  return null
}

export function DashboardShell({ children, locale }: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const copy = getDashboardShellCopy(locale)

  return (
    <ToastProvider>
      <DashboardAccessBoundary>
        <SocketProvider>
          <DashboardNotificationPoller />
          <a
            href="#dashboard-main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
          >
            {copy.skipToContent}
          </a>

          <div className="flex min-h-screen bg-background">
            <div className="hidden lg:block">
              <DashboardSidebarWithDict locale={locale} isMobile={false} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <DashboardSidebarWithDict
                    locale={locale}
                    isMobile={true}
                    isOpen={isMobileMenuOpen}
                    onOpenChange={setIsMobileMenuOpen}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{copy.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{copy.subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="hidden border-b px-6 py-2 lg:block">
                <DashboardBreadcrumb locale={locale} />
                <div className="mt-4">
                  <DashboardPushOptIn />
                </div>
              </div>

              <main
                id="dashboard-main-content"
                aria-label={copy.mainContent}
                className="flex-1 p-4 lg:p-6"
              >
                <DashboardRouteAccessBoundary locale={locale}>
                  {children}
                </DashboardRouteAccessBoundary>
              </main>
            </div>
          </div>
        </SocketProvider>
      </DashboardAccessBoundary>
    </ToastProvider>
  )
}
