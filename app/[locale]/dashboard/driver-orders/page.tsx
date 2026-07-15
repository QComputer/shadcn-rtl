"use client"

import { useState, useEffect, use, useMemo } from "react"
import dynamic from "next/dynamic"
import {
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Timer,
  UserIcon,
  MapPin,
  Check,
  X,
  Save,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatPersianDate, formatRelativePersianTime, formatToman, toPersianDigits } from "@/lib/persian"
import { useAuth } from "@/hooks/use-auth"
import dayjs, { Dayjs } from "dayjs"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ClientGuestCustomer as GuestCustomer, ClientOrganization as Organization, ClientUser as User } from "@/lib/client-model-types"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

const MapView = dynamic(() => import("./map-view"), { ssr: false })
import { fetchOsrmRoute } from "@/lib/osrm"

interface Deny {
  userId: string
}

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
  }
  variant: {
    id: string
    name: string
  } | null
}

interface Progress {
  id: string
  estimatedEndTime: Date | null
  endTime: Date | null
}

interface Order {
  id: string
  orderNumber: string
  type: "DELIVERY" | "PICK_UP"
  status: "PENDING" | "PLACED" | "ACCEPTED" | "PREPARING" | "READY" | "PICKED_UP" | "DELIVERED" | "CANCELLED" | "RECEIVED" | "REFUNDED"
  subtotal: number
  deliveryFee: number
  tax: number
  discount: number
  total: number
  deliveryAddress: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  notes: string | null
  createdAt: string
  customer: User | null
  guestCustomer: GuestCustomer | null
  organization: Organization
  preparationProgress: Progress | null
  pickupProgress: Progress | null
  deliveryProgress: Progress | null
  driver: User | null
  driverId: string | null
  assignedDriver: {
    id: string
    name: string
    firstName: string | null
    lastName: string | null
  } | null
  items: OrderItem[]
  denies: Deny[]
}

interface OrdersResponse {
  data: Order[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "در انتظار", icon: Clock, color: "bg-yellow-500", variant: "secondary" },
  PLACED: { label: "ثبت شده", icon: Package, color: "bg-blue-200", variant: "default" },
  ACCEPTED: { label: "پذیرفته شده", icon: CheckCircle, color: "bg-yellow-600", variant: "destructive" },
  PREPARING: { label: "در حال آماده‌سازی", icon: Package, color: "bg-orange-400", variant: "destructive" },
  READY: { label: "آماده", icon: CheckCircle, color: "bg-red-500", variant: "default" },
  PICKED_UP: { label: "پیکاپ شده", icon: Truck, color: "bg-blue-500", variant: "default" },
  DELIVERED: { label: "تحویل داده شده", icon: CheckCircle, color: "bg-green-400", variant: "default" },
  CANCELLED: { label: "لغو شده", icon: XCircle, color: "bg-purple-500", variant: "default" },
  RECEIVED: { label: "دریافت شده", icon: CheckCircle, color: "bg-green-600", variant: "default" },
}

const DRIVER_ACTIONABLE_STATUSES = ["ACCEPTED", "PREPARING", "READY"] as const
const PAGE_SIZE = 10

