"use client";

import { use, useEffect, useRef, useState } from "react";
import { DashboardSidebarWithDict } from "@/components/dashboard/dashboard-sidebar";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import ToastProvider from "@/components/ToastProvider";
import { toast } from "react-toastify";
import { SocketProvider } from "@/context/SocketContext";
import { Providers } from "@/components/providers";

type DashboardNotification = {
  id: string;
  context?: string | null;
  type?: string | null;
};

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const stopPollingRef = useRef(false);

  useEffect(() => {
    stopPollingRef.current = false;

    async function fetchNotifications() {
      if (stopPollingRef.current || document.hidden) {
        return;
      }

      try {
        const response = await fetch("/api/dashboard/notifications", {
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          stopPollingRef.current = true;
          return;
        }

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          trigger?: boolean;
          notifications?: DashboardNotification[];
        };

        const notifications = Array.isArray(data.notifications)
          ? data.notifications
          : [];

        if (data.trigger && notifications.length > 0) {
          const audio = new Audio("/Alarm10.wav");
          audio.play().catch(() => undefined);

          for (const notification of notifications) {
            if (notification.context) {
              toast.success(notification.context, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
              });
            }
          }
        }
      } catch {
        // Keep dashboard rendering stable; notification polling will retry later.
      }
    }

    fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 30000);

    return () => {
      stopPollingRef.current = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <ToastProvider>
      <Providers>
        <SocketProvider>
          <div className="flex min-h-screen bg-background">
            <div className="hidden lg:block">
              <DashboardSidebarWithDict locale={locale} isMobile={false} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between p-4">
                <DashboardSidebarWithDict
                  locale={locale}
                  isMobile={true}
                  isOpen={isMobileMenuOpen}
                  onOpenChange={setIsMobileMenuOpen}
                />

                <div className="w-10" />
              </div>

              <div className="border-b px-6 py-2 lg:block">
                <DashboardBreadcrumb locale={locale} />
              </div>

              <div className="flex-1 p-4 lg:p-6">{children}</div>
            </div>
          </div>
        </SocketProvider>
      </Providers>
    </ToastProvider>
  );
}
