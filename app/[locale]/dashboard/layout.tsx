"use client"

import { use, useEffect, useState } from "react"
import { DashboardSidebarWithDict } from "@/components/dashboard/dashboard-sidebar"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import ToastProvider from '@/components/ToastProvider'; 
import { toast } from 'react-toastify';
import { SocketProvider } from '@/context/SocketContext'; // Adjust path as needed
import { Providers } from "@/New folder/components/providers";


// Note: For App Router, you pass props like this for page session data
// If you are not using the pages router, you might need to fetch session in the client component.
// Here, we assume SessionProvider handles it.
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
  const [loadingSilently, setLoadingSilently] = useState(true)
  const [triggerNotification, setTriggerNotification] = useState(true)

  // Fetch dashboard data
    const fetchDashboardData = async () => {
      setLoadingSilently(true)
      const audio = new Audio('/Alarm10.wav'); // Path relative to the public folder

      try {
        const response = await fetch("/api/dashboard/notifications")
        
        if (!response.ok) {
          throw new Error("Failed to fetch notifications data")
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
        setLoadingSilently(false)

      } finally {
        setLoadingSilently(false)
      }
      setTriggerNotification(false)
      setTimeout(fetchDashboardData,5000)
    }
    useEffect(() => {
    triggerNotification && fetchDashboardData()
  }, [loadingSilently])

  return (
    <ToastProvider> {/* Wrap everything with ToastProvider */}
      <Providers>
      <SocketProvider> {/* Our socket provider */}
      
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

                </SocketProvider> 
              </Providers>
    </ToastProvider>
  )
}
