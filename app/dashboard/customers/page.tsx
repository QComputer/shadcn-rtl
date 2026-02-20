"use client"

import { useState, useEffect } from "react"
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
  Plus,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  ShoppingBag,
  CreditCard,
  CalendarDays,
  MessageSquare,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toPersianDigits, formatPersianDate, formatRelativePersianDate, formatToman } from "@/lib/persian"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

type CustomerStatus = "فعال" | "غیرفعال"

interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address?: string
  avatar?: string
  totalOrders: number
  totalSpent: number
  joinDate: Date
  lastOrder: Date | null
  status: CustomerStatus
}

interface Order {
  id: string
  orderNumber: string
  date: Date
  total: number
  status: string
}

// Sample data
const sampleCustomers: Customer[] = [
  {
    id: "1",
    firstName: "علی",
    lastName: "محمدی",
    email: "ali@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۹",
    address: "تهران، خیابان ولیعصر، پلاک ۱",
    totalOrders: 12,
    totalSpent: 45000000,
    joinDate: new Date("2024-01-15"),
    lastOrder: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "فعال",
  },
  {
    id: "2",
    firstName: "سارا",
    lastName: "احمدی",
    email: "sara@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۸",
    address: "تهران، خیابان انقلاب، پلاک ۵",
    totalOrders: 8,
    totalSpent: 28000000,
    joinDate: new Date("2024-03-20"),
    lastOrder: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: "فعال",
  },
  {
    id: "3",
    firstName: "محمد",
    lastName: "رضایی",
    email: "mohammad@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۷",
    address: "تهران، خیابان شریعتی، پلاک ۱۰",
    totalOrders: 25,
    totalSpent: 85000000,
    joinDate: new Date("2023-11-10"),
    lastOrder: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "فعال",
  },
  {
    id: "4",
    firstName: "مریم",
    lastName: "کاظمی",
    email: "maryam@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۶",
    address: "تهران، خیابان آزادی، پلاک ۲۰",
    totalOrders: 3,
    totalSpent: 5200000,
    joinDate: new Date("2024-06-01"),
    lastOrder: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    status: "غیرفعال",
  },
  {
    id: "5",
    firstName: "احمد",
    lastName: "حسنی",
    email: "ahmad@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۵",
    address: "تهران، خیابان مدرس، پلاک ۸",
    totalOrders: 18,
    totalSpent: 62000000,
    joinDate: new Date("2024-02-28"),
    lastOrder: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    status: "فعال",
  },
  {
    id: "6",
    firstName: "زهرا",
    lastName: "علوی",
    email: "zahra@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۴",
    address: "تهران، خیابان پاسداران، پلاک ۳",
    totalOrders: 42,
    totalSpent: 156000000,
    joinDate: new Date("2023-05-15"),
    lastOrder: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: "فعال",
  },
  {
    id: "7",
    firstName: "حمید",
    lastName: "رضایی",
    email: "hamid@example.com",
    phone: "۰۹۱۲۳۴۵۶۷۸۳",
    address: "تهران، خیابان نیاوران، پلاک ۱۲",
    totalOrders: 6,
    totalSpent: 12500000,
    joinDate: new Date("2024-04-10"),
    lastOrder: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    status: "غیرفعال",
  },
]

// Sample orders for customer details
const sampleOrders: Order[] = [
  { id: "1", orderNumber: "ORD-۱۴۰۴/۰۱", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), total: 15000000, status: "تحویل داده شده" },
  { id: "2", orderNumber: "ORD-۱۴۰۴/۰۲", date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), total: 8500000, status: "تحویل داده شده" },
  { id: "3", orderNumber: "ORD-۱۴۰۴/۰۳", date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), total: 21500000, status: "تحویل داده شده" },
]

const navItems = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, href: "/dashboard" },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingCart, href: "/dashboard/orders" },
  { id: "products", label: "محصولات", icon: Package, href: "/dashboard/products" },
  { id: "appointments", label: "نوبت‌ها", icon: Calendar, href: "/dashboard/appointments" },
  { id: "customers", label: "مشتریان", icon: Users, href: "/dashboard/customers", active: true },
  { id: "settings", label: "تنظیمات", icon: Settings, href: "/dashboard/settings" },
]

