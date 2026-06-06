"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Calendar, 
  Users, 
  Settings,
  CalendarDays,
  ShoppingBag,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  Scissors,
  Building2,
  LogOut,
  FolderOpen,
  QrCode
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/hooks/use-auth"
import { filterNavItems, dashboardNavItems, type NavItem } from "@/lib/access-control"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { isRTL } from "@/lib/i18n"

interface DashboardSidebarProps {
  locale: string
  dict?: Record<string, any>
  isMobile?: boolean
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calendar,
  Users,
  Settings,
  CalendarDays,
  ShoppingBag,
  Briefcase,
  Scissors,
  Building2,
  LogOut,
  FolderOpen,
  QrCode,
}

function getIconComponent(iconName: string) {
  return iconMap[iconName] || LayoutDashboard
}

export function DashboardSidebar({ 
  locale, 
  dict,
  isMobile = false,
  isOpen,
  onOpenChange
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { user, organizationMembership, isLoading, signOut } = useAuth()
  const [filteredItems, setFilteredItems] = useState<NavItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
  }, [])

  useEffect(() => {
    if (!mounted || isLoading) return

    // Build user access context
    const context = {
      userId: user?.id || "",
      userRole: user?.role || "CUSTOMER",
      organizationId: organizationMembership?.organizationId,
      organizationType: organizationMembership?.organizationType,
    }

    // Filter navigation items based on user access
    const items = filterNavItems(dashboardNavItems, context)
    setFilteredItems(items)
  }, [mounted, isLoading, user, organizationMembership])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const getNavLabel = (item: NavItem): string => {
    return t(item.labelKey) || item.labelKey
  }

  if (!mounted || isLoading) {
    return (
      <div className={cn("space-y-2 p-4", isMobile ? "" : "w-64")}>
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
        {/*<div className="h-10 bg-muted animate-pulse rounded-lg" />
        <div className="h-10 bg-muted animate-pulse rounded-lg" />
        <div className="h-10 bg-muted animate-pulse rounded-lg" /> */}
      </div>
    )
  }

  const content = (
    <ScrollArea className={cn("flex-1 py-4", isMobile ? "h-[calc(100vh-8rem)]" : "h-full")}>
      <nav className="space-y-1 px-2">
        {filteredItems.map((item) => {
          const Icon = getIconComponent(item.icon)
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          
          return (
            <Link
              key={item.id+"ashboard-sidebar"}
              href={`/${locale}${item.href}`}
              onClick={() => isMobile && onOpenChange?.(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{getNavLabel(item)}</span>
              {isActive && !isMobile && (
                <ChevronRight className="h-4 w-4 mr-auto" />
              )}
            </Link>
          )
        })}
      </nav>
    </ScrollArea>
  )

  if (isMobile) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72"
          dir={isRTL(locale) ? "rtl" : "ltr"}
          >
            <SheetHeader>
              <SheetTitle>{t("navigation.menu") || "منو"}</SheetTitle>
            </SheetHeader>
            {content}
            {/* Logout Button for Mobile */}
            <div className="p-4 border-t mt-auto">
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={() => {
                  onOpenChange?.(false)
                  signOut()
                }}
              >
                <LogOut className="h-5 w-5 ml-2" />
                {t("auth.logout") || "خروج"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-l bg-background">
      <div className="p-4 border-b">
        <Link href={`/${locale}/dashboard`} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold">{t("navigation.dashboard") || "پنل مدیریت"}</span>
        </Link>
      </div>
      {content}
      {/* Logout Button */}
      <div className="p-4 border-t mb-15">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={() => {
            signOut()
          }}
        >
          <LogOut className="h-5 w-5 ml-2 " />
          {t("auth.logout") || "خروج"}
        </Button>
      </div>
    </aside>
  )
}

// Menu icon component for mobile trigger
function Menu({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  )
}

// Export a version with dict loading built-in
export function DashboardSidebarWithDict({ 
  locale,
  isMobile = false,
  isOpen,
  onOpenChange
}: Omit<DashboardSidebarProps, "dict">) {
  const [dict, setDict] = useState<Record<string, any>>({})

  useEffect(() => {
    const dict = getDictionary(locale)
    setDict(dict)
  }, [locale])

  return (
    <DashboardSidebar
      locale={locale}
      dict={dict}
      isMobile={isMobile}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  )
}