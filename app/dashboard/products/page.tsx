"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
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
  ChevronRight,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  Filter,
  X,
  Image,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatToman, toPersianDigits } from "@/lib/persian"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"

type ProductStatus = "موجود" | "ناموجود" | "موجودی محدود"

interface Product {
  id: string
  name: string
  category: string
  price: number
  inventory: number
  status: ProductStatus
  image: string
  sku: string
}

const sampleProducts: Product[] = [
  {
    id: "1",
    name: "گوشی موبایل آیفون ۱۴",
    category: "موبایل",
    price: 35000000,
    inventory: 15,
    status: "موجود",
    image: "",
    sku: "IPH-14-BLK",
  },
  {
    id: "2",
    name: "لپ تاپ مایکروسافت Surface",
    category: "لپ تاپ",
    price: 28000000,
    inventory: 8,
    status: "موجود",
    image: "",
    sku: "MS-SRF-01",
  },
  {
    id: "3",
    name: "هدفون سونی WH-1000XM5",
    category: "هدفون",
    price: 8500000,
    inventory: 0,
    status: "ناموجود",
    image: "",
    sku: "SNY-WH1000X5",
  },
  {
    id: "4",
    name: "ساعت هوشمند اپل واچ",
    category: "ساعت هوشمند",
    price: 12000000,
    inventory: 3,
    status: "موجودی محدود",
    image: "",
    sku: "APP-WATCH-SE",
  },
  {
    id: "5",
    name: "تبلت سامسونگ گلکسی",
    category: "تبلت",
    price: 15000000,
    inventory: 22,
    status: "موجود",
    image: "",
    sku: "SM-TAB-A8",
  },
  {
    id: "6",
    name: "دوربین عکاسی کانن",
    category: "دوربین",
    price: 18000000,
    inventory: 5,
    status: "موجود",
    image: "",
    sku: "CN-EOS-R10",
  },
]

const navItems = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, href: "/dashboard" },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingCart, href: "/dashboard/orders" },
  { id: "products", label: "محصولات", icon: Package, href: "/dashboard/products", active: true },
  { id: "appointments", label: "نوبت‌ها", icon: Calendar, href: "/dashboard/appointments" },
  { id: "customers", label: "مشتریان", icon: Users, href: "/dashboard/customers" },
  { id: "settings", label: "تنظیمات", icon: Settings, href: "/dashboard/settings" },
]

const statusColors: Record<ProductStatus, string> = {
  "موجود": "bg-green-500",
  "ناموجود": "bg-red-500",
  "موجودی محدود": "bg-amber-500",
}

const categories = ["همه", "موبایل", "لپ تاپ", "هدفون", "ساعت هوشمند", "تبلت", "دوربین"]

export default function ProductsPage() {
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>(sampleProducts)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("همه")
  const [statusFilter, setStatusFilter] = useState<string>("همه")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch = product.name.includes(searchQuery) || product.sku.includes(searchQuery)
      const matchesCategory = categoryFilter === "همه" || product.category === categoryFilter
      const matchesStatus = statusFilter === "همه" || product.status === statusFilter
      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return Number(b.id) - Number(a.id)
        case "oldest":
          return Number(a.id) - Number(b.id)
        case "price-high":
          return b.price - a.price
        case "price-low":
          return a.price - b.price
        case "inventory":
          return b.inventory - a.inventory
        default:
          return 0
      }
    })

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id))
    }
  }

  const handleSelectProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleDeleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setSelectedProducts((prev) => prev.filter((i) => i !== id))
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-64" />
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
            <SheetTrigger>
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
                        item.active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
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

          <h1 className="text-lg font-semibold">محصولات</h1>

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
                    item.active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
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
                <h2 className="text-2xl font-bold">محصولات</h2>
                <p className="text-muted-foreground">
                  {toPersianDigits(filteredProducts.length)} محصول
                </p>
              </div>
              <Button className="min-h-[44px]">
                <Plus className="ml-2 h-4 w-4" />
                محصول جدید
              </Button>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="جستجو در محصولات..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="دسته‌بندی" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="وضعیت" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="همه">همه</SelectItem>
                      <SelectItem value="موجود">موجود</SelectItem>
                      <SelectItem value="ناموجود">ناموجود</SelectItem>
                      <SelectItem value="موجودی محدود">موجودی محدود</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="مرتب‌سازی" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">جدیدترین</SelectItem>
                      <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
                      <SelectItem value="price-high">بیشترین قیمت</SelectItem>
                      <SelectItem value="price-low">کمترین قیمت</SelectItem>
                      <SelectItem value="inventory">موجودی</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 min-h-[280px] cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">افزودن محصول</p>
              </motion.div>

              {filteredProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="overflow-hidden group">
                    <div className="aspect-square relative bg-muted flex items-center justify-center">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <Image className="h-16 w-16 text-muted-foreground/50" />
                      )}
                      <div className="absolute top-2 right-2">
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => handleSelectProduct(product.id)}
                        />
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge className={statusColors[product.status]}>
                          {product.status}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{product.name}</h3>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>عملیات</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                              setSelectedProduct(product)
                              setIsDetailsOpen(true)
                            }}>
                              <Eye className="ml-2 h-4 w-4" />
                              مشاهده
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="ml-2 h-4 w-4" />
                              ویرایش
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="ml-2 h-4 w-4" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-bold">{formatToman(product.price)}</span>
                        <span className="text-xs text-muted-foreground">
                          موجودی: {toPersianDigits(product.inventory)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="p-12 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">محصولی یافت نشد</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Product Details Sheet */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>جزئیات محصول</SheetTitle>
          </SheetHeader>
          {selectedProduct && (
            <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
              <div className="space-y-4">
                <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                  <Image className="h-24 w-24 text-muted-foreground/50" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{selectedProduct.name}</h3>
                  <p className="text-muted-foreground">{selectedProduct.category}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">قیمت</p>
                    <p className="font-bold">{formatToman(selectedProduct.price)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">موجودی</p>
                    <p className="font-bold">{toPersianDigits(selectedProduct.inventory)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">SKU</p>
                    <p className="font-mono text-sm">{selectedProduct.sku}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-xs text-muted-foreground">وضعیت</p>
                    <Badge className={statusColors[selectedProduct.status]}>
                      {selectedProduct.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1">
                    <Edit className="ml-2 h-4 w-4" />
                    ویرایش
                  </Button>
                  <Button variant="destructive" onClick={() => {
                    handleDeleteProduct(selectedProduct.id)
                    setIsDetailsOpen(false)
                  }}>
                    <Trash2 className="ml-2 h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