export default function CustomersPage() {
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>(sampleCustomers)
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("همه")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  
  // Detail sheet states
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [detailsTab, setDetailsTab] = useState<"info" | "orders" | "activity">("info")
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Filter and sort customers
  const filteredCustomers = customers
    .filter((customer) => {
      const fullName = `${customer.firstName} ${customer.lastName}`
      const matchesSearch =
        fullName.includes(searchQuery) ||
        customer.email.includes(searchQuery) ||
        customer.phone.includes(searchQuery)
      const matchesStatus = statusFilter === "همه" || customer.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.joinDate.getTime() - a.joinDate.getTime()
        case "oldest":
          return a.joinDate.getTime() - b.joinDate.getTime()
        case "orders":
          return b.totalOrders - a.totalOrders
        case "spent":
          return b.totalSpent - a.totalSpent
        default:
          return 0
      }
    })

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage)
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleSelectAll = () => {
    if (selectedCustomers.length === paginatedCustomers.length) {
      setSelectedCustomers([])
    } else {
      setSelectedCustomers(paginatedCustomers.map((c) => c.id))
    }
  }

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsDetailsOpen(true)
    setDetailsTab("info")
  }

  const handleDeleteClick = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation()
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (customerToDelete) {
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id))
      setSelectedCustomers((prev) => prev.filter((id) => id !== customerToDelete.id))
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
      if (selectedCustomer?.id === customerToDelete.id) {
        setIsDetailsOpen(false)
        setSelectedCustomer(null)
      }
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`
  }

  const getStatusBadgeVariant = (status: CustomerStatus) => {
    return status === "فعال" ? "default" : "secondary"
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
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
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="منو">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
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

          <h1 className="text-lg font-semibold">مشتریان</h1>

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
                <h2 className="text-2xl font-bold">مشتریان</h2>
                <p className="text-muted-foreground">
                  {toPersianDigits(filteredCustomers.length)} مشتری
                </p>
              </div>
              <Button className="min-h-[44px]">
                <Plus className="ml-2 h-4 w-4" />
                افزودن مشتری
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="جستجو در مشتریان..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setCurrentPage(1)
                      }}
                      className="pr-10"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value)
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="وضعیت" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="همه">همه</SelectItem>
                      <SelectItem value="فعال">فعال</SelectItem>
                      <SelectItem value="غیرفعال">غیرفعال</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="مرتب‌سازی" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">جدیدترین</SelectItem>
                      <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
                      <SelectItem value="orders">بیشترین سفارش</SelectItem>
                      <SelectItem value="spent">بیشترین خرید</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Customers Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-4 text-right w-12">
                          <Checkbox
                            checked={
                              selectedCustomers.length === paginatedCustomers.length &&
                              paginatedCustomers.length > 0
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="p-4 text-right text-sm font-medium">مشتری</th>
                        <th className="p-4 text-right text-sm font-medium hidden md:table-cell">اطلاعات تماس</th>
                        <th className="p-4 text-right text-sm font-medium hidden lg:table-cell">سفارشات</th>
                        <th className="p-4 text-right text-sm font-medium hidden lg:table-cell">مجموع خرید</th>
                        <th className="p-4 text-right text-sm font-medium">وضعیت</th>
                        <th className="p-4 text-right text-sm font-medium w-16">عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {paginatedCustomers.map((customer, index) => (
                          <motion.tr
                            key={customer.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ delay: index * 0.03 }}
                            className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => handleViewDetails(customer)}
                          >
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedCustomers.includes(customer.id)}
                                onCheckedChange={() => handleSelectCustomer(customer.id)}
                              />
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={customer.avatar} alt={customer.firstName} />
                                  <AvatarFallback>
                                    {getInitials(customer.firstName, customer.lastName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">
                                    {customer.firstName} {customer.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground hidden sm:inline">
                                    عضویت: {formatPersianDate(customer.joinDate, "short")}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 hidden md:table-cell">
                              <div className="space-y-1">
                                <p className="text-sm flex items-center gap-2">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {customer.email}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Phone className="h-3 w-3" />
                                  {customer.phone}
                                </p>
                              </div>
                            </td>
                            <td className="p-4 hidden lg:table-cell">
                              <span className="font-medium">
                                {toPersianDigits(customer.totalOrders)}
                              </span>
                            </td>
                            <td className="p-4 hidden lg:table-cell">
                              <span className="font-medium">
                                {(customer.totalSpent / 1000000).toFixed(1)} میلیون
                              </span>
                            </td>
                            <td className="p-4">
                              <Badge variant={getStatusBadgeVariant(customer.status)}>
                                {customer.status}
                              </Badge>
                            </td>
                            <td className="p-4" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>عملیات</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleViewDetails(customer)}>
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
                                    onClick={(e) => handleDeleteClick(customer, e)}
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

                {paginatedCustomers.length === 0 && (
                  <div className="p-8 text-center">
                    <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">مشتری یافت نشد</p>
                  </div>
                )}

                {/* Pagination */}
                {filteredCustomers.length > 0 && (
                  <div className="p-4 border-t flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      نمایش {toPersianDigits((currentPage - 1) * itemsPerPage + 1)} تا{" "}
                      {toPersianDigits(Math.min(currentPage * itemsPerPage, filteredCustomers.length))} از{" "}
                      {toPersianDigits(filteredCustomers.length)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className="w-9"
                          onClick={() => setCurrentPage(page)}
                        >
                          {toPersianDigits(page)}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Customer Details Sheet */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>اطلاعات مشتری</SheetTitle>
          </SheetHeader>
          {selectedCustomer && (
            <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
              <div className="space-y-6">
                {/* Customer Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedCustomer.avatar} alt={selectedCustomer.firstName} />
                    <AvatarFallback className="text-lg">
                      {getInitials(selectedCustomer.firstName, selectedCustomer.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h3>
                    <Badge variant={getStatusBadgeVariant(selectedCustomer.status)}>
                      {selectedCustomer.status}
                    </Badge>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b">
                  <Button
                    variant={detailsTab === "info" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDetailsTab("info")}
                  >
                    <User className="h-4 w-4 ml-2" />
                    اطلاعات
                  </Button>
                  <Button
                    variant={detailsTab === "orders" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDetailsTab("orders")}
                  >
                    <ShoppingBag className="h-4 w-4 ml-2" />
                    سفارشات
                  </Button>
                  <Button
                    variant={detailsTab === "activity" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDetailsTab("activity")}
                  >
                    <MessageSquare className="h-4 w-4 ml-2" />
                    فعالیت‌ها
                  </Button>
                </div>

                {/* Info Tab */}
                {detailsTab === "info" && (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">ایمیل</p>
                          <p>{selectedCustomer.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">تلفن</p>
                          <p>{selectedCustomer.phone}</p>
                        </div>
                      </div>
                      {selectedCustomer.address && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">آدرس</p>
                            <p>{selectedCustomer.address}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        <CalendarDays className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">تاریخ عضویت</p>
                          <p>{formatPersianDate(selectedCustomer.joinDate, "full")}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <ShoppingBag className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">{toPersianDigits(selectedCustomer.totalOrders)}</p>
                        <p className="text-sm text-muted-foreground">سفارشات</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted text-center">
                        <CreditCard className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">{(selectedCustomer.totalSpent / 1000000).toFixed(1)}M</p>
                        <p className="text-sm text-muted-foreground">تومان خرید</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Button className="flex-1">
                        <Edit className="ml-2 h-4 w-4" />
                        ویرایش
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setCustomerToDelete(selectedCustomer)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="ml-2 h-4 w-4" />
                        حذف
                      </Button>
                    </div>
                  </div>
                )}

                {/* Orders Tab */}
                {detailsTab === "orders" && (
                  <div className="space-y-3">
                    {sampleOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <p className="font-mono text-sm">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPersianDate(order.date, "short")}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{formatToman(order.total)}</p>
                          <Badge variant="outline" className="text-xs">
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {sampleOrders.length === 0 && (
                      <p className="text-center text-muted-foreground p-4">
                        سفارشی یافت نشد
                      </p>
                    )}
                  </div>
                )}

                {/* Activity Tab */}
                {detailsTab === "activity" && (
                  <div className="space-y-3">
                    <div className="flex gap-3 p-3 rounded-lg bg-muted">
                      <ShoppingBag className="h-5 w-5 text-green-500 mt-1" />
                      <div>
                        <p className="text-sm">سفارش جدید ثبت شد</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativePersianDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 rounded-lg bg-muted">
                      <MessageSquare className="h-5 w-5 text-blue-500 mt-1" />
                      <div>
                        <p className="text-sm">نظر جدید ثبت شد</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativePersianDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 rounded-lg bg-muted">
                      <User className="h-5 w-5 text-purple-500 mt-1" />
                      <div>
                        <p className="text-sm">پروفایل تکمیل شد</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativePersianDate(selectedCustomer.joinDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف مشتری</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید مشتری{" "}
              <span className="font-bold">
                {customerToDelete?.firstName} {customerToDelete?.lastName}
              </span>{" "}
              را حذف کنید؟ این عملیات قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              لغو
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="ml-2 h-4 w-4" />
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
