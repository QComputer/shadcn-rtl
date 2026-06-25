"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  UserCheck,
  Star,
  Scissors,
  AlertCircle,
  Loader2,
  CalendarDays,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { useAuth } from "@/hooks/use-auth"
import { formatPersianDate, formatToman, toPersianDigits } from "@/lib/persian"
import { toJalali } from "@/lib/jalali-adapter"

// Types for dashboard data
interface DashboardStats {
  // Common stats
  totalOrders?: number
  totalProducts?: number
  totalCustomers?: number
  totalMembers?: number
  totalOrganizations?: number
  totalUsers?: number
  todayOrders?: number
  todayRevenue?: number
  // Shop specific
  pendingOrders?: number
  processingOrders?: number
  completedOrders?: number
  cancelledOrders?: number
  // Appointment specific
  totalAppointments?: number
  totalServices?: number
  totalServiceCategories?: number
  pendingAppointments?: number
  confirmedAppointments?: number
  completedAppointments?: number
  cancelledAppointments?: number
  todayAppointmentsCount?: number
  // Driver specific
  totalAssignedOrders?: number
  pendingDeliveries?: number
  completedDeliveries?: number
  // Customer specific
  totalSpent?: number
}

interface UserContext {
  role: string
  organizationType: string | null
  organizationId: string | null
  orgMemberRole: string | null
  isTeamMember: boolean
}

interface RecentOrder {
  id: string
  orderNumber?: string
  customer: string
  phone?: string
  items?: number
  total: number
  status: string
  organization?: string
  organizationSlug?: string
  logo?: string
  address?: string
  createdAt: string
}

interface RecentAppointment {
  id: string
  customer: string
  phone?: string
  service: string
  duration?: number
  provider?: string | null
  date: string
  time?: string
  status: string
  organization?: string
  organizationSlug?: string
  logo?: string
  createdAt: string
}


function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    PENDING: "bg-blue-500",
    PROCESSING: "bg-amber-500",
    CONFIRMED: "bg-purple-500",
    DELIVERED: "bg-green-500",
    COMPLETED: "bg-green-500",
    CANCELLED: "bg-red-500",
  };
  return statusColors[status] || "bg-gray-500";
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "جدید",
    PROCESSING: "در حال آماده‌سازی",
    CONFIRMED: "تأیید شده",
    DELIVERED: "تحویل داده شده",
    COMPLETED: "تکمیل شده",
    CANCELLED: "لغو شده",
  };
  return labels[status] || status;
}

