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
  Star,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
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

interface ProductVariant {
  id: string
  name: string
  sku: string | null
  price: number | null
  inventory: number
}

interface ProductCategory {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  description: string | null
  basePrice: number
  images: string[]
  image: string | null
  sku: string | null
  isActive: boolean
  trackInventory: boolean
  lowStockThreshold: number
  category: ProductCategory
  variants: ProductVariant[]
  createdAt: string
}

interface ProductsResponse {
  data: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function ProductsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  const { organizationMembership } = useAuth()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch products from API
  useEffect(() => {
    if (mounted && hasAccess) {
      fetchProducts()
    }
  }, [mounted, hasAccess, page, searchQuery, organizationMembership])

  const fetchProducts = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "12",
        isActive: "true",
      })
      
      if (searchQuery) {
        params.set("search", searchQuery)
      }
      
      // Filter by organization if user is a member
      if (organizationMembership?.organizationId) {
        params.set("organizationId", organizationMembership.organizationId)
      }
      
      const response = await fetch(`/api/products?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch products")
      }
      
      const data: ProductsResponse = await response.json()
      setProducts(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      console.error("Error fetching products:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        throw new Error("Failed to delete product")
      }
      
      // Refresh products list
      fetchProducts()
      setDeleteDialogOpen(false)
      setProductToDelete(null)
    } catch (err) {
      console.error("Error deleting product:", err)
      setError(err instanceof Error ? err.message : "Failed to delete product")
    } finally {
      setDeleting(false)
    }
  }

  // Calculate total inventory from variants
  const getTotalInventory = (product: Product): number => {
    return product.variants.reduce((sum, v) => sum + v.inventory, 0)
  }

  // Get display price (first variant price or base price)
  const getDisplayPrice = (product: Product): number => {
    if (product.variants.length > 0 && product.variants[0].price) {
      return product.variants[0].price
    }
    return product.basePrice
  }

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.products") || "محصولات"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(total.toString())} {t("navigation.products") || "محصول"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchProducts()}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            {t("common.add") || "افزودن"}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("common.search") || "جستجو..."}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setPage(1) // Reset to first page on search
          }}
          className="pr-10"
        />
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <div className="aspect-square bg-muted relative">
                <Skeleton className="w-full h-full" />
              </div>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && products.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "نتیجه‌ای یافت نشد" : "محصولی وجود ندارد"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? "لطفاً عبارت دیگری جستجو کنید" 
                : "برای شروع، اولین محصول را اضافه کنید"
              }
            </p>
            {!searchQuery && (
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                {t("common.add") || "افزودن محصول"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Products Grid */}
      {!loading && products.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const totalInventory = getTotalInventory(product)
            const displayPrice = getDisplayPrice(product)
            const isLowStock = product.trackInventory && totalInventory <= product.lowStockThreshold
            
            return (
              <Card key={product.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <div className="aspect-square bg-muted relative">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  {!product.isActive && (
                    <Badge className="absolute top-2 right-2 bg-gray-500">
                      غیرفعال
                    </Badge>
                  )}
                  {isLowStock && (
                    <Badge className="absolute top-2 left-2 bg-orange-500">
                      موجودی کم
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{product.category.name}</p>
                    <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {toPersianDigits(totalInventory.toString())} {t("product.inStock") || "موجود"}
                      </span>
                      {product.variants.length > 1 && (
                        <Badge variant="outline" className="text-xs">
                          {toPersianDigits(product.variants.length.toString())} نوع
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{formatToman(displayPrice)}</span>
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleDeleteClick(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && products.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.showing") || "نمایش"} {toPersianDigits(((page - 1) * 12 + 1).toString())} - {toPersianDigits(Math.min(page * 12, total).toString())} {t("common.of") || "از"} {toPersianDigits(total.toString())}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف محصول</DialogTitle>
            <DialogDescription>
              آیا از حذف محصول "{productToDelete?.name}" اطمینان دارید؟
              این عملیات قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              انصراف
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? "در حال حذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
