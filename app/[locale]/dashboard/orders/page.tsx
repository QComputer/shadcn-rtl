"use client"

import { useState, useEffect, use } from "react"
import dayjs, { Dayjs } from "dayjs"

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
  X,
  Delete,
  Check,
  Send,
} from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatPersianDate, formatRelativePersianTime, formatToman, toPersianDigits } from "@/lib/persian"
import type { ClientGuestCustomer as GuestCustomer, ClientUser as User } from "@/lib/client-model-types"


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
  
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED"
  paymentId: string
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
  ACCEPTED: { label: "پذیرفته شده", icon: CheckCircle, color: "bg-green-400 text-green-800", variant: "outline" },
  PREPARING: { label: "در حال آماده‌سازی", icon: Package, color: "bg-purple-500", variant: "outline" },
  READY: { label: "آماده", icon: CheckCircle, color: "bg-green-600", variant: "outline" },
  PICKED_UP: { label: "پیکاپ شده", icon: Truck, color: "bg-blue-500", variant: "outline" },
  DELIVERED: { label: "تحویل داده شده", icon: CheckCircle, color: "bg-green-700", variant: "outline" },
  CANCELLED: { label: "لغو شده", icon: XCircle, color: "bg-red-500", variant: "destructive" },
  RECEIVED: { label: "دریافت شده", icon: CheckCircle, color: "bg-green-800", variant: "outline" },
  REFUNDED: { label: "بازپرداخت شده", icon: XCircle, color: "bg-orange-500", variant: "destructive" },
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["PICKED_UP", "DELIVERED", "CANCELLED"],
  PICKED_UP: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
  RECEIVED: ["REFUNDED"],
}

const TRANSITION_LABELS: Record<string, string> = {
  ACCEPTED: "قبول سفارش",
  PREPARING: "شروع آماده‌سازی",
  READY: "آماده شد",
  PICKED_UP: "پیکاپ شد",
  DELIVERED: "تحویل شد",
  CANCELLED: "لغو سفارش",
}


const paymentStatusConfig: Record<Order["paymentStatus"], { label: string; icon: typeof Clock; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "در انتظار پرداخت", icon: Clock, color: "bg-yellow-500 text-yellow-950", variant: "secondary" },
  COMPLETED: { label: "پرداخت شده", icon: CheckCircle, color: "bg-green-500 text-green-950", variant: "secondary" },
  FAILED: { label: "پرداخت ناموفق", icon: XCircle, color: "bg-red-500 text-red-50", variant: "destructive" },
  REFUNDED: { label: "بازپرداخت شده", icon: RefreshCw, color: "bg-orange-500 text-orange-950", variant: "outline" },
}

