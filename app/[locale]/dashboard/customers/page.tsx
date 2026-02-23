"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  MoreVertical,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useDashboardAccess } from "@/hooks/use-auth"

interface Customer {
  id: string
  name: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  totalOrders: number
  totalSpent: number
  joinDate: Date
  status: "active" | "inactive"
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

// Sample data
const sampleCustomers: Customer[] = [
  { id: "1", firstName: "علی", lastName: "محمدی", name: "ali", phone: "۰۹۱۲۳۴۵۶۷۸۹", address: "تهران، خیابان ولیعصر", totalOrders: 12, totalSpent: 45000000, joinDate: new Date("2024-01-15"), status: "active" },
  { id: "2", firstName: "سارا", lastName: "احمدی", name: "sara", phone: "۰۹۱۲۳۴۵۶۷۸۸", address: "تهران، خیابان انقلاب", totalOrders: 8, totalSpent: 28000000, joinDate: new Date("2024-03-20"), status: "active" },
  { id: "3", firstName: "محمد", lastName: "رضایی", name: "mohammad", phone: "۰۹۱۲۳۴۵۶۷۸۷", address: "تهران، خیابان شریعتی", totalOrders: 25, totalSpent: 85000000, joinDate: new Date("2023-11-10"), status: "active" },
  { id: "4", firstName: "مریم", lastName: "کاظمی", name: "maryam", phone: "۰۹۱۲۳۴۵۶۷۸۶", address: "تهران، خیابان آزادی", totalOrders: 3, totalSpent: 5200000, joinDate: new Date("2024-06-01"), status: "inactive" },
  { id: "5", firstName: "احمد", lastName: "حسنی", name: "ahmad", phone: "۰۹۱۲۳۴۵۶۷۸۵", address: "تهران، خیابان مدرس", totalOrders: 18, totalSpent: 62000000, joinDate: new Date("2024-02-28"), status: "active" },
]

export default function CustomersPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState<Customer[]>(sampleCustomers)
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

  const filteredCustomers = customers.filter(customer => 
    customer.firstName?.includes(searchQuery) ||
    customer.lastName?.includes(searchQuery) ||
    customer.name.includes(searchQuery)
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
          <h2 className="text-2xl font-bold">{t("navigation.customers") || "مشتریان"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(customers.length.toString())} {t("navigation.customers") || "مشتریان"}
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

      {/* Customers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCustomers.map((customer) => (
          <Card key={customer.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={customer.email} />
                  <AvatarFallback>
                    {customer.firstName[0]}{customer.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {customer.firstName} {customer.lastName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("common.since") || "عضو از"} {customer.joinDate.toLocaleDateString("fa-IR")}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 p-0">
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Eye className="h-4 w-4 ml-2" />
                    {t("common.view") || "مشاهده"}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 ml-2" />
                    {t("common.edit") || "ویرایش"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 ml-2" />
                    {t("common.delete") || "حذف"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="ltr">{customer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShoppingBag className="h-4 w-4" />
                  <span>
                    {toPersianDigits(customer.totalOrders.toString())} {t("navigation.orders") || "سفارش"} - {formatToman(customer.totalSpent)}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                  {customer.status === "active" ? (t("common.active") || "فعال") : (t("common.inactive") || "غیرفعال")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.showing") || "نمایش"} {toPersianDigits("1")} - {toPersianDigits(filteredCustomers.length.toString())} {t("common.of") || "از"} {toPersianDigits(customers.length.toString())}
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
