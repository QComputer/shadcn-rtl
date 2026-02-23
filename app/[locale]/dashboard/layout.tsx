"use client"

import { use, useState } from "react"
import { DashboardSidebarWithDict } from "@/components/dashboard/dashboard-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useAuth } from "@/hooks/use-auth"

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebarWithDict 
          locale={locale}
          isMobile={false}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 bg-background border-b">
          <div className="flex items-center justify-between p-4">
            <DashboardSidebarWithDict
              locale={locale}
              isMobile={true}
              isOpen={isMobileMenuOpen}
              onOpenChange={setIsMobileMenuOpen}
            />

            <h1 className="text-lg font-semibold">
              {children ? "" : "پنل مدیریت"}
            </h1>

            <div className="w-10" />
          </div>
        </header>
      {/* Breadcrumb */}
        <div className={"lg:block border-b px-6 py-2"}>
          <DashboardBreadcrumb locale={locale} />
        </div>
        

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}