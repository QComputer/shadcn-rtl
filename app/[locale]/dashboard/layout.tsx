import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supportedLocales, type SupportedLocale } from "@/lib/i18n"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { dashboardLoginCallbackUrl } from "@/lib/dashboard/login-callback"
import { headers } from "next/headers"

function validateLocale(locale: string): SupportedLocale {
  if (supportedLocales.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale
  }
  return "fa"
}

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = await params
  const locale = validateLocale(resolvedParams.locale)
  const session = await auth()

  if (!session?.user) {
    const requestHeaders = await headers()
    const callbackUrl = dashboardLoginCallbackUrl(requestHeaders.get("x-bazar-dashboard-return-to"), locale)
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }

  return (
    <DashboardShell locale={locale}>
      {children}
    </DashboardShell>
  )
}