export default function DriverOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const { user } = useAuth()

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  const [preparationTime, setPreparationTime] = useState<Dayjs | null>(null)
  const [pickupTime, setPickupTime] = useState<Dayjs | null>(null)
  const [savingPickupTime, setSavingPickupTime] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState<Dayjs | null>(null)
  const [savingDeliveryTime, setSavingDeliveryTime] = useState(false)

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [driverTab, setDriverTab] = useState<"assigned" | "available">("assigned")
  const [routeData, setRouteData] = useState<{ distance: number; duration: number } | null>(null)

  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  const hasUser = !!user?.id

  const isDenied = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const order of orders) {
      map.set(order.id, order.denies.some((d) => d.userId === user?.id))
    }
    return map
  }, [orders, user?.id])

  const displayedOrders = useMemo(() => {
    const base = orders
    if (driverTab === "assigned") {
      return base.filter((o) => o.driverId === user?.id)
    }
    return base.filter(
      (o) =>
        o.driverId === null &&
        DRIVER_ACTIONABLE_STATUSES.includes(o.status as typeof DRIVER_ACTIONABLE_STATUSES[number]) &&
        !isDenied.get(o.id),
    )
  }, [orders, driverTab, user?.id, isDenied])

  useEffect(() => {
    setPage(1)
  }, [driverTab, searchQuery, statusFilter])

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      })
      if (searchQuery) params.set("search", searchQuery)
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter)

      const response = await fetch(`/api/orders?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch orders")

      const data: OrdersResponse = await response.json()
      setOrders(data.data)

      const count = displayedOrders.length
      setTotal(count)
      setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)))
    } catch (err) {
      console.error("Error fetching orders:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mounted && hasUser) {
      fetchOrders()
    }
  }, [mounted, hasUser, page, searchQuery, statusFilter])

  const adjustTime = (setter: (d: Dayjs | null) => void, current: Dayjs | null, minutes: number) => {
    setter(current ? current.add(minutes, "minute") : null)
  }

  const handleSavePickupEstimatedEndTime = async () => {
    if (!selectedOrder?.id || !pickupTime) return
    setSavingPickupTime(true)
    try {
      await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedEndTime: pickupTime.toDate().toISOString(), type: "PICK_UP" }),
      })
    } catch (err) {
      console.error("Error updating pickup progress:", err)
      setError(err instanceof Error ? err.message : "Failed to update pickup progress")
    } finally {
      setSavingPickupTime(false)
    }
  }

  const handleSaveDeliveryEstimatedEndTime = async () => {
    if (!selectedOrder?.id || !deliveryTime) return
    setSavingDeliveryTime(true)
    try {
      await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatedEndTime: deliveryTime.toDate().toISOString(), type: "DELIVERY" }),
      })
    } catch (err) {
      console.error("Error updating delivery progress:", err)
      setError(err instanceof Error ? err.message : "Failed to update delivery progress")
    } finally {
      setSavingDeliveryTime(false)
    }
  }

  const handleSaveAllEstimatedEndTimes = async () => {
    setUpdating(true)
    await handleSavePickupEstimatedEndTime()
    await handleSaveDeliveryEstimatedEndTime()
    setUpdating(false)
    fetchOrders()
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setPreparationTime(dayjs(order.preparationProgress?.estimatedEndTime) || null)
    setPickupTime(dayjs(order.pickupProgress?.estimatedEndTime) || null)
    setDeliveryTime(dayjs(order.deliveryProgress?.estimatedEndTime) || null)
    setRouteData(null)
    if (order.type === "DELIVERY") {
      fetchOsrmRoute(51.389, 35.6892, 51.3347, 35.7219).then((data) => {
        if (data) setRouteData({ distance: data.distance, duration: data.duration })
      })
    }
    setDetailDialogOpen(true)
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error("Failed to update order status")

      fetchOrders()
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus as Order["status"] } : null))
      }
    } catch (err) {
      console.error("Error updating order status:", err)
      setError(err instanceof Error ? err.message : "Failed to update order status")
    } finally {
      setUpdating(false)
    }
  }

  const acceptOrder = async (id: string) => {
    const response = await fetch(`/api/orders/${id}/driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (!response.ok) throw new Error("Failed to accept order")
    fetchOrders()
  }

  const denyOrder = async (id: string) => {
    const response = await fetch(`/api/orders/${id}/driver`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error("Failed to deny order")
    fetchOrders()
  }

  const unDenyOrder = async (id: string) => {
    const response = await fetch(`/api/orders/${id}/driver`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undeny" }),
    })
    if (!response.ok) throw new Error("Failed to undo deny")
    fetchOrders()
  }

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  if (!mounted || !hasUser) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  const pagedOrders = displayedOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.orders") || "سفارشات"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(total.toString())} سفارش
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Driver Tabs */}
      <Tabs value={driverTab} onValueChange={(v) => { setDriverTab(v as "assigned" | "available"); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="assigned">سفارشات من</TabsTrigger>
          <TabsTrigger value="available">درخواست‌های قابل قبول</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") || "جستجو..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="همه وضعیت‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={`${locale}-${key}`} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
              {t("common.close") || "بستن"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && pagedOrders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery || statusFilter !== "all" ? "سفارشی یافت نشد" : "سفارشی وجود ندارد"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "لطفاً فیلترها را تغییر دهید"
                : "سفارشات در اینجا نمایش داده می‌شوند"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      {pagedOrders.length > 0 && (
        <div className="space-y-4">
          {pagedOrders.map((order) => {
            const status = statusConfig[order.status]
            const StatusIcon = status?.icon || AlertCircle
            const denied = isDenied.get(order.id)

            return (
              <Card
                key={order.id}
                className={
                  order.driverId === user?.id
                    ? "overflow-hidden bg-green-500/10"
                    : denied
                      ? "overflow-hidden bg-orange-500/10"
                      : "overflow-hidden bg-red-500/10"
                }
                onClick={() => handleViewOrder(order)}
              >
                <CardContent className="px-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-full ${status.color}`}>
                        <StatusIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <Badge className={statusConfig[order.status].color} variant={status?.variant || "secondary"}>
                          <StatusIcon className={"h-3 w-3 ml-1"} />
                          {status?.label || order.status}
                        </Badge>
                        {denied && (
                          <Badge variant="secondary" className="mr-2 text-xs">
                            رد شده توسط شما
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {order.organization?.name}
                      <span> {" - "} </span>
                      <span>{order.deliveryAddress || order.organization?.address || ""}</span>
                    </p>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <p className="text-sm text-muted-foreground">
                        {formatRelativePersianTime(order.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && displayedOrders.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.showing") || "نمایش"} {toPersianDigits(((page - 1) * PAGE_SIZE + 1).toString())} -{" "}
            {toPersianDigits(Math.min(page * PAGE_SIZE, total).toString())} {t("common.of") || "از"}{" "}
            {toPersianDigits(total.toString())}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">وضعیت:</span>
                  <Badge variant={statusConfig[selectedOrder.status].variant} className={statusConfig[selectedOrder.status].color}>
                    {statusConfig[selectedOrder.status].label}
                  </Badge>
                </div>
              </div>

              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    اطلاعات مشتری
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  {selectedOrder.customer?.firstName && <p>نام : {selectedOrder.customer.firstName}</p>}
                  {selectedOrder.customer?.lastName && <p>نام خانوادگی : {selectedOrder.customer.name}</p>}
                  {selectedOrder.guestCustomer?.name && <p>نام کاربر میهمان : {selectedOrder.guestCustomer.name}</p>}
                </CardContent>
              </Card>

              {/* Delivery Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    آدرس تحویل
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs">
                  <p>{selectedOrder.deliveryAddress}</p>
                  {selectedOrder.customer?.phone && <p>تلفن: {selectedOrder.customer.phone}</p>}
                </CardContent>
              </Card>

{selectedOrder.type === "DELIVERY" && (
                  <>
                    <MapView
                      deliveryLat={selectedOrder.deliveryLat ?? undefined}
                      deliveryLng={selectedOrder.deliveryLng ?? undefined}
                    />
                    {routeData && (
                     <Card>
                       <CardContent className="pt-4 space-y-2 text-sm">
                         <p>
                           <span className="text-muted-foreground">مسافت تقریبی:</span>{" "}
                           {toPersianDigits((routeData.distance / 1000).toFixed(1))} کیلومتر
                         </p>
                         <p>
                           <span className="text-muted-foreground">زمان تقریبی:</span>{" "}
                           {toPersianDigits(Math.round(routeData.duration / 60))} دقیقه
                         </p>
                       </CardContent>
                     </Card>
                   )}
                 </>
               )}

              {/* Order Items */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">اقلام سفارش</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{item.product?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {toPersianDigits(item.quantity.toString())} × {formatToman(item.price)}
                          </p>
                        </div>
                        <p className="font-bold">{formatToman(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pricing Summary */}
              <Card>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">جمع کل:</span>
                    <span>{formatToman(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.deliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">هزینه ارسال:</span>
                      <span>{formatToman(selectedOrder.deliveryFee)}</span>
                    </div>
                  )}
                  {selectedOrder.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">مالیات:</span>
                      <span>{formatToman(selectedOrder.tax)}</span>
                    </div>
                  )}
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>تخفیف:</span>
                      <span>-{formatToman(selectedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>مبلغ نهایی:</span>
                    <span>{formatToman(selectedOrder.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Progress */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    زمان‌های تخمینی
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs pt-1 space-y-2">
                  {preparationTime && (
                    <div className="grid gap-0 grid-cols-2 grid-rows-2 pt-2">
                      <div className="row-1 pt-2 pb-2">
                        <Label htmlFor="preparationProgress">آماده‌سازی:</Label>
                      </div>
                      <div className="col-2">{formatRelativePersianTime(preparationTime)}</div>
                    </div>
                  )}
                  {(pickupTime && !savingPickupTime) && (
                    <div className="grid gap-0 grid-cols-2 grid-rows-2">
                      <div className="row-1 pt-2">
                        <Label htmlFor="pickupProgress">پیکاپ:</Label>
                      </div>
                      <div className="row-2 col-1">{formatRelativePersianTime(pickupTime)}</div>
                      <div className="row-span-2">
                        <div className="grid gap-1 grid-cols-3">
                          <div className="grid gap-1 grid-rows-2">
                            <Button variant="outline" onClick={() => adjustTime(setPickupTime, pickupTime, 1)}>
                              {toPersianDigits(1)} +
                            </Button>
                            <Button variant="outline" onClick={() => adjustTime(setPickupTime, pickupTime, -1)}>
                              {toPersianDigits(1)} -
                            </Button>
                          </div>
                          <div className="grid gap-1 grid-rows-2">
                            <Button variant="outline" onClick={() => adjustTime(setPickupTime, pickupTime, 5)}>
                              {toPersianDigits(5)}+
                            </Button>
                            <Button variant="outline" onClick={() => adjustTime(setPickupTime, pickupTime, -5)}>
                              {toPersianDigits(5)}-
                            </Button>
                          </div>
                          <div className="grid gap-1 grid-rows-2 col-3">
                            <Button variant="outline" onClick={() => adjustTime(setPickupTime, pickupTime, 10)}>
                              {toPersianDigits(10)}+
                            </Button>
                            <Button variant="outline" onClick={() => adjustTime(setPickupTime, pickupTime, -10)}>
                              {toPersianDigits(10)}-
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {(deliveryTime && !savingDeliveryTime) && (
                    <div className="grid gap-0 grid-cols-2 grid-rows-2 pt-2">
                      <div className="row-1 pt-2">
                        <Label htmlFor="deliveryProgress">تحویل دهی:</Label>
                      </div>
                      <div className="row-2">{formatRelativePersianTime(deliveryTime)}</div>
                      <div className="row-span-2">
                        <div className="grid gap-1 grid-cols-3">
                          <div className="grid gap-1 grid-rows-2">
                            <Button variant="outline" onClick={() => adjustTime(setDeliveryTime, deliveryTime, 1)}>
                              {toPersianDigits(1)} +
                            </Button>
                            <Button variant="outline" onClick={() => adjustTime(setDeliveryTime, deliveryTime, -1)}>
                              {toPersianDigits(1)} -
                            </Button>
                          </div>
                          <div className="grid gap-1 grid-rows-2">
                            <Button variant="outline" onClick={() => adjustTime(setDeliveryTime, deliveryTime, 5)}>
                              {toPersianDigits(5)}+
                            </Button>
                            <Button variant="outline" onClick={() => adjustTime(setDeliveryTime, deliveryTime, -5)}>
                              {toPersianDigits(5)}-
                            </Button>
                          </div>
                          <div className="grid gap-1 grid-rows-2">
                            <Button variant="outline" onClick={() => adjustTime(setDeliveryTime, deliveryTime, 10)}>
                              {toPersianDigits(10)}+
                            </Button>
                            <Button variant="outline" onClick={() => adjustTime(setDeliveryTime, deliveryTime, -10)}>
                              {toPersianDigits(10)}-
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <Card>
                <CardContent>
                  <div className="pt-5">
                    {DRIVER_ACTIONABLE_STATUSES.includes(selectedOrder.status as typeof DRIVER_ACTIONABLE_STATUSES[number]) &&
                     !selectedOrder.assignedDriver && (
                      <div className="grid gap-1 grid-cols-3">
                        <Button
                          className="col-span-2 bg-green-400 text-green-800"
                          onClick={() => acceptOrder(selectedOrder.id)}
                        >
                          <CheckCircle /> قبول
                        </Button>
                        <Button variant="destructive" className="col-3" onClick={() => denyOrder(selectedOrder.id)}>
                          <X /> رد
                        </Button>
                      </div>
                    )}

                    {DRIVER_ACTIONABLE_STATUSES.includes(selectedOrder.status as typeof DRIVER_ACTIONABLE_STATUSES[number]) &&
                     isDenied.get(selectedOrder.id) && (
                      <div className="grid gap-1 grid-cols-3">
                        <Button className="col-span-3" variant="outline" onClick={() => unDenyOrder(selectedOrder.id)}>
                          <RefreshCw /> نظر خود را عوض کنید (قبول سفارش)
                        </Button>
                      </div>
                    )}

                    {DRIVER_ACTIONABLE_STATUSES.includes(selectedOrder.status as typeof DRIVER_ACTIONABLE_STATUSES[number]) &&
                     selectedOrder.assignedDriver?.id === user?.id && (
                      <div className="grid gap-1 grid-cols-3">
                        <Button className="col-span-2" onClick={handleSaveAllEstimatedEndTimes}>
                          <Save /> ذخیره
                        </Button>
                        {selectedOrder.status === "PICKED_UP" ? (
                          <Button
                            className="col-span-1 bg-green-400 text-green-800"
                            onClick={() => handleUpdateStatus(selectedOrder.id, "DELIVERED")}
                          >
                            <CheckCircle /> تحویل
                          </Button>
                        ) : (
                          <Button
                            className="col-span-1 bg-green-400 text-green-800"
                            onClick={() => handleUpdateStatus(selectedOrder.id, "PICKED_UP")}
                          >
                            <CheckCircle /> پیکاپ
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              <X /> بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
