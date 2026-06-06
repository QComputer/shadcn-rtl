"use client"

import { Loader2 } from "lucide-react"
import { useDashboardAccess } from "@/hooks/use-auth"
import { Card, CardContent } from "@/components/ui/card"

interface DashboardAccessBoundaryProps {
  children: React.ReactNode
}

export function DashboardAccessBoundary({ children }: DashboardAccessBoundaryProps) {
  const { hasAccess, isAuthenticated, isLoading, reason } = useDashboardAccess()

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || !hasAccess) {
    return (
      <Card className="mx-auto mt-12 max-w-xl">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          {reason || "You do not have access to this dashboard page."}
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}
