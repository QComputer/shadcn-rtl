"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  Package, 
  Truck,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, toPersianDigits } from "@/lib/persian"

interface Order {
  id: string
  status: string
  total: number
  createdAt: string
  organization: {
    name: string
    slug: string
  }
  items: Array<{
    product: {
      name: string
    }
    quantity: number
    price: number
  }>
}

const statusConfig: Record<string, { 
  label: string; 
  icon: any; 
  color: string; 
  variant: "default" | "secondary" | "destructive" | "outline"
}> = {
  PENDING: { label: "در انتظار", icon: Clock, color: "bg-yellow-500", variant: "default" },
  PROCESSING: { label: "در حال پردازش", icon: AlertCircle, color: "bg-blue-500", variant: "default" },
  SHIPPED: { label: "ارسال شده", icon: Truck, color: "bg-purple-500", variant: "secondary" },
  DELIVERED: { label: "تحویل شده", icon: CheckCircle, color: "bg-green-500", variant: "secondary" },
  CANCELLED: { label: "لغو شده", icon: XCircle, color: "bg-red-500", variant: "destructive" },
}

export default function MyOrdersPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active")

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary("fa"))
    })
    
    // Fetch user orders
    fetch("/api/orders")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch orders")
        return res.json()
      })
      .then(data => {
        setOrders(data.data || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Filter orders
  const filteredOrders = orders.filter(order => {
    if (filter === "active") {
      return !["DELIVERED", "CANCELLED"].includes(order.status)
    } else if (filter === "completed") {
      return ["DELIVERED", "CANCELLED"].includes(order.status)
    }
    return true
  })

  if (!mounted) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("navigation.orders")}</h1>
        <p className="text-muted-foreground">مشاهده و پیگیری سفارش‌های شما</p>
      </div>

      {/* Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="active">{t("order.active")}</TabsTrigger>
          <TabsTrigger value="completed">{t("order.completed")}</TabsTrigger>
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t("order.noOrders")}</p>
            <Button className="mt-4">
              <Link href="/fa">شروع خرید</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status]
            const StatusIcon = status?.icon || AlertCircle
            const orderDate = new Date(order.createdAt)
            
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">
                          سفارش #{toPersianDigits(order.id.slice(-6).toUpperCase())}
                        </h3>
                        <Badge variant={status?.variant || "secondary"}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {status?.label || order.status}
                        </Badge>
                      </div>
                      
                      <p className="text-muted-foreground text-sm mb-2">
                        {order.organization?.name}
                      </p>
                      
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span>
                          {order.items.length} محصول
                        </span>
                        <span>•</span>
                        <span>
                          {orderDate.toLocaleDateString("fa-IR")}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-primary">
                          {formatToman(order.total)}
                        </span>
                      </div>
                      
                      {/* Order Items Preview */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.items.slice(0, 3).map((item, idx) => (
                          <span 
                            key={idx}
                            className="text-xs bg-muted px-2 py-1 rounded"
                          >
                            {item.product?.name} × {toPersianDigits(item.quantity)}
                          </span>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{toPersianDigits(order.items.length - 3)} مورد دیگر
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        جزئیات سفارش
                      </Button>
                      {order.status === "DELIVERED" && (
                        <Button variant="default" size="sm">
                          ثبت نظر
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
