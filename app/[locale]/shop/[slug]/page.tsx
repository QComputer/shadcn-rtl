"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import Image from "next/image"
import { 
  Search, 
  MapPin, 
  Phone, 
  Mail,
  Clock,
  ChevronRight,
  Package,
  Filter,
  Grid,
  List,
  Calendar,
  Van,
  LocateFixedIcon,
  ShoppingCart,
  Check,
} from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  image: string | null
  images: string[]
  variants: ProductVariant[]
}

interface ProductCategory {
  id: string
  name: string
  description: string | null
  image: string | null
  products: Product[]
}

interface BusinessHour {
  day: string
  openTime: string
  closeTime: string
  isOpen: boolean
}

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo: string | null
  coverImage: string | null
  type: string
}

interface OrganizationSettings {
  currency: string
  enablePickup: boolean
  enableDelivery: boolean
  minimumOrderAmount: number | null
  deliveryRadius: number | null
}

interface ShopData {
  organization: Organization
  categories: ProductCategory[]
  businessHours: BusinessHour[]
  settings: OrganizationSettings | null
}


export default function ShopPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<ShopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")

    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
    const [quantity, setQuantity] = useState(1)
    const [addingToCart_VariantId, setAddingToCart_VariantId] = useState<string | null>(null)
    const [addedToCart, setAddedToCart] = useState(false)
    const [addedToCart_VariantId, setAddedToCart_VariantId] = useState<string | null>(null)
    // Get cart functions from context
      const { addToCart } = useCart()
      
  const handleAddToCart = async (variantId: string) => {
    if (!variantId) return
    
    setAddingToCart_VariantId(variantId)
    try {
      await addToCart(variantId, quantity)
      
      setAddedToCart_VariantId(variantId)
      setTimeout(() => setAddedToCart_VariantId(null), 3000)
    } catch (err) {
      console.error("Error adding to cart:", err)
    } finally {
      setAddingToCart_VariantId(null)
    }
  }

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Filter products by search and category
  const getFilteredProducts = () => {
    if (!data?.categories) return []
    
    let products: (Product & { categoryId: string; categoryName: string })[] = []
    
    data.categories.forEach(category => {
      category.products.forEach(product => {
        products.push({
          ...product,
          categoryId: category.id,
          categoryName: category.name,
        })
      })
    })
    
    if (selectedCategory && selectedCategory !== "all") {
      products = products.filter(p => p.categoryId === selectedCategory)
    }
    
    if (searchQuery) {
      products = products.filter(p => 
        p.name.includes(searchQuery) ||
        p.description?.includes(searchQuery) ||
        p.categoryName.includes(searchQuery)
      )
    }
    
    return products
  }

  function getTotalProducts() {
  let total = 0;
  if (data) {
    data.categories.map((c)=>{
    total += c.products.length
  })}
  return total
}

  useEffect(() => {
    setMounted(true)
    
    // Load dictionary
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Fetch shop data
    fetch(`/api/public/organizations/${slug}/shop`)
      .then(res => {
        if (!res.ok) throw new Error("Shop not found")
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })

  }, [locale, slug])

  // Get display price
  const getDisplayPrice = (product: Product): number => {
    if (product.variants.length > 0 && product.variants[0].price) {
      return product.variants[0].price
    }
    return product.basePrice
  }

  // Get total inventory
  const getTotalInventory = (product: Product): number => {
    return product.variants.reduce((sum, v) => sum + v.inventory, 0)
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-96 w-full" />
        <div className="container mx-auto px-4 py-8 space-y-8">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
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
            <p className="text-muted-foreground">{error || "Shop not found"}</p>
            <Button className="mt-4">
              <Link href="/">{t("common.back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { organization, categories, settings } = data
  const filteredProducts = getFilteredProducts()
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-80 ">
        <div className="absolute inset-0 " />
        {organization.coverImage && (
            <img
              src={organization.coverImage}
              alt={organization.name+"cover image"}
              className="w-full h-full object-cover opacity-35"
            />
            )}
        <div className="container mx-auto px-2 relative z-10">
         
              <div className="w-20 h-20 rounded-full  overflow-hidden -mt-35  mr-3 bg-card ">
                <img 
                  src={organization?.logo || "logo"} 
                  alt={organization.name+"logo"}
                  className="w-full h-full object-cover"
                />
              </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3 mx-3">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-muted-foreground mb-4">
                {organization.description}
              </p>
            )}
            <div className="flex flex-wrap gap-3 px-3">
              {settings?.enableDelivery && (
                <Badge variant="secondary">
                  <Van className="h-3 w-3" />
                  ارسال 
                </Badge>
              )}
              {settings?.enablePickup && (

                <Badge variant="secondary">
                  <MapPin className="h-4 w-4" />
                  تحویل حضوری
                </Badge>
              )}
            </div>
        </div>
      </section>

      {/* Quick Info Bar */}
      <section className="border-b bg-card sticky top-0 z-5">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3 text-sm">
              {organization.phone && (
                <a 
                  href={`tel:${organization.phone}`} 
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  <span>{organization.phone}</span>
                </a>
              )}
              {organization.address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{organization.address}</span>
                </div>
              )}
            </div>
           
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search") || "جستجو..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-1">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Categories Quick Links */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                >
                  {"همه"}
                  <Badge variant="secondary" className="mr-2">
                    {toPersianDigits(getTotalProducts())}
                  </Badge>
                </Button>
              {categories.map((category) => (
                <Button
                  key={locale+category.id}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                  <Badge variant="secondary" className="mr-2">
                    {toPersianDigits(category.products.length.toString())}
                  </Badge>
                </Button>
              ))}
            </div>
          )}

          {/* Products */}
          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery || selectedCategory !== "all" 
                    ? "محصولی یافت نشد" 
                    : "محصولی وجود ندارد"
                  }
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery || selectedCategory !== "all" 
                    ? "لطفاً فیلترها را تغییر دهید" 
                    : "به زودی محصولات اضافه می‌شوند"
                  }
                </p>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const inventory = getTotalInventory(product)
                const price = getDisplayPrice(product)
                
                return (
                    <Card key={locale+product.id} className="hover:shadow-md transition-shadow overflow-hidden h-full">
                      <CardTitle>
                      <div className="aspect-square bg-muted relative -mt-4 -mb-4">
                      <Link   href={`/${locale}/shop/${slug}/product/${product.id}`}>
                      {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover "
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Package className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        </Link>
                        {inventory === 0 && (
                          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                            <Badge variant="secondary">ناموجود</Badge>
                          </div>
                        )}
                      </div>
                    </CardTitle>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          {product.categoryName}
                        </p>
                        <h3 className="font-medium line-clamp-2 mb-2 text-sm">
                          {product.name}
                        </h3>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary">
                            {formatToman(price)}
                          </span>
                          {product.variants.length > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {toPersianDigits(product.variants.length.toString())} نوع
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter>
                  <Button 
                  size="default" 
                  className={"flex-1 gap-2"}
                  disabled={addingToCart_VariantId == product.variants[0]?.id}
                  onClick={() => handleAddToCart(product.variants[0].id)}
                >
                  {addedToCart_VariantId == product.variants[0]?.id ? (
                    <>
                      <Check className="h-5 w-5" />
                      اضافه شد
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 " />
                      {addingToCart_VariantId == product.variants[0]?.id ? "در حال افزودن..." : "افزودن به سبد"}
                    </>
                  )}
                </Button>
                      </CardFooter>
                    </Card>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredProducts.map((product) => {
                const inventory = getTotalInventory(product)
                const price = getDisplayPrice(product)
                
                return (
                    <Card key={locale+product.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="px-4 py-1">
                        <div className="flex gap-4">
                          
                          <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                          <Link   href={`/${locale}/shop/${slug}/product/${product.id}`}>                        
                              {product.image ? (
                                <img 
                                  src={product.image} 
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground" />
                                </div>
                              )}
                            </Link>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            
                            <p className="text-xs text-muted-foreground mb-1">
                              {product.categoryName}
                            </p>
                            <h3 className="font-medium mb-1">{product.name}</h3>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {product.description}
                              </p>
                            )}
                            <div className="flex items-center justify-between pt-2">

                              <span className="font-bold text-primary">
                                {formatToman(price)}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button 
                                className={"flex-1 gap-2 w-28"}
                                disabled={addingToCart_VariantId == product.variants[0]?.id}
                                onClick={() => handleAddToCart(product.variants[0].id)}
                              >
                                {addedToCart_VariantId == product.variants[0]?.id ? (
                                  <>
                                    اضافه شد
                                    <Check className="h-5 w-5" />
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xs">{addingToCart_VariantId == product.variants[0].id ? "در حال افزودن  ..." : "افزودن به سبد"}</p>
                                    {addingToCart_VariantId !== product.variants[0].id && <ShoppingCart className="h-5 w-5 -mx-1" />}
                                  </>
                                )}
                                </Button>
                              </div>
                              
                            </div>
                            
                          </div>

                        </div>
                      
                      </CardContent>
                    </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}


