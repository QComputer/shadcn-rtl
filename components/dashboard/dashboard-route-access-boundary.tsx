"use client"

import { useEffect, useId, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import type { SupportedLocale } from "@/lib/i18n"
import {
  getDashboardHref,
  getDashboardRoleFromUser,
  getDashboardRouteAccessDecision,
  type DashboardRole,
} from "@/lib/dashboard/navigation-policy"

type DashboardRouteAccessBoundaryProps = {
  children: React.ReactNode
  locale: SupportedLocale
}

const dashboardRouteAccessCopy = {
  fa: {
    loading: "در حال بررسی دسترسی…",
    loadingDescription: "مسیر داشبورد و سطح دسترسی شما بررسی می‌شود.",
    eyebrow: "محدودیت دسترسی",
    title: "این بخش برای نقش فعلی شما فعال نیست",
    description: "این مسیر داشبورد در منوی نقش شما نمایش داده نمی‌شود و برای سطح دسترسی فعلی قابل استفاده نیست.",
    currentAccess: "سطح دسترسی فعلی",
    requestedRoute: "مسیر درخواستی",
    unknownRoute: "مسیر ناشناخته داشبورد",
    helper: "برای ادامه، از نمای کلی داشبورد یکی از بخش‌های مجاز را انتخاب کنید. دسترسی‌های داده‌ای همچنان در API و صفحه‌های سمت سرور مستقل بررسی می‌شوند.",
    action: "بازگشت به نمای کلی داشبورد",
    roleLabels: {
      SUPER_ADMIN: "مدیر کل",
      ADMIN: "مدیر",
      MANAGER: "مدیر داخلی",
      STAFF: "کارمند",
      DRIVER: "راننده",
      USER: "کاربر",
    },
  },
  en: {
    loading: "Checking access…",
    loadingDescription: "Your dashboard route and access level are being checked.",
    eyebrow: "Access limited",
    title: "This section is not enabled for your current role",
    description: "This dashboard route is hidden from your role menu and is not available for the current access level.",
    currentAccess: "Current access",
    requestedRoute: "Requested route",
    unknownRoute: "Unknown dashboard route",
    helper: "Continue from the dashboard overview and choose one of your available sections. Data access is still enforced independently by server pages and APIs.",
    action: "Back to dashboard overview",
    roleLabels: {
      SUPER_ADMIN: "Super admin",
      ADMIN: "Admin",
      MANAGER: "Manager",
      STAFF: "Staff",
      DRIVER: "Driver",
      USER: "User",
    },
  },
  ar: {
    loading: "جارٍ التحقق من الوصول…",
    loadingDescription: "يتم التحقق من مسار لوحة التحكم ومستوى الوصول الخاص بك.",
    eyebrow: "وصول محدود",
    title: "هذا القسم غير مفعّل للدور الحالي",
    description: "هذا المسار في لوحة التحكم مخفي من قائمة دورك وغير متاح لمستوى الوصول الحالي.",
    currentAccess: "مستوى الوصول الحالي",
    requestedRoute: "المسار المطلوب",
    unknownRoute: "مسار لوحة تحكم غير معروف",
    helper: "تابع من نظرة لوحة التحكم واختر أحد الأقسام المتاحة لك. ما زال الوصول إلى البيانات محمياً بشكل مستقل في الصفحات والخوادم وواجهات API.",
    action: "العودة إلى نظرة لوحة التحكم",
    roleLabels: {
      SUPER_ADMIN: "مدير عام",
      ADMIN: "مدير",
      MANAGER: "مدير",
      STAFF: "موظف",
      DRIVER: "سائق",
      USER: "مستخدم",
    },
  },
} satisfies Record<SupportedLocale, {
  loading: string
  loadingDescription: string
  eyebrow: string
  title: string
  description: string
  currentAccess: string
  requestedRoute: string
  unknownRoute: string
  helper: string
  action: string
  roleLabels: Record<DashboardRole, string>
}>

function getRouteAccessCopy(locale: SupportedLocale) {
  return dashboardRouteAccessCopy[locale] ?? dashboardRouteAccessCopy.fa
}

function getRequestedRouteLabel(routePath: string | null, unknownRoute: string) {
  if (routePath === null) return unknownRoute
  if (routePath === "") return "/dashboard"
  return routePath
}

export function DashboardRouteAccessBoundary({ children, locale }: DashboardRouteAccessBoundaryProps) {
  const pathname = usePathname()
  const { user, organizationMembership, isLoading } = useAuth()
  const role = getDashboardRoleFromUser({
    role: user?.role,
    organizationMembershipRole: organizationMembership?.role,
  })
  const decision = getDashboardRouteAccessDecision({
    locale,
    pathname,
    role,
    capabilities: organizationMembership?.organizationCapabilities ?? [],
  })
  const copy = getRouteAccessCopy(locale)
  const fallbackRef = useRef<HTMLElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const detailsId = useId()
  const isRtl = locale === "fa" || locale === "ar"
  const isDenied = !isLoading && decision.isDashboardPath && !decision.isAllowed

  useEffect(() => {
    if (isDenied) {
      fallbackRef.current?.focus()
    }
  }, [isDenied])

  if (isLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center px-4 text-center" aria-busy="true" role="status">
        <div className="rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <div className="mx-auto mb-3 h-2 w-16 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
          <p className="text-sm font-medium text-card-foreground">{copy.loading}</p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.loadingDescription}</p>
        </div>
      </div>
    )
  }

  if (!decision.isDashboardPath || decision.isAllowed) {
    return <>{children}</>
  }

  return (
    <section
      ref={fallbackRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby={titleId}
      aria-describedby={`${descriptionId} ${detailsId}`}
      className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-3 py-8 text-center outline-none"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="w-full rounded-3xl border bg-card/95 p-5 shadow-sm ring-1 ring-border/60 sm:p-7">
        <p className="mx-auto inline-flex rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          {copy.eyebrow}
        </p>
        <h1 id={titleId} className="mt-4 text-xl font-semibold tracking-tight text-card-foreground sm:text-2xl">
          {copy.title}
        </h1>
        <p id={descriptionId} className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          {copy.description}
        </p>

        <dl id={detailsId} className="mt-5 grid gap-3 text-start sm:grid-cols-2">
          <div className="rounded-2xl border bg-background/70 p-4">
            <dt className="text-xs font-medium text-muted-foreground">{copy.currentAccess}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{copy.roleLabels[role]}</dd>
          </div>
          <div className="rounded-2xl border bg-background/70 p-4">
            <dt className="text-xs font-medium text-muted-foreground">{copy.requestedRoute}</dt>
            <dd className="mt-1 truncate text-sm font-semibold text-foreground" title={getRequestedRouteLabel(decision.routePath, copy.unknownRoute)}>
              {getRequestedRouteLabel(decision.routePath, copy.unknownRoute)}
            </dd>
          </div>
        </dl>

        <p className="mx-auto mt-5 max-w-xl text-xs leading-6 text-muted-foreground">{copy.helper}</p>

        <Link
          href={getDashboardHref(locale, "")}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {copy.action}
        </Link>
      </div>
    </section>
  )
}
