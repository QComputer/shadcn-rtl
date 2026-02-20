"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/hooks/use-theme"
import { AuthProvider } from "@/hooks/use-auth"
import { ErrorBoundary } from "@/components/error-boundary"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider defaultTheme="dark" storageKey="shadcn-rtl-theme">
        <AuthProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
