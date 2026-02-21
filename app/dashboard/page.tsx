"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  LayoutDashboard,
  ShoppingCart,
  Calendar,
  Users,
  Package,
  Settings,
  Menu,
  X,
  Home,
  Search,
  Bell,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  UserCheck,
  Star,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatPersianDate,
  formatRelativePersianDate,
  formatToman,
  toPersianDigits,
  formatNumber,
} from "@/lib/persian"

// Mock data for dashboard metrics
const salesData = [
  { name: "شنبه", sales: toPersianDigits("۴۵۰۰۰۰۰") },
  { name: "یکشنبه", sales: toPersianDigits("۵۲۰۰۰۰۰") },
  { name: "دوشنبه", sales: toPersianDigits("۳۸۰۰۰۰۰") },
  { name: "سه‌شنبه", sales: toPersianDigits("۶۱۰۰۰۰۰") },
  { name: "چهارشنبه", sales: toPersianDigits("۵۵۰۰۰۰۰") },
  { name: "پنج‌شنبه", sales: toPersianDigits("۷۲۰۰۰۰۰") },
  { name: "جمعه", sales: toPersianDigits("۴۸۰۰۰۰۰") },
]

const ordersByStatus = [
  { name: "جدید", value: 12, color: "#3b82f6" },
  { name: "در حال آماده‌سازی", value: 8, color: "#f59e0b" },
  { name: "آماده", value: 5, color: "#8b5cf6" },
  { name: "تحویل داده شده", value: 45, color: "#22c55e" },
  { name: "لغو شده", value: 3, color: "#ef4444" },
]

const recentOrders = [
  {
    id: "ORD-001",
    customer: "علی محمدی",
    items: "۲ عدد محصول",
    total: "۱,۵۰۰,۰۰۰",
    status: "جدید",
    time: "۵ دقیقه پیش",
  },
  {
    id: "ORD-002",
    customer: "سارا احمدی",
    items: "۱ عدد محصول",
    total: "۸۵۰,۰۰۰",
    status: "آماده",
    time: "۱۵ دقیقه پیش",
  },
  {
    id: "ORD-003",
    customer: "محمد رضایی",
    items: "۳ عدد محصول",
    total: "۲,۲۰۰,۰۰۰",
    status: "تحویل داده شده",
    time: "۱ ساعت پیش",
  },
  {
    id: "ORD-004",
    customer: "مریم کاظمی",
    items: "۱ عدد محصول",
    total: "۴۵۰,۰۰۰",
    status: "در حال آماده‌سازی",
    time: "۲ ساعت پیش",
  },
]

const recentActivities = [
  { id: 1, text: "سفارش جدید از علی محمدی دریافت شد", time: "۵ دقیقه پیش", type: "order" },
  { id: 2, text: "نظر جدید برای فروشگاه ثبت شد", time: "۳۰ دقیقه پیش", type: "review" },
  { id: 3, text: "کاربر جدید در سیستم ثبت‌نام کرد", time: "۱ ساعت پیش", type: "user" },
  { id: 4, text: " موجودی محصول به‌روزرسانی شد", time: "۲ ساعت پیش", type: "product" },
  { id: 5, text: "پرداخت موفقیت‌آمیز انجام شد", time: "۳ ساعت پیش", type: "payment" },
]

// Navigation items
const navItems = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, href: "/dashboard" },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingCart, href: "/dashboard/orders" },
  { id: "products", label: "محصولات", icon: Package, href: "/dashboard/products" },
  { id: "appointments", label: "نوبت‌ها", icon: Calendar, href: "/dashboard/appointments" },
  { id: "customers", label: "مشتریان", icon: Users, href: "/dashboard/customers" },
  { id: "settings", label: "تنظیمات", icon: Settings, href: "/dashboard/settings" },
]

// Bottom navigation items for mobile
const bottomNavItems = [
  { id: "home", label: "خانه", icon: Home, href: "/dashboard" },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingCart, href: "/dashboard/orders" },
  { id: "add", label: "افزودن", icon: Plus, href: "/dashboard/new", isAction: true },
  { id: "search", label: "جستجو", icon: Search, href: "/dashboard/search" },
  { id: "profile", label: "پروفایل", icon: UserCheck, href: "/dashboard/profile" },
]

