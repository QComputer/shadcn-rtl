"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import type { SupportedLocale } from "@/lib/i18n"
import {
  getDashboardHref,
  getDashboardRoleFromUser,
  getDashboardRouteAccessDecision,
} from "@/lib/dashboard/navigation-policy"

type DashboardRouteAccessBoundaryProps = {
  children: React.ReactNode
  locale: SupportedLocale
}

const dashboardRouteAccessCopy = {
  fa: {
    loading: "در حال بررسی دسترسی…",
    title: "دسترسی به این بخش مجاز نیست",
    description: "این مسیر داشبورد برای سطح دسترسی فعلی شما فعال نیست. از منوی داشبورد فقط بخش‌های مجاز نمایش داده می‌شوند.",
    action: "بازگشت به نمای کلی داشبورد",
  },
  en: {
    loading: "Checking access…",
    title: "You do not have access to this section",
    description: "This dashboard route is not enabled for your current access level. The dashboard menu only shows sections available to you.",
    action: "Back to dashboard overview",
  },
  ar: {
    loading: "جارٍ التحقق من الوصول…",
    title: "لا تملك صلاحية الوصول إلى هذا القسم",
    description: "هذا المسار في لوحة التحكم غير متاح لمستوى الوصول الحالي. تعرض القائمة الأقسام المسموحة فقط.",
    action: "العودة إلى نظرة لوحة التحكم",
  },
} satisfies Record<SupportedLocale, {
  loading: string
  title: string
  description: string
  action: string
}>

function getRouteAccessCopy(locale: SupportedLocale) {
  return dashboardRouteAccessCopy[locale] ?? dashboardRouteAccessCopy.fa
}

export function DashboardRouteAccessBoundary({ children, locale }: DashboardRouteAccessBoundaryProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const role = getDashboardRoleFromUser(session?.user)
  const decision = getDashboardRouteAccessDecision({ locale, pathname, role })
  const copy = getRouteAccessCopy(locale)

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground" aria-busy="true">
        {copy.loading}
      </div>
    )
  }

  if (!decision.isDashboardPath || decision.isAllowed) {
    return <>{children}</>
  }

  return (
    <section className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center px-4 text-center" aria-live="polite">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-card-foreground">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        <Link
          href={getDashboardHref(locale, "")}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {copy.action}
        </Link>
      </div>
    </section>
  )
}
