"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { useEffect, useState } from "react"

interface BreadcrumbSegment {
  label: string
  href: string
  isCurrent: boolean
}

interface DashboardBreadcrumbProps {
  locale: string
  customLabels?: Record<string, string>
}

// Default route labels (can be overridden by customLabels)
const defaultRouteLabels: Record<string, string> = {
  dashboard: "داشبورد",
  orders: "سفارش‌ها",
  products: "محصولات",
  appointments: "نوبت‌ها",
  customers: "مشتریان",
  settings: "تنظیمات",
  calendar: "تقویم",
  "my-orders": "سفارش‌های من",
  "my-appointments": "نوبت‌های من",
  "my-services": "خدمات من",
  organizations: "سازمان‌ها",
  members: "اعضا",
  categories: "دسته‌بندی‌ها",
  services: "خدمات",
}

// RTL-aware arrow icon
function ArrowBackIcon({ dir }: { dir: "rtl" | "ltr" }) {
  if (dir === "rtl") {
    return <ArrowRight className="h-4 w-4" />
  }
  return <ArrowLeft className="h-4 w-4" />
}

export function DashboardBreadcrumb({ locale, customLabels }: DashboardBreadcrumbProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [dir, setDir] = useState<"rtl" | "ltr">("rtl")

  useEffect(() => {
    // Load dictionary
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Set direction based on locale
    const rtlLocales = ["fa", "ar"]
    setDir(rtlLocales.includes(locale) ? "rtl" : "ltr")
  }, [locale])

  // Get translated label for a route segment
  const getLabel = (segment: string): string => {
    // First check custom labels
    if (customLabels?.[segment]) {
      return customLabels[segment]
    }
    
    // Then check dictionary
    const dictKey = `navigation.${segment}`
    if (dict) {
      const dictValue = getDictValue(dict, dictKey)
      if (dictValue && dictValue !== dictKey) {
        return dictValue
      }
    }
    
    // Fall back to default labels
    return defaultRouteLabels[segment] || segment
  }

  // Parse pathname into breadcrumb segments
  const parsePathname = (): BreadcrumbSegment[] => {
    // Remove locale from pathname
    const pathWithoutLocale = pathname.replace(`/${locale}`, "")
    
    // Split path into segments
    const segments = pathWithoutLocale.split("/").filter(Boolean)
    
    // Build breadcrumb items
    const breadcrumbItems: BreadcrumbSegment[] = []
    let currentPath = ""
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      
      breadcrumbItems.push({
        label: getLabel(segment),
        href: `/${locale}${currentPath}`,
        isCurrent: index === segments.length - 1,
      })
    })
    
    return breadcrumbItems
  }

  const segments = parsePathname()

  // Don't render breadcrumb on main dashboard page (only one segment)
  if (segments.length <= 1) {
    return null
  }

  return (
    <div className="flex items-center gap-4 mb-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="h-8 px-2"
        aria-label={dir === "rtl" ? "بازگشت" : "Back"}
      >
        <ArrowBackIcon dir={dir} />
        <span className="mr-2 hidden sm:inline">
          {dir === "rtl" ? "بازگشت" : "Back"}
        </span>
      </Button>

      {/* Separator */}
      <div className="h-4 w-px bg-border" />

      {/* Breadcrumb */}
      <Breadcrumb dir={dir}>
        <BreadcrumbList>
          {/* Home Link */}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/${locale}/dashboard`} className="flex items-center gap-1">
                <Home className="h-4 w-4" />
                <span className="sr-only">{dir === "rtl" ? "داشبورد" : "Dashboard"}</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {/* Path Segments */}
          {segments.slice(1).map((segment, index) => {
            const isLast = index === segments.length - 2
            
            return (
              <div key={segment.href} className="flex items-center gap-1.5">
                <BreadcrumbSeparator dir={dir} />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={segment.href}>{segment.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}

// Export a simpler version for pages that just need breadcrumb without back button
export function SimpleBreadcrumb({ locale, customLabels }: DashboardBreadcrumbProps) {
  const pathname = usePathname()
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [dir, setDir] = useState<"rtl" | "ltr">("rtl")

  useEffect(() => {
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    const rtlLocales = ["fa", "ar"]
    setDir(rtlLocales.includes(locale) ? "rtl" : "ltr")
  }, [locale])

  const getLabel = (segment: string): string => {
    if (customLabels?.[segment]) {
      return customLabels[segment]
    }
    
    const dictKey = `navigation.${segment}`
    if (dict) {
      const dictValue = getDictValue(dict, dictKey)
      if (dictValue && dictValue !== dictKey) {
        return dictValue
      }
    }
    
    return defaultRouteLabels[segment] || segment
  }

  const parsePathname = (): BreadcrumbSegment[] => {
    const pathWithoutLocale = pathname.replace(`/${locale}`, "")
    const segments = pathWithoutLocale.split("/").filter(Boolean)
    const breadcrumbItems: BreadcrumbSegment[] = []
    let currentPath = ""
    
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      breadcrumbItems.push({
        label: getLabel(segment),
        href: `/${locale}${currentPath}`,
        isCurrent: index === segments.length - 1,
      })
    })
    
    return breadcrumbItems
  }

  const segments = parsePathname()

  if (segments.length <= 1) {
    return null
  }

  return (
    <Breadcrumb dir={dir} className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`/${locale}/dashboard`} className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              <span className="sr-only">{dir === "rtl" ? "داشبورد" : "Dashboard"}</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.slice(1).map((segment, index) => {
          const isLast = index === segments.length - 2
          
          return (
            <div key={segment.href} className="flex items-center gap-1.5">
              <BreadcrumbSeparator dir={dir} />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{segment.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={segment.href}>{segment.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
