"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Save, Loader2, Plus, ArrowLeft, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, toPersianDigits } from "@/lib/persian"
import { useDashboardAccess } from "@/hooks/use-auth"
import { useSession } from "next-auth/react"
import { isRTL } from "@/lib/i18n"

interface ProductVariant {
  id?: string
  name: string
  sku?: string 
  image?: string 
  price?: number
  inventory?: number
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

export default function NewProductPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const router = useRouter()
  const isRtl = isRTL(locale)
  
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  const { data: session } = useSession()
  
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [basePrice, setBasePrice] = useState("")
  const [variantPrice, setVariantPrice] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [sku, setSku] = useState("")
  const [organizationId, setOrganizationId] = useState("")
  const [lowStockThreshold, setLowStockThreshold] = useState("20")
  const [sortOrder, setSortOrder] = useState("0")
  const [image, setImage] = useState("")
  const [isActive, setIsActive] = useState(true)

  const [trackInventory, setTrackInventory] = useState(false)                     
  const [inventory, setInventory] = useState("100") 
  const [showVariants, setShowVariants] = useState(false) 
  const [addVariantDialogOpen, setAddVariantDialogOpen] = useState(false) 
  const [editVariantDialogOpen, setEditAddVariantDialogOpen] = useState(false) 
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null) 
  const [variantFormData, setVariantFormData] = useState<ProductVariant | null>(null)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch categories and staff members
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    
    Promise.all([
      fetch(`/api/product-categories`)
        .then(res => res.json())
        .then(data => data.data || [])
    ]).then(([categoriesData]) => {
      setCategories(categoriesData)
    }).catch(() => {
      setCategories([])
    }).finally(() => setLoading(false))
  }, [hasAccess, accessLoading])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !basePrice || !categoryId) {
      setError(t("errors.required_fields") || "Please fill in all required fields")
      return
    }
    
    setSaving(true)
    setError(null)
    
     try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || undefined,
            basePrice: parseFloat(basePrice),
            image: image || undefined,
            sku,
            categoryId,
            organizationId,
            trackInventory,
            lowStockThreshold: Number(lowStockThreshold),
            sortOrder: Number(sortOrder),
          }),
      })
        const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create product")
      }
      
      // Redirect to products page
      router.push(`/${locale}/dashboard/products/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product")
    } finally {
      setSaving(false)
    }
  }


  if (accessLoading || !mounted) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">Access Denied</h2>
          <p className="text-muted-foreground mt-2">You do not have access to this page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href={`/${locale}/dashboard/products`}
          className="text-muted-foreground hover:text-foreground"
        >
            {<ArrowLeft className={"h-5 w-5" + isRTL(locale) && "rotate-180"} />}
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{t("product.new") || "New Product"}</h2>
          <p className="text-muted-foreground">
            {t("product.create_description") || "Create a new product for your organization"}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("product.details") || "Product Details"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Category */}
            <div className="space-y-2 pt-4">
              <Label htmlFor="category">
                {t("product.category") || "Category"} *
              </Label>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : categories.length === 0 ? (
                <div className="flex items-center gap-2">
                  <Input disabled placeholder={t("product.no_categories") || "No categories available"} />
                  <Link href={`/${locale}/dashboard/product-categories`}>
                    <Button type="button" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("product.select_category") || "Select a category"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {/* --------------- Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("product.name") || "Product Name"} *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("product.name_placeholder") || "Enter product name"}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">
                  {t("product.sku") || "Product sku"}
                </Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("product.sku_placeholder") || "Enter product sku"}
                />
              </div>
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {t("product.description") || "Description"}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("product.description_placeholder") || "Describe your product"}
                rows={3}
              />
            </div>


            {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">
                  {t("product.price") || "Price"}
                  <p className="text-sm text-muted-foreground">
                  : {basePrice ? formatToman(parseFloat(basePrice)) : formatToman(parseFloat("0"))}
                </p>
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="1000"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0 "
                  required
                />
              </div>

            {/* ----------- Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image">
                {t("product.image") || "Image URL"}
              </Label>
              <Input
                id="image"
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>


            {/* ------------- Active Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="active">
                    {isActive ? (t("common.active") || "Active") : (t("common.inactive") || "Inactive")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("product.active_description") || "This product will be available for booking"}
                  </p>
                </div>
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>

            {/* ======================================== Actions */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    {t("common.saving") || "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 ml-2" />
                    {t("common.save") || "Save"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}