// Simple Plus icon component
function Plus({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Disable animations for users who prefer reduced motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
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
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
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

          <h1 className="text-lg font-semibold">داشبورد</h1>

          <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="اعلانات"
              aria-expanded={isNotificationsOpen}
              aria-haspopup="true"
              className="rounded-full"
              onClick={() => setIsNotificationsOpen(true)}
            >
              <Bell className="h-5 w-5" />
            </Button>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>اعلانات</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="font-medium">سفارش جدید</span>
                <span className="text-xs text-muted-foreground">سفارش جدید از علی محمدی</span>
                <span className="text-xs text-muted-foreground">۵ دقیقه پیش</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="font-medium">نظر جدید</span>
                <span className="text-xs text-muted-foreground">نظر ۵ ستاره از کاربر</span>
                <span className="text-xs text-muted-foreground">۱ ساعت پیش</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar - Hidden on mobile */}
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
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </ScrollArea>
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/placeholder-avatar.jpg" alt="用户头像" />
                <AvatarFallback>آ</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">مدیر فروشگاه</p>
                <p className="text-xs text-muted-foreground truncate">admin@store.com</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:pr-64 pb-20 lg:pb-0">
          <div className="p-4 lg:p-6 space-y-6">
            {/* Welcome Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">خوش آمدید</h2>
                <p className="text-muted-foreground">
                  {formatPersianDate(new Date(), "full")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button className="min-h-[44px] min-w-[44px]" aria-label="新建订单">
                  <Plus className="h-5 w-5 rtl:ml-2" />
                  <span className="hidden sm:inline">سفارش جدید</span>
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Today's Sales */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    فروش امروز
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatToman(12500000)}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">۱۲٪+</span>
                    <span>نسبت به دیروز</span>
                  </p>
                </CardContent>
              </Card>

              {/* Orders */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    سفارش‌ها
                  </CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{toPersianDigits("۷۳")}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">۸٪+</span>
                    <span>نسبت به هفته قبل</span>
                  </p>
                </CardContent>
              </Card>

              {/* Customers */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    مشتریان
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{toPersianDigits("۱,۲۵۰")}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">۲۳٪+</span>
                    <span>نسبت به ماه قبل</span>
                  </p>
                </CardContent>
              </Card>

              {/* Rating */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    امتیاز
                  </CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{toPersianDigits("۴.۸")}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">۰.۲-</span>
                    <span>نسبت به هفته قبل</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Sales Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>فروش هفتگی</CardTitle>
                  <CardDescription>مبلغ فروش به تومان</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={salesData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                          tickFormatter={(value) => toPersianDigits((Number(value) / 1000000).toFixed(0) + "M")}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                          }}
                          formatter={(value) => [formatToman(Number(value) || 0), "فروش"]}
                        />
                        <Bar
                          dataKey="sales"
                          fill="var(--primary)"
                          radius={[4, 4, 0, 0]}
                          name="فروش"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Orders by Status */}
              <Card>
                <CardHeader>
                  <CardTitle>سفارش‌ها بر اساس وضعیت</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ordersByStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {ordersByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {ordersByStatus.map((status) => (
                      <div key={status.name} className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {status.name} ({toPersianDigits(status.value.toString())})
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>سفارش‌های اخیر</CardTitle>
                  <Link href="/dashboard/orders">
                    <Button variant="ghost" size="sm">
                      مشاهده همه
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-4">
                      {recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer min-h-[44px]"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{order.customer}</span>
                              <Badge
                                variant={
                                  order.status === "جدید"
                                    ? "default"
                                    : order.status === "آماده"
                                    ? "secondary"
                                    : order.status === "تحویل داده شده"
                                    ? "outline"
                                    : "destructive"
                                }
                                className="text-xs"
                              >
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {order.items} • {formatToman(Number(order.total.replace(/,/g, "")))}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {order.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>فعالیت‌های اخیر</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                          activity.type === "order" && "bg-blue-100 dark:bg-blue-900",
                          activity.type === "review" && "bg-yellow-100 dark:bg-yellow-900",
                          activity.type === "user" && "bg-green-100 dark:bg-green-900",
                          activity.type === "product" && "bg-purple-100 dark:bg-purple-900",
                          activity.type === "payment" && "bg-green-100 dark:bg-green-900"
                        )}
                      >
                        {activity.type === "order" && <ShoppingCart className="h-4 w-4 text-blue-600" />}
                        {activity.type === "review" && <Star className="h-4 w-4 text-yellow-600" />}
                        {activity.type === "user" && <Users className="h-4 w-4 text-green-600" />}
                        {activity.type === "product" && <Package className="h-4 w-4 text-purple-600" />}
                        {activity.type === "payment" && <DollarSign className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Bottom Navigation for Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-[44px] min-h-[44px]",
                item.isAction && "text-primary"
              )}
              aria-label={item.label}
            >
              {item.isAction ? (
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center -mt-5">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
              ) : (
                <>
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs mt-1">{item.label}</span>
                </>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
