"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
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
  Save
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatRelativePersianTime, formatToman, toPersianDigits } from "@/lib/persian"
import { useAuth } from "@/hooks/use-auth"
import dayjs, { Dayjs } from "dayjs"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select } from "@/components/ui/select"
import { GuestCustomer, Organization, User } from "@prisma/client"
import { Label } from "@/components/ui/label"


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
export default function DriverOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preparationTime, setPreparationTime] = useState<Dayjs | null>(null)
  const [pickupTime, setPickupTime] = useState<Dayjs | null>(null)
  const [savingPickupTime, setSavingPickupTime] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState<Dayjs | null>(null)
  const [savingDeliveryTime, setSavingDeliveryTime] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const [updating, setUpdating] = useState(false)
  const [filter, setFilter] = useState<"active" | "completed" | "all"> ("active")
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const addToPickupEstimatedEndTime = async (minutes: number) => {
    console.log(`add ${minutes} minutes to pick-up `, pickupTime);
    setPickupTime(pickupTime?.add(minutes, 'minute') || null)
  }
  const addToDeliveryEstimatedEndTime = async (minutes: number) => {
    console.log(`add ${minutes} minutes to pick-up `, deliveryTime);
    setDeliveryTime(deliveryTime?.add(minutes, 'minute') || null)
  }
  
  const handleSavePickupEstimatedEndTime = async (orderId: string , pickupTime?: string) => {
    console.log("saving pickupTime---",pickupTime);
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
      //fetchOrders()
      
    } catch (err) {
      console.error("Error updating order pickupProgress.estimatedEndTime:", err)
      setError(err instanceof Error ? err.message : "Failed to update order pickupProgress.estimatedEndTime")
    } finally {
      setUpdating(false)
    }  
  }

  const handleSaveDeliveryEstimatedEndTime = async (orderId: string, deliveryTime?: string) => {
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
     // fetchOrders()
      
    } catch (err) {
      console.error("Error updating order deliveryProgress.estimatedEndTime:", err)
      setError(err instanceof Error ? err.message : "Failed to update order deliveryProgress.estimatedEndTime")
    } finally {
      setUpdating(false)
    }  
  }

  const handleSaveAllEstimatedEndTimes = async ()=>{
    if (!selectedOrder) return
    handleSavePickupEstimatedEndTime(selectedOrder.id, pickupTime?.toString())
    handleSaveDeliveryEstimatedEndTime(selectedOrder.id, deliveryTime?.toString())
  }
  
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
    if (mounted) {
      fetchOrders()
    }
  }, [mounted, page, searchQuery])

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
      
      const response = await fetch(`/api/orders?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch orders")
      }
      
      const data: OrdersResponse = await response.json()
      console.log("-----------------------OrdersResponse:", data);
      
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

  // Filter orders
  const filteredOrders = orders.filter(order => {
      const b1 = (!order.driverId) && ["ACCEPTED", "PREPARING", "READY"].includes(order.status)
      const b2 = (order.driverId === user?.id)
    if (filter === "active") {
      return (b1 || b2) && ["ACCEPTED", "PREPARING", "READY"].includes(order.status)
    } else if (filter === "completed") {
      return b2 && ["DELIVERED", "CANCELLED"].includes(order.status)
    }
    return b1 || b2
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

  function acceptOrder(id: string) {
    throw new Error("Function not implemented.")
  }

  function denyOrder(id: string): void {
    throw new Error("Function not implemented.")
  }

  function pickupOrder(id: string): void {
    throw new Error("Function not implemented.")
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
            {(user?.role === "CUSTOMER") && <Button className="mt-4">
              <Link href="/">شروع خرید</Link>
            </Button>}
            
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const status = statusConfig[order.status]
            const StatusIcon = status?.icon || AlertCircle
            const orderDate = new Date(order.createdAt)
            
            return (
              <Card key={order.id} className="overflow-hidden" onClick={() => handleViewOrder(order)}>
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
      
      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>جزئیات سفارش {selectedOrder?.orderNumber}</DialogTitle>
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
                        {selectedOrder.guestCustomer?.name && <p>نام کاربر میهمان : {selectedOrder.guestCustomer.name}</p>}
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
                        {selectedOrder.customer?.phone && 
                        <p>تلفن: {selectedOrder.customer.phone}</p>}
      
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
              
              {/* Progress */}
              <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Timer className="h-4 w-4" />
                            زمان های تخمیی
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-1 space-y-2 ">
                      {((pickupTime && !savingPickupTime)) && (
                          <div className="grid gap-0 grid-cols-2 grid-rows-2 ">
                            <div className="row-1 pt-2">
      
                            <Label htmlFor="picklupProgress">پیکاپ:</Label>
                            </div>
                           <div className="row-2 col-1 text-xs">
                            {formatRelativePersianTime(pickupTime)} 
                            </div>
                          <div className="row-span-2">
                      <div className="grid gap-1 grid-cols-3 ">
                      <div className="grid gap-1 grid-rows-2 ">
                        <Button variant={"outline"} onClick={()=> addToPickupEstimatedEndTime(1)}>
                          {toPersianDigits(1)} +
                        </Button>
                        <Button  variant={"outline"} onClick={()=> addToPickupEstimatedEndTime(-1)}>
                          {toPersianDigits(1)} -
                        </Button>
                      </div>
                      <div className="grid gap-1 grid-rows-2">
                      
                      <Button variant={"outline"} onClick={()=> addToPickupEstimatedEndTime(5)}>
                       {toPersianDigits(5)}+
                      </Button>
                      <Button  variant={"outline"} onClick={()=> addToPickupEstimatedEndTime(-5)}>
                         {toPersianDigits(5)}-
                        </Button>
                      </div>
                      <div className="grid gap-1 grid-rows-2 col-3">
                      <Button  variant={"outline"} onClick={()=> addToPickupEstimatedEndTime(10)}>
                      {toPersianDigits(10)}+
                      </Button>
                      <Button  variant={"outline"} onClick={()=> addToPickupEstimatedEndTime(-10)}>
                          {toPersianDigits(10)}-
                        </Button>
                      </div>
                    </div>
                    </div>
                    </div>
                       )}
                      {((user?.role=="DRIVER" || user?.role=="SUPER_ADMIN") && (deliveryTime && !savingDeliveryTime)) && (
                    <div className="grid gap-0 grid-cols-2 grid-rows-2 pt-2">
                      <div className="row-1 pt-2">

                      <Label htmlFor="deliveryProgress">تحویل دهی:</Label>
                      </div>
                      <div className="row-2">
                      
                      {formatRelativePersianTime(deliveryTime)} 
                      </div>
                      <div className="row-span-2">
                        <div className="grid gap-1 grid-cols-3 ">
                          <div className="grid gap-1 grid-rows-2">
                            <Button variant={"outline"} onClick={()=> addToDeliveryEstimatedEndTime(1)}>
                              {toPersianDigits(1)} +
                            </Button>
                            <Button  variant={"outline"} onClick={()=> addToDeliveryEstimatedEndTime(-1)}>
                              {toPersianDigits(1)} -
                            </Button>
                          </div>
                        <div className="grid gap-1 grid-rows-2">
                      <Button variant={"outline"} onClick={()=> addToDeliveryEstimatedEndTime(5)}>
                       {toPersianDigits(5)}+
                      </Button>
                      <Button  variant={"outline"} onClick={()=> addToDeliveryEstimatedEndTime(-5)}>
                         {toPersianDigits(5)}-
                        </Button>
                      </div>
                      <div className="grid gap-1 grid-rows-2">
                      <Button  variant={"outline"} onClick={()=> addToDeliveryEstimatedEndTime(10)}>
                      {toPersianDigits(10)}+
                      </Button>
                      <Button  variant={"outline"} onClick={()=> addToDeliveryEstimatedEndTime(-10)}>
                          {toPersianDigits(10)}-
                        </Button>
                      </div>
                        </div>
                      </div>
                    </div>
                       )}
      
                      </CardContent>
                      <div className="pt-5 px-2">
                        {((selectedOrder.status==="ACCEPTED" || selectedOrder.status==="PREPARING" || selectedOrder.status==="READY") && !selectedOrder.assignedDriver) && 
                        <div className="grid gap-1 grid-cols-3">
                          <Button  className={"col-span-2 bg-green-400 text-green-800"} onClick={() => {
                            acceptOrder(selectedOrder.id)
                            handleSaveAllEstimatedEndTimes()
                            }}>
                           <CheckCircle/> قبول
                          </Button>
                          <Button className={"col-3"} variant={"destructive"} onClick={() => denyOrder(selectedOrder.id)}>
                           <X/> رد
                          </Button>
                        </div>
                        }
                        {((selectedOrder.status==="ACCEPTED" || selectedOrder.status==="PREPARING" || selectedOrder.status==="READY") && (!!selectedOrder.assignedDriver && selectedOrder.assignedDriver.id === user?.id)) && 
                        <div className="grid gap-1 grid-cols-3 ">
                          <Button className={"col-span-2"} onClick={() => {handleSaveAllEstimatedEndTimes()}}>
                            <Save/>  ذخیره 
                          </Button>
                          <Button className={"col-3 bg-green-400 text-green-800"} onClick={() => pickupOrder(selectedOrder.id)}>
                           <CheckCircle/> پیکاپ
                          </Button>
                        </div>}
                        {((selectedOrder.status==="PICKED_UP") && (!!selectedOrder.assignedDriver && selectedOrder.assignedDriver.id === user?.id)) &&
                        <div className="grid gap-1 grid-cols-3 ">
                          <Button className={"col-span-2"} onClick={() => {handleSaveAllEstimatedEndTimes()}}>
                            <Save/>  ذخیره 
                          </Button>
                          <Button className={"col-span-1 bg-green-400 text-green-800"} onClick={() => {handleSaveAllEstimatedEndTimes()}}>
                            <CheckCircle/>  تحویل 
                          </Button>
                        </div>}
                      </div>      
              </Card>
              
            </div>)}
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