export default function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const router = useRouter()
  
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  
  // Dashboard data state
  const [dashboardData, setDashboardData] = useState<{
    title?: string
    organizationType?: string
    stats: DashboardStats
    salesData?: { name: string; sales: number }[]
    ordersByStatus?: { status: string; label: string; count: number; color: string }[]
    appointmentsByStatus?: { status: string; label: string; count: number; color: string }[]
    appointmentsData?: { name: string; count: number }[]
    recentOrders: RecentOrder[]
    recentAppointments: RecentAppointment[]
    todayAppointments?: RecentAppointment[]
    userContext?: UserContext
  } | null>(null)

  const { user, isLoading: authLoading } = useAuth()

  useEffect(() => {
    setMounted(true)
    // Load dictionary client-side
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch dashboard data
  useEffect(() => {
    if (!mounted || authLoading) return

    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch("/api/dashboard")
        
        if (!response.ok) {
          if (response.status === 401) {
            router.push(`/${locale}/login`)
            return
          }
          //throw new Error("Failed to fetch dashboard data")
        }
        
        const data = await response.json()
        setDashboardData(data)
      } catch (err) {
        console.error("Error fetching dashboard:", err)
        setError(err instanceof Error ? err.message: "خطا در دریافت اطلاعات")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [mounted, authLoading, locale, router])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Loading skeleton
  if (!mounted || authLoading || isLoading) {
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
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => window.location.reload()}>
            تلاش مجدد
          </Button>
        </div>
      </div>
    )
  }

  const userContext = dashboardData?.userContext
  const isShopOrg = dashboardData?.organizationType === "SHOP"
  const isAppointmentOrg = dashboardData?.organizationType === "APPOINTMENT"
  const isSuperAdmin = userContext?.role === "SUPER_ADMIN"
  const isCustomer = userContext?.role === "CUSTOMER"
  const isDriver = userContext?.role === "DRIVER"

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20 lg:pb-0">
        <div className="p-4 lg:p-6 space-y-6">
          {/* Welcome Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                {dashboardData?.title || t("auth.welcomeBack") || "خوش آمدید"}
              </h2>
              <p className="text-muted-foreground">
                {new Date().toLocaleDateString("fa", { 
                  year: "numeric", 
                  month: "long", 
                  day: "numeric",
                  weekday: "long"
                })}
              </p>
            </div>
            {/* Action buttons based on role */}
            {isShopOrg && !isCustomer && !isDriver && (
              <div className="flex gap-2">
                <Link href={`/${locale}/dashboard/orders`}>
                  <Button className="min-h-[44px] min-w-[44px]" aria-label="سفارش جدید">
                    <ShoppingBag className="h-5 w-5 rtl:ml-2" />
                    <span className="hidden sm:inline">{t("navigation.orders") || "سفارش‌ها"}</span>
                  </Button>
                </Link>
              </div>
            )}
            {isAppointmentOrg && !isCustomer && (
              <div className="flex gap-2">
                <Link href={`/${locale}/dashboard/appointments`}>
                  <Button className="min-h-[44px] min-w-[44px]" aria-label=" appointments">
                    <Calendar className="h-5 w-5 rtl:ml-2" />
                    <span className="hidden sm:inline">{t("navigation.appointments") || "نوبت‌ها"}</span>
                  </Button>
                </Link>
              </div>
            )}
            {isCustomer && (
              <div className="flex gap-2">
<Link href={`/${locale}/appointment`}>
                       <Button className="min-h-[44px] min-w-[44px]" aria-label=" organizations">
                         <ShoppingBag className="h-5 w-5 rtl:ml-2" />
                         <span className="hidden sm:inline">سازمان‌ها</span>
                       </Button>
                     </Link>
              </div>
            )}
          </div>

          {/* Stats Cards - Role appropriate */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* SHOP Organization Stats */}
            {isShopOrg && !isCustomer && !isDriver && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("dashboard.todaySales") || "فروش امروز"}
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatToman(dashboardData?.stats.todayRevenue)}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <span>{toPersianDigits(dashboardData?.stats.todayOrders?.toString() || "۰")}</span>
                      <span>{t("navigation.orders") || "سفارش"}</span>
                    </p>
                  </CardContent>
                </Card>

                <Link href={`/${locale}/dashboard/orders`}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("navigation.orders") || "سفارش‌ها"}
                    </CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalOrders?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <span className="text-amber-500">{toPersianDigits(dashboardData?.stats.pendingOrders?.toString() || "۰")}</span>
                      <span>در انتظار</span>
                    </p>
                  </CardContent>
                </Card>
                </Link>

                <Link href={`/${locale}/dashboard/products`}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("navigation.products") || "محصولات"}
                    </CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>

                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalProducts?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("navigation.products") || "محصولات"}: {toPersianDigits(dashboardData?.stats.totalProducts?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>
                </Link>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("organization.members") || "اعضا"}
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalMembers?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("organization.activeMembers") || "فعال"}: {toPersianDigits(dashboardData?.stats.totalMembers?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* APPOINTMENT Organization Stats */}
            {isAppointmentOrg && !isCustomer && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      نوبت‌های امروز
                    </CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.todayAppointmentsCount?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("appointment.pending") || "در انتظار"}: {toPersianDigits(dashboardData?.stats.pendingAppointments?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("navigation.appointments") || "نوبت‌ها"}
                    </CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalAppointments?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("appointment.completed") || "تکمیل شده"}: {toPersianDigits(dashboardData?.stats.completedAppointments?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("navigation.services") || "خدمات"}
                    </CardTitle>
                    <Scissors className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalServices?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("service.categories") || "دسته‌بندی"}: {toPersianDigits(dashboardData?.stats.totalServiceCategories?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("organization.members") || "اعضا"}
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalMembers?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("appointment.confirmed") || "تأیید شده"}: {toPersianDigits(dashboardData?.stats.confirmedAppointments?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* CUSTOMER Stats */}
            {isCustomer && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("navigation.orders") || "سفارش‌ها"}
                    </CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalOrders?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <span className="text-amber-500">{toPersianDigits(dashboardData?.stats.pendingOrders?.toString() || "۰")}</span>
                      <span>در انتظار</span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("navigation.appointments") || "نوبت‌ها"}
                    </CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalAppointments?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span>{toPersianDigits(dashboardData?.stats.pendingAppointments?.toString() || "۰")}</span>
                      <span> در انتظار</span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      مبلغ خرید
                    </CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatToman(dashboardData?.stats.totalSpent)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("dashboard.completedOrders") || "تکمیل شده"}: {toPersianDigits(dashboardData?.stats.completedOrders?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("appointment.completed") || "نوبت‌های تکمیل شده"}
                    </CardTitle>
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.completedAppointments?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      نوبت‌های فعال: {toPersianDigits(dashboardData?.stats.pendingAppointments?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* DRIVER Stats */}
            {isDriver && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      سفارش‌های من
                    </CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalAssignedOrders?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      تحویل داده شده: {toPersianDigits(dashboardData?.stats.completedDeliveries?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      در انتظار تحویل
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.pendingDeliveries?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      سفارش فعال
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {/* SUPER_ADMIN Stats */}
            {isSuperAdmin && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      سازمان‌ها
                    </CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalOrganizations?.toString() || dashboardData?.stats.totalMembers?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      کل سفارش‌ها: {toPersianDigits(dashboardData?.stats.totalOrders?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      کاربران
                    </CardTitle>
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalUsers?.toString() || dashboardData?.stats.totalCustomers?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      کل نوبت‌ها: {toPersianDigits(dashboardData?.stats.totalAppointments?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      سفارش‌های امروز
                    </CardTitle>
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.todayOrders?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      نوبت‌های امروز: {toPersianDigits(dashboardData?.stats.todayAppointmentsCount?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      نوبت‌ها
                    </CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{toPersianDigits(dashboardData?.stats.totalAppointments?.toString() || "۰")}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      کل سفارش‌ها: {toPersianDigits(dashboardData?.stats.totalOrders?.toString() || "۰")}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Charts Section - SHOP */}
          {isShopOrg && !isCustomer && !isDriver && dashboardData?.salesData && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Sales Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t("dashboard.weeklySales") || "فروش هفتگی"}</CardTitle>
                  <CardDescription>{t("dashboard.salesAmountInToman") || "مبلغ فروش به تومان"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboardData.salesData}
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
              {dashboardData.ordersByStatus && dashboardData.ordersByStatus.length > 0 && (
               <Link href={`/${locale}/dashboard/orders`}>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("dashboard.ordersByStatus") || "سفارش‌ها بر اساس وضعیت"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardData.ordersByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="count"
                          >
                            {dashboardData.ordersByStatus.map((entry, index) => (
                              <Cell key={locale+`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {dashboardData.ordersByStatus.map((status) => (
                        <div key={locale+status.status} className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {status.label} ({toPersianDigits(status.count.toString())})
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                </Link>
              )}

              {/* Recent Orders */}
              {dashboardData.recentOrders && dashboardData.recentOrders.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>{t("dashboard.recentOrders") || "سفارش‌های اخیر"}</CardTitle>
                    <Link href={`/${locale}/dashboard/orders`}>
                      <Button variant="ghost" size="sm">
                        {t("common.viewAll") || "مشاهده همه"}
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentOrders.slice(0, 5).map((order) => (
                        <div key={locale+order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{order.customer}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.items ? `${order.items} عدد محصول` : order.orderNumber}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{formatToman(order.total)}</p>
                            <Badge variant={order.status === "PENDING" ? "default" : "secondary"} className="mt-1">
                              {getStatusLabel(order.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Charts Section - APPOINTMENT */}
          {isAppointmentOrg && !isCustomer && dashboardData?.appointmentsData && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Appointments Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>نوبت‌های هفتگی</CardTitle>
                  <CardDescription>تعداد نوبت‌ها در هر روز</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dashboardData.appointmentsData}
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
                          tickFormatter={(value) => toPersianDigits(value.toString())}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                          }}
                          formatter={(value) => [toPersianDigits(String(value || 0)), "نوبت"]}
                        />
                        <Bar
                          dataKey="count"
                          fill="var(--primary)"
                          radius={[4, 4, 0, 0]}
                          name="نوبت"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Appointments by Status */}
              {dashboardData.appointmentsByStatus && dashboardData.appointmentsByStatus.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>نوبت‌ها بر اساس وضعیت</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboardData.appointmentsByStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="count"
                          >
                            {dashboardData.appointmentsByStatus.map((entry, index) => (
                              <Cell key={locale+`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {dashboardData.appointmentsByStatus.map((status) => (
                        <div key={locale+status.status} className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {status.label} ({toPersianDigits(status.count.toString())})
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Today's Appointments */}
              {dashboardData.todayAppointments && dashboardData.todayAppointments.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>نوبت‌های امروز</CardTitle>
                    <Link href={`/${locale}/dashboard/appointments`}>
                      <Button variant="ghost" size="sm">
                        {t("common.viewAll") || "مشاهده همه"}
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.todayAppointments.slice(0, 5).map((apt) => (
                        <div key={locale+apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{apt.customer}</p>
                            <p className="text-xs text-muted-foreground">
                              {apt.service} {apt.time && `- ${toJalali(apt.time)}`}
                            </p>
                          </div>
                          <div className="text-left">
                            <Badge variant={apt.status === "CONFIRMED" ? "default" : "secondary"} className="mt-1">
                              {getStatusLabel(apt.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Appointments */}
              {dashboardData.recentAppointments && dashboardData.recentAppointments.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>{t("dashboard.recentAppointments") || "نوبت‌های اخیر"}</CardTitle>
                    <Link href={`/${locale}/dashboard/appointments`}>
                      <Button variant="ghost" size="sm">
                        {t("common.viewAll") || "مشاهده همه"}
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentAppointments.slice(0, 5).map((apt) => (
                        <div key={locale+apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{apt.customer}</p>
                            <p className="text-xs text-muted-foreground">
                              {apt.service} {apt.provider && `- ${apt.provider}`}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-sm">{formatPersianDate(apt.date)}</p>
                            <Badge variant={apt.status === "CONFIRMED" ? "default" : "secondary"} className="mt-1">
                              {getStatusLabel(apt.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* CUSTOMER View - Orders and Appointments */}
          {isCustomer && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Orders */}
              {dashboardData?.recentOrders && dashboardData.recentOrders.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>{t("dashboard.recentOrders") || "سفارش‌های اخیر"}</CardTitle>
                    <Link href={`/${locale}/dashboard/my-orders`}>
                      <Button variant="ghost" size="sm">
                        {t("common.viewAll") || "مشاهده همه"}
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentOrders.slice(0, 5).map((order) => (
                        <div key={locale+order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{order.organization}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.items ? `${order.items} عدد محصول` : order.orderNumber}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{formatToman(order.total)}</p>
                            <Badge variant={order.status === "PENDING" ? "default" : "secondary"} className="mt-1">
                              {getStatusLabel(order.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Appointments */}
              {dashboardData?.recentAppointments && dashboardData.recentAppointments.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>{t("dashboard.recentAppointments") || "نوبت‌های اخیر"}</CardTitle>
                    <Link href={`/${locale}/dashboard/my-appointments`}>
                      <Button variant="ghost" size="sm">
                        {t("common.viewAll") || "مشاهده همه"}
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentAppointments.slice(0, 5).map((apt) => (
                        <div key={locale+apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{apt.organization}</p>
                            <p className="text-xs text-muted-foreground">
                              {apt.service} {apt.provider && `- ${apt.provider}`}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-sm">{formatPersianDate(apt.date)}</p>
                            <Badge variant={apt.status === "CONFIRMED" ? "default" : "secondary"} className="mt-1">
                              {getStatusLabel(apt.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Empty state for customer */}
              {(!dashboardData?.recentOrders || dashboardData.recentOrders.length === 0) && 
               (!dashboardData?.recentAppointments || dashboardData.recentAppointments.length === 0) && (
                <Card className="lg:col-span-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-lg mb-4">سفارش یا نوبتی ندارید</p>
                    <div className="flex gap-4">
<Link href={`/${locale}/appointment`}>
                         <Button>مشاهده سازمان‌ها</Button>
                       </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* DRIVER View */}
          {isDriver && (
            <div className="grid gap-6">
              {dashboardData?.recentOrders && dashboardData.recentOrders.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>سفارش‌های اخیر</CardTitle>
                    <Link href={`/${locale}/dashboard/driver-orders`}>
                      <Button variant="ghost" size="sm">
                        {t("common.viewAll") || "مشاهده همه"}
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentOrders.slice(0, 5).map((order) => (
                        <div key={locale+order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{order.customer}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.organization} {order.address && `- ${order.address}`}
                            </p>
                            {order.phone && <p className="text-xs text-muted-foreground">{order.phone}</p>}
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{formatToman(order.total)}</p>
                            <Badge variant={order.status === "PROCESSING" ? "default" : "secondary"} className="mt-1">
                              {getStatusLabel(order.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!dashboardData?.recentOrders || dashboardData.recentOrders.length === 0) && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-lg">سفارشی به شما اختصاص داده نشده است</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* SUPER_ADMIN View */}
          {isSuperAdmin && (
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Orders */}
              {dashboardData?.recentOrders && dashboardData.recentOrders.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>سفارش‌های اخیر</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentOrders.slice(0, 5).map((order) => (
                        <div key={locale+order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{order.customer}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.organization}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{formatToman(order.total)}</p>
                            <Badge variant="secondary" className="mt-1">
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Appointments */}
              {dashboardData?.recentAppointments && dashboardData.recentAppointments.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>نوبت‌های اخیر</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboardData.recentAppointments.slice(0, 5).map((apt) => (
                        <div key={locale+apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{apt.customer}</p>
                            <p className="text-xs text-muted-foreground">
                              {apt.service}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-sm">{formatPersianDate(apt.date)}</p>
                            <Badge variant="secondary" className="mt-1">
                              {apt.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
