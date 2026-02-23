"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
  Tag,
  Star,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useDashboardAccess } from "@/hooks/use-auth"

interface Product {
  id: string
  name: string
  category: string
  price: number
  oldPrice?: number
  inventory: number
  rating: number
  image: string
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

const sampleProducts: Product[] = [
  { id: "1", name: "گوشی آیفون ۱۴", category: "موبایل", price: 45000000, oldPrice: 50000000, inventory: 25, rating: 4.8, image: "/placeholder.jpg" },
  { id: "2", name: "لپ تاپ ماکروسافت", category: "کامپیوتر", price: 35000000, inventory: 12, rating: 4.5, image: "/placeholder.jpg" },
  { id: "3", name: "هدفون سونی", category: "لوازم جانبی", price: 8500000, oldPrice: 10000000, inventory: 50, rating: 4.7, image: "/placeholder.jpg" },
  { id: "4", name: "ساعت هوشمند", category: "پوشیدنی", price: 12000000, inventory: 8, rating: 4.3, image: "/placeholder.jpg" },
  { id: "5", name: "تبلت سامسونگ", category: "کامپیوتر", price: 18000000, oldPrice: 20000000, inventory: 15, rating: 4.6, image: "/placeholder.jpg" },
]

export default function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [products] = useState<Product[]>(sampleProducts)
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

  const filteredProducts = products.filter(product => 
    product.name.includes(searchQuery) ||
    product.category.includes(searchQuery)
  )

  // Show loading state while checking access
  if (accessLoading || !mounted) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-muted rounded" />
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
          <h2 className="text-2xl font-bold">{t("navigation.products") || "محصولات"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(products.length.toString())} {t("navigation.products") || "محصول"}
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

      {/* Products Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow overflow-hidden">
            <div className="aspect-square bg-muted relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground" />
              </div>
              {product.oldPrice && (
                <Badge className="absolute top-2 right-2 bg-red-500">
                  {toPersianDigits(Math.round((1 - product.price / product.oldPrice) * 100).toString())}%
                </Badge>
              )}
            </div>
            <CardContent className="p-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{product.category}</p>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm mr-1">{toPersianDigits(product.rating.toString())}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({toPersianDigits(product.inventory.toString())} {t("product.inStock") || "موجود"})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{formatToman(product.price)}</span>
                  {product.oldPrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatToman(product.oldPrice)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 ml-1" />
                    {t("common.view") || "مشاهده"}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="h-4 w-4 ml-1" />
                    {t("common.edit") || "ویرایش"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.showing") || "نمایش"} {toPersianDigits("1")} - {toPersianDigits(filteredProducts.length.toString())} {t("common.of") || "از"} {toPersianDigits(products.length.toString())}
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
