"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  ChevronRight,
  Package,
  ShoppingCart,
  Minus,
  Plus,
  Check,
  AlertCircle,
  ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, toPersianDigits } from "@/lib/persian"
import { useCart } from "@/lib/contexts/cart-context"

interface ProductVariant {
  id: string
  name: string
  sku: string | null
  price: number | null
  inventory: number
}

interface Product {
  id: string
  name: string
  description: string | null
  basePrice: number
  images: string[]
  sku: string | null
  trackInventory: boolean
  lowStockThreshold: number
  category: {
    id: string
    name: string
  }
  variants: ProductVariant[]
}

interface Organization {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
}

interface ProductDetailData {
  product: Product
  organization: Organization
}

export default function ProductDetailPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string; productId: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  const productId = resolvedParams.productId
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<ProductDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [addingToCart, setAddingToCart] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  
  // Get cart functions from context
  const { addToCart } = useCart()

  useEffect(() => {
    setMounted(true)
    
    // Load dictionary
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Fetch product data
    fetch(`/api/public/products/${productId}?organizationSlug=${slug}`)
      .then(res => {
        if (!res.ok) throw new Error("Product not found")
        return res.json()
      })
      .then(data => {
        setData(data)
        // Set default variant
        if (data.product.variants.length > 0) {
          setSelectedVariant(data.product.variants[0])
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [locale, slug, productId])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta
    const maxQuantity = selectedVariant?.inventory || 99
    if (newQuantity >= 1 && newQuantity <= maxQuantity) {
      setQuantity(newQuantity)
    }
  }

  const handleAddToCart = async () => {
    if (!selectedVariant) return
    
    setAddingToCart(true)
    try {
      await addToCart(selectedVariant.id, quantity)
      
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 3000)
    } catch (err) {
      console.error("Error adding to cart:", err)
    } finally {
      setAddingToCart(false)
    }
  }

  // Get display price
  const getDisplayPrice = (): number => {
    if (selectedVariant?.price) {
      return selectedVariant.price
    }
    return data?.product.basePrice || 0
  }

  // Check if product is in stock
  const isInStock = (): boolean => {
    if (!data?.product.trackInventory) return true
    return (selectedVariant?.inventory || 0) > 0
  }

  // Check if low stock
  const isLowStock = (): boolean => {
    if (!data?.product.trackInventory) return false
    const inventory = selectedVariant?.inventory || 0
    return inventory > 0 && inventory <= data.product.lowStockThreshold
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t("errors.notFound")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error || "Product not found"}</p>
            <Link href={`/${locale}/shop/${slug}`}>
              <Button className="mt-4">{t("common.back")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { product, organization } = data
  const price = getDisplayPrice()
  const inStock = isInStock()
  const lowStock = isLowStock()

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href={`/${locale}`} className="hover:text-foreground">
              خانه
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href={`/${locale}/shop/${slug}`} className="hover:text-foreground">
              {organization.name}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link 
              href={`/${locale}/shop/${slug}?category=${product.category.id}`} 
              className="hover:text-foreground"
            >
              {product.category.name}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* Product Detail */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Images */}
            <div className="space-y-4">
              {/* Main Image */}
              <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                {product.images.length > 0 ? (
                  <img 
                    src={product.images[selectedImage]} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Package className="h-24 w-24 text-muted-foreground" />
                  </div>
                )}
                {!inStock && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      ناموجود
                    </Badge>
                  </div>
                )}
              </div>
              
              {/* Thumbnail Gallery */}
              {product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {product.images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                        selectedImage === index ? "border-primary" : "border-transparent"
                      }`}
                    >
                      <img 
                        src={image} 
                        alt={`${product.name} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {product.category.name}
                </p>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                  {product.name}
                </h1>
                {product.sku && (
                  <p className="text-sm text-muted-foreground">
                    کد محصول: {product.sku}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">
                  {formatToman(price)}
                </span>
              </div>

              {/* Stock Status */}
              <div className="flex items-center gap-2">
                {inStock ? (
                  <>
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-green-600 font-medium">موجود</span>
                    {lowStock && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                        موجودی محدود
                      </Badge>
                    )}
                    {selectedVariant && (
                      <span className="text-sm text-muted-foreground">
                        ({toPersianDigits(selectedVariant.inventory.toString())} عدد)
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-red-600 font-medium">ناموجود</span>
                  </>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <Card>
                  <CardContent className="py-4">
                    <p className="text-muted-foreground whitespace-pre-line">
                      {product.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Variant Selection */}
              {product.variants.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">انتخاب نوع:</label>
                  <Select 
                    value={selectedVariant?.id} 
                    onValueChange={(value) => {
                      const variant = product.variants.find(v => v.id === value)
                      setSelectedVariant(variant || null)
                      setQuantity(1) // Reset quantity when variant changes
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {product.variants.map((variant) => (
                        <SelectItem 
                          key={variant.id} 
                          value={variant.id}
                          disabled={product.trackInventory && variant.inventory === 0}
                        >
                          {variant.name}
                          {variant.price && ` - ${formatToman(variant.price)}`}
                          {product.trackInventory && variant.inventory === 0 && " (ناموجود)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Quantity */}
              {inStock && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">تعداد:</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(-1)}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-medium">
                      {toPersianDigits(quantity.toString())}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(1)}
                      disabled={quantity >= (selectedVariant?.inventory || 99)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Add to Cart */}
              <div className="flex gap-3">
                <Button 
                  size="lg" 
                  className="flex-1 gap-2"
                  disabled={!inStock || addingToCart}
                  onClick={handleAddToCart}
                >
                  {addedToCart ? (
                    <>
                      <Check className="h-5 w-5" />
                      اضافه شد
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5" />
                      {addingToCart ? "در حال افزودن..." : "افزودن به سبد"}
                    </>
                  )}
                </Button>
              </div>

              {/* Organization Info */}
              <Card className="bg-muted/50">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">فروشنده:</p>
                      <Link 
                        href={`/${locale}/shop/${slug}`}
                        className="font-medium hover:text-primary"
                      >
                        {organization.name}
                      </Link>
                    </div>
                    <Link href={`/${locale}/shop/${slug}`}>
                      <Button variant="outline" size="sm">
                        مشاهده فروشگاه
                        <ArrowRight className="h-4 w-4 mr-1" />
                      </Button>
                    </Link>
                  </div>
                  {organization.phone && (
                    <p className="text-sm text-muted-foreground mt-2">
                      تماس: {organization.phone}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
