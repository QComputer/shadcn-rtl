"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  Search,
  Plus,
  Eye,
  Edit,
  ChevronLeft,
  ChevronRight,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  MapPin,
  User as UserIcon,
  Timer,
  Loader2,
  Save,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useDashboardAccess, useAuth } from "@/hooks/use-auth"
import { formatToman, toPersianDigits } from "@/lib/persian"
import { GuestCustomer, User } from "@prisma/client"


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
  notes: string | null
  createdAt: string
  customer: User | null
  guestCustomer: GuestCustomer | null

  preparationProgress: Progress | null
  pickupProgress: Progress | null
  deliveryProgress: Progress | null

  assignedDriver: {
    id: string
    name: string
    firstName: string | null
    lastName: string | null
  } | null
  items: OrderItem[]
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
  ACCEPTED: { label: "پذیرفته شده", icon: CheckCircle, color: "bg-green-200", variant: "default" },
  PREPARING: { label: "در حال آماده‌سازی", icon: Package, color: "bg-purple-500", variant: "default" },
  READY: { label: "آماده", icon: CheckCircle, color: "bg-green-500", variant: "default" },
  PICKED_UP: { label: "پیکاپ شده", icon: Truck, color: "bg-blue-500", variant: "default" },
  DELIVERED: { label: "تحویل داده شده", icon: CheckCircle, color: "bg-green-600", variant: "default" },
  CANCELLED: { label: "لغو شده", icon: XCircle, color: "bg-red-500", variant: "destructive" },
  RECEIVED: { label: "دریافت شده", icon: CheckCircle, color: "bg-green-700", variant: "default" },
  REFUNDED: { label: "بازپرداخت شده", icon: XCircle, color: "bg-orange-500", variant: "destructive" },
}

