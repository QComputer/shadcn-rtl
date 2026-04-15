"use client"

import { use, useState } from "react"
import { DashboardSidebarWithDict } from "@/components/dashboard/dashboard-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import ToastProvider from '@/components/ToastProvider'; // Assuming ToastProvider is in the same directory or adjust the path

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
    <ToastProvider> {/* Wrap everything with ToastProvider */}
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
            <div className="flex items-center justify-between p-4">
              <DashboardSidebarWithDict
                locale={locale}
                isMobile={true}
                isOpen={isMobileMenuOpen}
                onOpenChange={setIsMobileMenuOpen}
              />

              <h1 className="text-lg font-semibold">
                {/* Removed conditional rendering for title, as breadcrumbs handle it */}
                {/* It's generally better to have a consistent title or let the page define it */}
              </h1>

              <div className="w-10" />
            </div>
        {/* Breadcrumb */}
          <div className={"lg:block border-b px-6 py-2"}>
            <DashboardBreadcrumb locale={locale} />
          </div>
          

          {/* Page Content */}
          <div className="flex-1 p-4 lg:p-6">
            {children}
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
