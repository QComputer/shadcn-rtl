"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Calendar,
  Users,
  Settings,
  Menu,
  Bell,
  Search,
  Filter,
  MoreVertical,
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  X,
  Loader2,
  ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatToman, toPersianDigits, formatPersianDate, formatRelativePersianDate } from "@/lib/persian"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"

// Types
type OrderStatus = "جدید" | "در حال آماده‌سازی" | "آماده" | "تحویل داده شده" | "لغو شده"
type OrderType = "DELIVERY" | "PICK_UP"

interface Order {
  id: string
  orderNumber: string
  customer: {
    name: string
    phone: string
  }
  items: { name: string; quantity: number }[]
  total: number
  status: OrderStatus
  type: OrderType
  createdAt: Date
  deliveryAddress?: string
}

// Sample data
const sampleOrders: Order[] = [
  {
    id: "1",
    orderNumber: "ORD-۱۴۰۴/۰۱",
    customer: { name: "علی محمدی", phone: "۰۹۱۲۳۴۵۶۷۸۹" },
    items: [
      { name: "گوشی موبایل", quantity: 1 },
      { name: "قاب گوشی", quantity: 2 },
    ],
    total: 15000000,
    status: "جدید",
    type: "DELIVERY",
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    deliveryAddress: "تهران، خیابان ولیعصر، پلاک ۱",
  },
  {
    id: "2",
    orderNumber: "ORD-۱۴۰۴/۰۲",
    customer: { name: "سارا احمدی", phone: "۰۹۱۲۳۴۵۶۷۸۸" },
    items: [{ name: "لپ تاپ", quantity: 1 }],
    total: 25000000,
    status: "آماده",
    type: "PICK_UP",
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
  },
  {
    id: "3",
    orderNumber: "ORD-۱۴۰۴/۰۳",
    customer: { name: "محمد رضایی", phone: "۰۹۱۲۳۴۵۶۷۸۷" },
    items: [
      { name: "هدفون", quantity: 1 },
      { name: "شارژر", quantity: 1 },
    ],
    total: 3200000,
    status: "تحویل داده شده",
    type: "DELIVERY",
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    deliveryAddress: "تهران، خیابان انقلاب، پلاک ۵",
  },
  {
    id: "4",
    orderNumber: "ORD-۱۴۰۴/۰۴",
    customer: { name: "مریم کاظمی", phone: "۰۹۱۲۳۴۵۶۷۸۶" },
    items: [{ name: "تبلت", quantity: 1 }],
    total: 8500000,
    status: "در حال آماده‌سازی",
    type: "DELIVERY",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    deliveryAddress: "تهران، خیابان شریعتی، پلاک ۱۰",
  },
  {
    id: "5",
    orderNumber: "ORD-۱۴۰۴/۰۵",
    customer: { name: "احمد حسنی", phone: "۰۹۱۲۳۴۵۶۷۸۵" },
    items: [{ name: "ساعت هوشمند", quantity: 1 }],
    total: 4500000,
    status: "لغو شده",
    type: "DELIVERY",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    deliveryAddress: "تهران، خیابان آزادی، پلاک ۲۰",
  },
]

// Navigation
const navItems = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, href: "/dashboard" },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingCart, href: "/dashboard/orders", active: true },
  { id: "products", label: "محصولات", icon: Package, href: "/dashboard/products" },
  { id: "appointments", label: "نوبت‌ها", icon: Calendar, href: "/dashboard/appointments" },
  { id: "customers", label: "مشتریان", icon: Users, href: "/dashboard/customers" },
  { id: "settings", label: "تنظیمات", icon: Settings, href: "/dashboard/settings" },
]

const statusColors: Record<OrderStatus, string> = {
  "جدید": "bg-blue-500",
  "در حال آماده‌سازی": "bg-amber-500",
  "آماده": "bg-purple-500",
  "تحویل داده شده": "bg-green-500",
  "لغو شده": "bg-red-500",
}

const statusOptions: OrderStatus[] = ["جدید", "در حال آماده‌سازی", "آماده", "تحویل داده شده", "لغو شده"]