export default function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  const { organizationMembership } = useAuth()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [preparationTime, setPreparationTime] = useState("")
  const [savingPreparationTime, setSavingPreparationTime] = useState(false)
  const [pickupTime, setPickupTime] = useState("")
  const [savingPickupTime, setSavingPickupTime] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState("")
  const [savingDeliveryTime, setSavingDeliveryTime] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch orders from API
  useEffect(() => {
    if (mounted && hasAccess) {
      fetchOrders()
    }
  }, [mounted, hasAccess, page, searchQuery, statusFilter, organizationMembership])

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
      })
      
      if (searchQuery) {
        params.set("search", searchQuery)
      }
      
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter)
      }
      
      // Filter by organization if user is a member
      if (organizationMembership?.organizationId) {
        params.set("organizationId", organizationMembership.organizationId)
      }
      
      const response = await fetch(`/api/orders?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch orders")
      }
      
      const data: OrdersResponse = await response.json()

      setOrders(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      console.error("Error fetching orders:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setPreparationTime(order.preparationProgress?.estimatedEndTime?.toString()||"")
    setPickupTime(order.pickupProgress?.estimatedEndTime?.toString()||"")
    setDeliveryTime(order.deliveryProgress?.estimatedEndTime?.toString()||"")
    setDetailDialogOpen(true)
  }

  
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update order status")
      }
      
      // Refresh orders list
      fetchOrders()
      
      // Update selected order if dialog is open
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order["status"] } : null)
      }
    } catch (err) {
      console.error("Error updating order status:", err)
      setError(err instanceof Error ? err.message : "Failed to update order status")
    } finally {
      setUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

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

  const handleSavePreparationEstimatedEndTime = async (orderId: string) => {
    console.log(preparationTime);
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estimatedEndTime: preparationTime, type: "PREPARATION" }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update order preparationProgress.estimatedEndTime")
      }
      
      // Refresh orders list
      fetchOrders()
      
    } catch (err) {
      console.error("Error updating order preparationProgress.estimatedEndTime:", err)
      setError(err instanceof Error ? err.message : "Failed to update order preparationProgress.estimatedEndTime")
    } finally {
      setUpdating(false)
    }
  }

  const handleSavePickupEstimatedEndTime = async (orderId: string) => {
    console.log(pickupTime);
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estimatedEndTime: pickupTime, type: "PICKUP" }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update order pickupProgress.estimatedEndTime")
      }
      
      // Refresh orders list
      fetchOrders()
      
    } catch (err) {
      console.error("Error updating order pickupProgress.estimatedEndTime:", err)
      setError(err instanceof Error ? err.message : "Failed to update order pickupProgress.estimatedEndTime")
    } finally {
      setUpdating(false)
    }  
  }

  const handleSaveDeliveryEstimatedEndTime = async (orderId: string) => {
    console.log(deliveryTime);
    setUpdating(true)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ estimatedEndTime: deliveryTime, type: "DELIVERY" }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to update order deliveryProgress.estimatedEndTime")
      }
      
      // Refresh orders list
      fetchOrders()
      
    } catch (err) {
      console.error("Error updating order deliveryProgress.estimatedEndTime:", err)
      setError(err instanceof Error ? err.message : "Failed to update order deliveryProgress.estimatedEndTime")
    } finally {
      setUpdating(false)
    }  
  }


  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.orders") || "سفارشات"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(total.toString())} {t("navigation.orders") || "سفارش"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchOrders()}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

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
        <Select value={statusFilter} onValueChange={(value) => {
          setStatusFilter(value)
          setPage(1)
        }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="همه وضعیت‌ها" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه وضعیت‌ها</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
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

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && orders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery || statusFilter !== "all" ? "سفارشی یافت نشد" : "سفارشی وجود ندارد"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "all" 
                ? "لطفاً فیلترها را تغییر دهید" 
                : "سفارشات در اینجا نمایش داده می‌شوند"
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      {!loading && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusConfig[order.status]
            const StatusIcon = status.icon
            
            return (
              <Card onClick={() => handleViewOrder(order)} key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${status.color}`}>
                        <StatusIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {(order.customer?.firstName)? `${order.customer?.firstName} ${order.customer?.lastName || null}` : (order.customer?.name)? `${order.customer?.name}` : `${order.guestCustomer?.name}`}
                          {order.customer?.phone && ` - ${order.customer?.phone}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="pr-14 px-5">
                        <p className="font-bold">{formatToman(order.total)}</p>
                        <p className="text-sm text-muted-foreground">
                          {toPersianDigits(order.items.length.toString())} {"آیتم"}
                        </p>
                        {order.type === "DELIVERY" && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Truck className="h-3 w-3" />
                            <span>ارسال</span>
                          </div>
                        )}
                      </div>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>

                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && orders.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.showing") || "نمایش"} {toPersianDigits(((page - 1) * 10 + 1).toString())} - {toPersianDigits(Math.min(page * 10, total).toString())} {t("common.of") || "از"} {toPersianDigits(total.toString())}
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">وضعیت:</span>
                  <Badge variant={statusConfig[selectedOrder.status].variant}>
                    {statusConfig[selectedOrder.status].label}
                  </Badge>
                </div>
                
                {/* Quick Status Update */}
                <Select 
                  value={selectedOrder.status} 
                  onValueChange={(value) => handleUpdateStatus(selectedOrder.id, value)}
                  disabled={updating}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    اطلاعات مشتری
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {selectedOrder.customer?.firstName && <p>نام : {selectedOrder.customer.firstName}</p>}
                  {selectedOrder.customer?.lastName && <p>نام خانوادگی : {selectedOrder.customer.name}</p>}
                  {selectedOrder.customer?.name && <p>نام کاربری : {selectedOrder.customer.name}</p>}
                  {selectedOrder.customer?.phone && <p>تلفن: {selectedOrder.customer.phone}</p>}
                  {selectedOrder.customer?.email && <p>ایمیل: {selectedOrder.customer.email}</p>}{selectedOrder.customer?.firstName && <p>نام : {selectedOrder.customer.firstName}</p>}
                  {selectedOrder.guestCustomer?.name && <p>نام کاربر میهمان : {selectedOrder.guestCustomer.name}</p>}
                  {selectedOrder.guestCustomer?.email && <p> ایمیل کاربر میهمان: {selectedOrder.guestCustomer.email}</p>}
                </CardContent>
              </Card>

              {/* Delivery Info */}
              {selectedOrder.type === "DELIVERY" && selectedOrder.deliveryAddress && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      آدرس تحویل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <p>{selectedOrder.deliveryAddress}</p>
                  </CardContent>
                </Card>
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
                          {item.variant && (
                            <p className="text-sm text-muted-foreground">{item.variant.name}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {toPersianDigits(item.quantity.toString())} × {formatToman(item.price)}
                          </p>
                        </div>
                        <p className="font-bold">
                          {formatToman(item.price * item.quantity)}
                        </p>
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
              
              {/* Progress 
                TODO: editable ui like dashboard/settings page
              */}
              <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Timer className="h-4 w-4" />

                    زمان های تخمین زده شده
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">

                  {preparationTime && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Label htmlFor="preparationProgress">آماده سازی:</Label>
                      <Input id="preparationProgress" 
                      value={preparationTime.toString()} 
                      onChange={(e) => setPreparationTime(e.target.value)}
                    />
                      <Button onClick={()=> handleSavePreparationEstimatedEndTime(selectedOrder.id)} disabled={savingPreparationTime}>
                        {savingPreparationTime ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                        {"ذخیره"}
                      </Button>
                    </div>
                 )}
                 {pickupTime && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Label htmlFor="pickupProgress">پیکاپ:</Label>
                      <Input id="pickupProgress"
                      value={pickupTime.toString()} 
                      onChange={(e) => setPickupTime(e.target.value)}
                    />
                      <Button onClick={() => handleSavePickupEstimatedEndTime(selectedOrder.id)} disabled={savingPickupTime}>
                        {savingPickupTime ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                        {"ذخیره"}
                      </Button>
                    </div>
                 )}
                 {deliveryTime && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <Label htmlFor="deliveryProgress">تحویل دهی:</Label>
                      <Input id="deliveryProgress" 
                      value={deliveryTime.toString()} 
                      onChange={(e) => setDeliveryTime(e.target.value)}
                    />
                      <Button onClick={() => handleSaveDeliveryEstimatedEndTime(selectedOrder.id)} disabled={savingDeliveryTime}>
                        {savingDeliveryTime ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                        {"ذخیره"}
                      </Button>
                    </div>
                 )}
                </CardContent>
              </Card>

              {/* Notes */}
              {selectedOrder.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">یادداشت</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {selectedOrder.notes}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
