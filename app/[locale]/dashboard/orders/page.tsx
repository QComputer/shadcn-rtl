"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useDashboardAccess } from "@/hooks/use-auth"

interface Order {
  id: string
  orderNumber: string
  customer: string
  items: number
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  date: Date
}

// Persian number helper
function toPersianDigits(str: string | number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str)
    .split("")
    .map((char) => (/\d/.test(char) ? persianDigits[parseInt(char)] : char))
    .join("");
}

function formatToman(amount: number): string {
  return toPersianDigits(amount.toLocaleString("fa-IR")) + " تومان";
}

const sampleOrders: Order[] = [
  { id: "1", orderNumber: "ORD-۱۴۰۴/۰۱", customer: "علی محمدی", items: 2, total: 15000000, status: "pending", date: new Date() },
  { id: "2", orderNumber: "ORD-۱۴۰۴/۰۲", customer: "سارا احمدی", items: 1, total: 8500000, status: "processing", date: new Date(Date.now() - 86400000) },
  { id: "3", orderNumber: "ORD-۱۴۰۴/۰۳", customer: "محمد رضایی", items: 3, total: 21500000, status: "shipped", date: new Date(Date.now() - 172800000) },
  { id: "4", orderNumber: "ORD-۱۴۰۴/۰۴", customer: "مریم کاظمی", items: 1, total: 4500000, status: "delivered", date: new Date(Date.now() - 259200000) },
  { id: "5", orderNumber: "ORD-۱۴۰۴/۰۵", customer: "احمد حسنی", items: 5, total: 32000000, status: "cancelled", date: new Date(Date.now() - 345600000) },
]

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "در انتظار", icon: Clock, color: "bg-yellow-500" },
  processing: { label: "در حال پردازش", icon: Package, color: "bg-blue-500" },
  shipped: { label: "ارسال شده", icon: Truck, color: "bg-purple-500" },
  delivered: { label: "تحویل داده شده", icon: CheckCircle, color: "bg-green-500" },
  cancelled: { label: "لغو شده", icon: XCircle, color: "bg-red-500" },
}

export default function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [orders] = useState<Order[]>(sampleOrders)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const filteredOrders = orders.filter(order => 
    order.orderNumber.includes(searchQuery) ||
    order.customer.includes(searchQuery)
  )

  // Show loading state while checking access
  if (accessLoading || !mounted) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  // Show access denied message if no access
  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">دسترسی محدود</h2>
          <p className="text-muted-foreground mt-2">شما دسترسی به این صفحه را ندارید</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <DashboardBreadcrumb locale={locale} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.orders") || "سفارشات"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(orders.length.toString())} {t("navigation.orders") || "سفارش"}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 ml-2" />
          {t("common.add") || "افزودن"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("common.search") || "جستجو..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.map((order) => {
          const status = statusConfig[order.status]
          const StatusIcon = status.icon
          
          return (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${status.color}`}>
                      <StatusIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">{order.customer}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="font-bold">{formatToman(order.total)}</p>
                      <p className="text-sm text-muted-foreground">
                        {toPersianDigits(order.items.toString())} {t("order.items") || "آیتم"}
                      </p>
                    </div>
                    <Badge variant={order.status === "cancelled" ? "destructive" : "default"}>
                      {status.label}
                    </Badge>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.showing") || "نمایش"} {toPersianDigits("1")} - {toPersianDigits(filteredOrders.length.toString())} {t("common.of") || "از"} {toPersianDigits(orders.length.toString())}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
