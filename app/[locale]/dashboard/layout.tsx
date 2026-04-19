"use client"

import { use, useEffect, useState } from "react"
import { DashboardSidebarWithDict } from "@/components/dashboard/dashboard-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import ToastProvider from '@/components/ToastProvider'; 
import { toast } from 'react-toastify';
import { Providers } from "@/components/providers";

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
  const [loading, setLoading] = useState(false)
  const [triggerNotification, setTriggerNotification] = useState(true)

  // Fetch dashboard data
    const fetchDashboardData = async () => {
      setLoading(true)
      const audio = new Audio('/Alarm10.wav'); // Path relative to the public folder

      try {
        const response = await fetch("/api/dashboard/notifications")
        
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data")
        }
        
        const data = await response.json()
        if (data.trigger && data.notifications?.length>0){
          const notifications: any[] = data.notifications 
          
 
          notifications.map((n)=>{
          audio.play()
          .then(() => console.log('Success sound played'))
          .catch(error => console.error('Error playing sound:', error));

          n.context && toast.success(n.context,{
            position: 'top-center', // Position of the toast
            autoClose: 5000, // Close after 5 seconds
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
          });
          })
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err)
        setLoading(false)

      } finally {
        setLoading(false)
      }
      setTriggerNotification(false)
      setTimeout(fetchDashboardData,3000)
    }
    useEffect(() => {
    // set Update Freequency
    triggerNotification == true && fetchDashboardData()
  }, [])

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
            <Providers>
              {children}
              </Providers>

          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
