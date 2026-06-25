import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supportedLocales, type SupportedLocale } from "@/lib/i18n"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

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
    redirect(`/${locale}/login?callbackUrl=${encodeURIComponent(`/${locale}/dashboard`)}`)
  }

  return (
    <DashboardShell locale={locale}>
      {children}
    </DashboardShell>
  )
}
