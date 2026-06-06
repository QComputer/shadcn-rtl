"use client"

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"
import { AuthProvider } from "@/hooks/use-auth"
import { ErrorBoundary } from "@/components/error-boundary"
import { LocaleProvider } from "@/components/locale-provider"
import type { SupportedLocale } from "@/lib/i18n"

interface ProvidersProps {
  children: React.ReactNode
  locale?: SupportedLocale
  session?: Session | null
}

export function Providers({ children, locale = "fa", session }: ProvidersProps) {
  return (
    <SessionProvider session={session}>
      <LocaleProvider defaultLocale={locale}>
        <AuthProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </AuthProvider>
      </LocaleProvider>
    </SessionProvider>
  )
}