export default function OrdersPage() {
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>(sampleOrders)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter and sort orders
  const filteredOrders = orders
    .filter((order) => {
      const matchesSearch =
        order.orderNumber.includes(searchQuery) ||
        order.customer.name.includes(searchQuery) ||
        order.customer.phone.includes(searchQuery)
      const matchesStatus = statusFilter === "all" || order.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.createdAt.getTime() - a.createdAt.getTime()
        case "oldest":
          return a.createdAt.getTime() - b.createdAt.getTime()
        case "highest":
          return b.total - a.total
        case "lowest":
          return a.total - b.total
        default:
          return 0
      }
    })

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id))
    }
  }

  const handleSelectOrder = (id: string) => {
    setSelectedOrders((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    )
  }

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    setSelectedOrders((prev) => prev.filter((id) => id !== orderId))
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="منو"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>منو</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] py-4">
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                        item.active
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          <h1 className="text-lg font-semibold">سفارش‌ها</h1>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="اعلانات">
              <Bell className="h-5 w-5" />
            </Button>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 lg:w-64 lg:border-l lg:bg-background">
          <div className="flex items-center gap-2 p-6 border-b">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-lg font-semibold">پنل مدیریت</span>
          </div>
          <ScrollArea className="flex-1 p-4">
            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                    item.active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:pr-64 pb-20 lg:pb-0">
          <div className="p-4 lg:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">سفارش‌ها</h2>
                <p className="text-muted-foreground">
                  {toPersianDigits(filteredOrders.length)} سفارش
                </p>
              </div>
              <Button className="min-h-[44px]">
                <Plus className="ml-2 h-4 w-4" />
                سفارش جدید
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="جستجو در سفارش‌ها..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="فیلتر وضعیت" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="مرتب‌سازی" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">جدیدترین</SelectItem>
                      <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
                      <SelectItem value="highest">بیشترین مبلغ</SelectItem>
                      <SelectItem value="lowest">کمترین مبلغ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-4 text-right">
                          <Checkbox
                            checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="p-4 text-right text-sm font-medium">شماره سفارش</th>
                        <th className="p-4 text-right text-sm font-medium">مشتری</th>
                        <th className="p-4 text-right text-sm font-medium">محصولات</th>
                        <th className="p-4 text-right text-sm font-medium">مبلغ</th>
                        <th className="p-4 text-right text-sm font-medium">وضعیت</th>
                        <th className="p-4 text-right text-sm font-medium">زمان</th>
                        <th className="p-4 text-right text-sm font-medium">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filteredOrders.map((order, index) => (
                          <motion.tr
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-b hover:bg-muted/50 transition-colors"
                          >
                            <td className="p-4">
                              <Checkbox
                                checked={selectedOrders.includes(order.id)}
                                onCheckedChange={() => handleSelectOrder(order.id)}
                              />
                            </td>
                            <td className="p-4">
                              <span className="font-mono text-sm">{order.orderNumber}</span>
                            </td>
                            <td className="p-4">
                              <div>
                                <p className="font-medium">{order.customer.name}</p>
                                <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
                              </div>
                            </td>
                            <td className="p-4">
                              <p className="text-sm">
                                {order.items.map((i) => `${i.name} (${toPersianDigits(i.quantity)})`).join("، ")}
                              </p>
                            </td>
                            <td className="p-4">
                              <span className="font-medium">{formatToman(order.total)}</span>
                            </td>
                            <td className="p-4">
                              <Select
                                value={order.status}
                                onValueChange={(v) => handleStatusChange(order.id, v as OrderStatus)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <Badge className={cn("ml-2 h-2 w-2 rounded-full", statusColors[order.status])} />
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {statusOptions.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      <div className="flex items-center gap-2">
                                        <span className={cn("h-2 w-2 rounded-full", statusColors[status])} />
                                        {status}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-muted-foreground">
                                {formatRelativePersianDate(order.createdAt)}
                              </span>
                            </td>
                            <td className="p-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>عملیات</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedOrder(order)
                                    setIsDetailsOpen(true)
                                  }}>
                                    <Eye className="ml-2 h-4 w-4" />
                                    مشاهده جزئیات
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Edit className="ml-2 h-4 w-4" />
                                    ویرایش
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteOrder(order.id)}
                                  >
                                    <Trash2 className="ml-2 h-4 w-4" />
                                    حذف
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>

                {filteredOrders.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-muted-foreground">سفارشی یافت نشد</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                نمایش {toPersianDigits(1)} تا {toPersianDigits(filteredOrders.length)} از {toPersianDigits(filteredOrders.length)} سفارش
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="min-w-[40px]">
                  {toPersianDigits(1)}
                </Button>
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Order Details Sheet */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>جزئیات سفارش</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">شماره سفارش</span>
                  <span className="font-mono">{selectedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">مشتری</span>
                  <span>{selectedOrder.customer.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">تلفن</span>
                  <span>{selectedOrder.customer.phone}</span>
                </div>
                {selectedOrder.deliveryAddress && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">آدرس</span>
                    <span className="text-right max-w-[200px]">{selectedOrder.deliveryAddress}</span>
                  </div>
                )}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">محصولات</h4>
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between py-2">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">x{toPersianDigits(item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-4 flex justify-between items-center text-lg font-bold">
                  <span>جمع کل</span>
                  <span>{formatToman(selectedOrder.total)}</span>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