export default function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  const { user, organizationMembership } = useAuth()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [preparationTime, setPreparationTime] = useState<Dayjs | null>(null)
  const [savingPreparationTime, setSavingPreparationTime] = useState(false)
  const [pickupTime, setPickupTime] = useState<Dayjs | null>(null)
  const [savingPickupTime, setSavingPickupTime] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState<Dayjs | null>(null)
  const [savingDeliveryTime, setSavingDeliveryTime] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [orderDriverFilter, setOrderDriverFilter] = useState<string>("all")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

    const handleViewOrder = (order: Order) => {
    setSelectedOrder(order)
    setPreparationTime(dayjs(order.preparationProgress?.estimatedEndTime) || null)
    setPickupTime(dayjs(order.pickupProgress?.estimatedEndTime)|| null)
    setDeliveryTime(dayjs(order.deliveryProgress?.estimatedEndTime)|| null)
    setDetailDialogOpen(true)
  }
  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])


  // Fetch orders from API
  useEffect(() => {
    if (mounted ) {
      fetchOrders()
    }
  }, [mounted, user, page, searchQuery, statusFilter, organizationMembership])

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
      if(selectedOrder != null){ 
        const order = data.data.find((order)=> order.id == selectedOrder.id);
        if(order){
          setSelectedOrder(order)
          setPreparationTime(dayjs(order.preparationProgress?.estimatedEndTime) || null)
          setPickupTime(dayjs(order.pickupProgress?.estimatedEndTime)|| null)
          setDeliveryTime(dayjs(order.deliveryProgress?.estimatedEndTime)|| null)
      } else {
        setSelectedOrder(null)
      }
    }
      //console.log(data.data);
      
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

  const handleUpdatePaymentStatus = async (orderId: string, newPaymentStatus: Order["paymentStatus"]) => {
    setUpdating(true)
    
    try {
      const response = await fetch(`/api/orders/${orderId}/payment`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: newPaymentStatus }),
    })
      
      if (!response.ok) {
        throw new Error("Failed to update order payment status")
      }
      
      // Refresh orders list
      fetchOrders()
      
    } catch (err) {
      console.error("Error updating order status:", err)
      setError(err instanceof Error ? err.message : "Failed to update order status")
    } finally {
      setUpdating(false)
    }

  }

  const [drivers, setDrivers] = useState<{ id: string; name: string; firstName: string | null; lastName: string | null }[]>([])
  const [assigningDriver, setAssigningDriver] = useState(false)

  const fetchDrivers = async () => {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) return
      const data = await res.json()
      const driverUsers = (data.data || []).filter((u: Order["customer"] & { role: string }) => u.role === "DRIVER")
      setDrivers(driverUsers)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchDrivers()
  }, [])

  const assignDriver = async (orderId: string, driverId: string) => {
    setAssigningDriver(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/assign-driver`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      })
      if (!response.ok) throw new Error("Failed to assign driver")
      fetchOrders()
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev && driverId
          ? { ...prev, driverId, assignedDriver: drivers.find(d => d.id === driverId) || null }
          : prev
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign driver")
    } finally {
      setAssigningDriver(false)
    }
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
      
    } catch (err) {
      console.error("Error updating order payment status:", err)
      setError(err instanceof Error ? err.message : "Failed to update order payment status")
    } finally {
      setUpdating(false)
    }
  }

  // Show loading state while checking access
  if (accessLoading || !mounted) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={locale+i} className="h-24 bg-muted rounded" />
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

  const handleSaveAllEstimatedEndTimes = async ()=>{
    if (!selectedOrder) return
    await handleSavePreparationEstimatedEndTime(selectedOrder.id, preparationTime?.toDate().toISOString())
    fetchOrders()
  }

  const handleSavePreparationEstimatedEndTime = async (orderId: string, preparationTime?: string) => {
    //console.log("setting preparationTime as--->", preparationTime);
    setUpdating(true)    
    setSavingPreparationTime(true)

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
    } catch (err) {
      console.error("Error updating order preparationProgress.estimatedEndTime:", err)
      setError(err instanceof Error ? err.message : "Failed to update order preparationProgress.estimatedEndTime")
    } finally {
      setSavingPreparationTime(false)
      setUpdating(false)
    }

  }
  
  const addToPreparationEstimatedEndTime = async (minutes: number) => {
    //console.log(`add ${minutes} minutes to preparationTime `, preparationTime);
    setPreparationTime(preparationTime?.add(minutes, 'minute') || null)
  }

    const addToPickupEstimatedEndTime = async (minutes: number) => {
    //console.log(`add ${minutes} minutes to preparationTime `, preparationTime);
    setPickupTime(pickupTime?.add(minutes, 'minute') || null)
  }

    const addToDeliveryEstimatedEndTime = async (minutes: number) => {
    //console.log(`add ${minutes} minutes to preparationTime `, preparationTime);
    setDeliveryTime(deliveryTime?.add(minutes, 'minute') || null)
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
              <SelectItem key={locale+key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Driver Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select
          value={orderDriverFilter}
          onValueChange={(value) => {
            setOrderDriverFilter(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="همه رانندگان" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه رانندگان</SelectItem>
            <SelectItem value="unassigned">بدون پیک</SelectItem>
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.firstName || driver.name}
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
      {orders.length > 0 && (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusConfig[order.status]
            const StatusIcon = status.icon
            const statusColor = status.color
            const StatusLabel = status.label

            
            return (
              <Card onClick={() => handleViewOrder(order)} key={locale+order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${status.color}`}>
                        <StatusIcon className={"h-5 w-5" + status.color} />
                      </div>
                      <div>
                        <p className="font-bold">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {(order.customer?.firstName)? `${order.customer?.firstName} ${order.customer?.lastName || null}` : (order.customer?.name)? `${order.customer?.name}` : `${order.guestCustomer?.name}`}
                          {order.customer?.phone && ` - ${order.customer?.phone}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPersianDate(order.createdAt)}
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
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={status.variant} className={status.color}>
                            {status.label}
                          </Badge>
                          {order.assignedDriver && (
                            <Badge variant="outline" className="text-xs">
                              پیک: {order.assignedDriver.firstName || order.assignedDriver.name}
                            </Badge>
                          )}
                          {!order.assignedDriver && ["ACCEPTED", "PREPARING", "READY", "PICKED_UP"].includes(order.status) && (
                            <Badge variant="secondary" className="text-xs">بدون پیک</Badge>
                          )}
                        </div>
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
            <DialogDescription>
              مشاهده و مدیریت وضعیت سفارش انتخاب‌شده
            </DialogDescription>
          </DialogHeader>
          
{selectedOrder && (
            <div className="space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">وضعیت:</span>
                  <Badge variant={statusConfig[selectedOrder.status].variant}>
                    {statusConfig[selectedOrder.status].label}
                  </Badge>
                </div>
              </div>

              {/* Allowed Status Transitions */}
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">انتقال وضعیت:</span>
                <div className="flex flex-wrap gap-2">
                  {ALLOWED_TRANSITIONS[selectedOrder.status]?.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant="outline"
                      size="sm"
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, nextStatus)}
                    >
                      {TRANSITION_LABELS[nextStatus]}
                    </Button>
                  ))}
                  {selectedOrder.status !== "CANCELLED" && selectedOrder.status !== "REFUNDED" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={updating}
                      onClick={() => handleUpdateStatus(selectedOrder.id, "CANCELLED")}
                    >
                      لغو سفارش
                    </Button>
                  )}
                </div>
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
                  {selectedOrder.customer?.phone && <p>تلفن: {selectedOrder.customer.phone}</p>}
                  {selectedOrder.customer?.firstName && <p>نام: {selectedOrder.customer.firstName} {selectedOrder.customer.lastName || ""}</p>}
                  {selectedOrder.customer?.lastName && !selectedOrder.customer?.firstName && <p>نام خانوادگی: {selectedOrder.customer.lastName}</p>}
                  {selectedOrder.guestCustomer?.name && <p>نام کاربر میهمان: {selectedOrder.guestCustomer.name}</p>}
                  {selectedOrder.guestCustomer?.phone && <p>تلفن میهمان: {selectedOrder.guestCustomer.phone}</p>}
                </CardContent>
              </Card>

              
              <Card>
                <CardContent>
                    <div className="grid gap-2 grid-cols-2 grid-rows-2 ">
                      <Label htmlFor="preparationProgress">وضعیت پرداخت:</Label>


                   <Badge className={paymentStatusConfig[selectedOrder.paymentStatus].color}>
                        {paymentStatusConfig[selectedOrder.paymentStatus].label}
                      </Badge>

                      <Label htmlFor="preparationProgress">کد رهگیری انتقال:</Label>


                   <Badge className={"rounded-sm h-8 min-w-20" } variant='ghost'>
                    {selectedOrder.paymentId
                      ? <a className="text-muted-foreground">{selectedOrder.paymentId}</a>
                      :  <a className="text-muted-foreground">{" کد رهگیری هنوز فرستاده نشده "}</a>
                      }
                      </Badge>
                      </div>


                </CardContent>

                <CardFooter>
                    {selectedOrder.paymentStatus !== "COMPLETED" ? <Button  variant={'default'} className='bg-green-500 text-green-900' onClick={()=>handleUpdatePaymentStatus(selectedOrder.id, "COMPLETED")}>
                    تایید پرداخت
                  </Button>
                  : 
                  <Button  variant={'destructive'} onClick={()=>handleUpdatePaymentStatus(selectedOrder.id, "FAILED")}>
                    عدم تایید پرداخت
                  </Button>
                    }
                </CardFooter>
              </Card>

{/* Driver Assignment */}
               <Card>
                 <CardHeader className="pb-2">
                   <CardTitle className="text-sm flex items-center gap-2">
                     <Truck className="h-4 w-4" />
                     راننده
                   </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-3">
                   {selectedOrder.assignedDriver ? (
                     <div className="flex items-center justify-between rounded-md border px-3 py-2">
                       <div>
                         <p className="text-sm font-medium">
                           {selectedOrder.assignedDriver.firstName || selectedOrder.assignedDriver.name}
                         </p>
                       </div>
                       <Button
                         variant="outline"
                         size="sm"
                         disabled={assigningDriver}
                         onClick={() => assignDriver(selectedOrder.id, "")}
                       >
                         حذف پیک
                       </Button>
                     </div>
                   ) : (
                     <p className="text-xs text-muted-foreground">راننده‌ای اختصاص نیافته</p>
                   )}

<div className="flex gap-2">
                     <Select
                       disabled={assigningDriver}
                       onValueChange={(value) => {
                         if (!selectedOrder) return
                         assignDriver(selectedOrder.id, value)
                       }}
                     >
                       <SelectTrigger className="flex-1">
                         <SelectValue placeholder="انتخاب پیک" />
                       </SelectTrigger>
                       <SelectContent>
                         {drivers.length === 0 && (
                           <SelectItem value="none" disabled>
                             راننده‌ای ثبت نشده
                           </SelectItem>
                         )}
                         {drivers.map((driver) => (
                           <SelectItem key={driver.id} value={driver.id}>
                             {driver.firstName || driver.name}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div key={locale+item.id} className="flex items-center justify-between py-2 border-b last:border-0">
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
             <X/> بستن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
