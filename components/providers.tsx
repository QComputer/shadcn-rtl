"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/hooks/use-theme"
import { AuthProvider } from "@/hooks/use-auth"
import { ErrorBoundary } from "@/components/error-boundary"
import { LocaleProvider } from "@/components/locale-provider"
import type { SupportedLocale } from "@/lib/i18n"

interface ProvidersProps {
  children: React.ReactNode
  locale?: SupportedLocale
}

export function Providers({ children, locale = "fa" }: ProvidersProps) {
  return (
    <SessionProvider>
        <LocaleProvider defaultLocale={locale}>
          <SessionProvider> {/* next-auth session provider */}
          <AuthProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AuthProvider>
            </SessionProvider> 
        </LocaleProvider>
    </SessionProvider>
  )
}
