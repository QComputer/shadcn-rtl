"use client"
// TOODO: add deleting a Variant 
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Save, Loader2, Trash2, ArrowLeft, Plus, ChevronLeftIcon, ChevronRightIcon, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, toPersianDigits } from "@/lib/persian"
import { useDashboardAccess } from "@/hooks/use-auth"
import { useSession } from "next-auth/react"
import { isRTL } from "@/lib/i18n"


interface ProductVariant {
  id?: string
  productId: string
  name: string
  sku?: string 
  image?: string 
  price: number
  inventory?: number
}

interface ProductCategory {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  slug: string | null
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
  sortOrder: number
}
interface ImageRecord {
  id: number;
  url: string;
  filename: string;
}

export default function EditProductPage({ 
  params 
}: { 
  params: Promise<{ locale: string; id: string }> 
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const productId = resolvedParams.id
  const router = useRouter()
  
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingVariant, setDeletingVariant] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteVariantDialogOpen, setDeleteVariantDialogOpen] = useState(false)
  
  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [image, setImage] = useState("")
  const [progress, setProgress] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [basePrice, setBasePrice] = useState("")

  const [inventory, setInventory] = useState(100)
  const [trackInventory, setTrackInventory] = useState(false)                     
  const [addVariantDialogOpen, setAddVariantDialogOpen] = useState(false)
  const [editVariantDialogOpen, setEditVariantDialogOpen] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>({
    id: 'varId',
    productId:'productId',
    name:"var",
    price:Number(1000),
    inventory:Number(100),
  })
  const [newVariant, setNewVariant] = useState<ProductVariant>({
    productId:'id',
    name:"var",
    price:Number(1000),
    inventory:Number(1000),
  })
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [sortOrder, setSortOrder] = useState(0)
  const [lowStockThreshold, setLowStockThreshold] = useState(20)
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"none" | "percentage" | "fixed">("none")
  const [discountValue, setDiscountValue] = useState<number>(0)
    
    // Upload function
  async function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);

    return new Promise<ImageRecord>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        setProgress(0);
        const res = xhr.responseText
        //console.log("----------------xhr.responseText:",xhr.responseText);
        
        resolve(JSON.parse(xhr.responseText));
      };

      xhr.onerror = reject;
      xhr.send(form);
    });
  }
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imageFile = e.target.files[0];
      //setImageFile(imageFile);
      try {
        const img = await uploadFile(imageFile);
        setImage(img.url);
        //console.log('-----------img:',img);
        
        // Create a preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
      } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload failed. Please try again.");
      }
    }
  };

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])
  

  useEffect(()=>{
  //console.log(newVariant);

  },[newVariant])
  // Fetch product and categories
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    
    // Fetch product and categories in parallel
    Promise.all([
      fetch(`/api/products/${productId}`)
        .then(res => {
          if (!res.ok) throw new Error("Product not found")
          return res.json()
        })
        .then(data => data.product || data),
      fetch(`/api/product-categories`)
        .then(res => res.json())
        .then(data => data.data || [])

    ]).then(([productData, categoriesData]) => {

      setProduct(productData)
      setName(productData.name)
      setSlug(productData.slug || "")
      setDescription(productData.description || "")
      setBasePrice(productData.basePrice.toString())
      setCategoryId(productData.category?.id || "")
      setImage(productData.image || "")
      setIsActive(productData.isActive)
      
      setCategories(categoriesData)
      setVariants(productData.variants)
      setInventory(Number(productData.lowStockThreshold))
      setSortOrder(Number(productData.sortOrder))
      setDiscountType((productData.discountType as "none" | "percentage" | "fixed") || "none")
      setDiscountValue(Number(productData.discountValue || 0))
      setNewVariant({
        productId: productData.id,
        inventory: productData.lowStockThreshold? Number(productData.lowStockThreshold) : 100,
        name: productData.name,
        price: Number(productData.basePrice),
        sku: productData.sku
      })
    }).catch(err => {
      setError(err.message)
    }).finally(() => setLoading(false))
  }, [hasAccess, accessLoading, productId, saving])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !basePrice|| !categoryId) {
      setError(t("errors.required_fields") || "Please fill in all required fields")
      return
    }
    
    setSaving(true)
    setError(null)
    
     try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug.trim() || undefined,
          description: description || undefined,
          basePrice: parseFloat(basePrice),
          categoryId,
          image: image || undefined,
          isActive,
          sortOrder,
          discountType: discountType || "none",
          discountValue: discountType === "none" ? 0 : discountValue,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update product")
      }
      
      // Redirect to products list
      router.push(`/${locale}/dashboard/products`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete product")
      }
      
      router.push(`/${locale}/dashboard/products`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product")
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteVariant = async () => {
    setDeletingVariant(true)
    try {
      const response = await fetch(`/api/products/${productId}/variants/${selectedVariant.id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete product variant")
      }

      setEditVariantDialogOpen(false)
      router.push(`/${locale}/dashboard/products`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product variant")
    } finally {
      setDeletingVariant(false)
    }
  }

  
  const handleEditVariantFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedVariant?.name || !selectedVariant?.price) {
      setError(t("errors.required_fields") || "Please fill in all required fields")
      return
    }
    
    setSaving(true)
    setError(null)
    
     try {
      const response = await fetch(`/api/products/${productId}/variants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...selectedVariant
          }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update product variant")
      }
      
      setEditVariantDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product variant")
    } finally {
      setSaving(false)
    }
  }


  const handleAddVariantFormSubmit = async (e: React.FormEvent) =>{
    e.preventDefault()
    
    if (!newVariant?.name || !newVariant?.price) {
      setError(t("errors.required_fields") || "Please fill in all required fields")
      return
    }
    
    setSaving(true)
    setError(null)
    
     try {
      const response = await fetch(`/api/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...newVariant
          }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create product")
      }
      
      setAddVariantDialogOpen(false)
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

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    )
  }

  if (error && !product) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">{t("errors.notFound")}</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
          <Link href={`/${locale}/dashboard/products`}>
            <Button className="mt-4">{t("common.back")}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href={`/${locale}/dashboard/products`}
            className="text-muted-foreground hover:text-foreground"
          >
            {<ArrowLeft className={"h-5 w-5" + isRTL(locale) && "rotate-180"} />}
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{t("product.edit") || "Edit Product"}</h2>
            <p className="text-muted-foreground">
              {product?.name}
            </p>
          </div>
        </div>
        
        <Button 
          variant="destructive" 
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className={"h-4 w-4" + isRTL(locale) ? "mr-2" : "ml-2"} />
          {t("common.delete") || "Delete"}
        </Button>
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
            
             {/* Upload Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="image">
                  {t("product.image") || "Product image"}
                </Label>
              </div>
              <div className="mt-1 px-5 flex items-center">
                <Input
                  type="file"
                  accept="image/*" // Only accept image files
                  onChange={handleImageChange}
                  className="sr-only w-10" // Hide the default file input
                  id="imageUpload"
                />
                <Label
                  htmlFor="imageUpload"
                >
                <div className="items-center rounded-lg border-3">
                {imagePreview ? 
                  <img
                  src={imagePreview}
                  alt="Image Preview"
                  className="items-center h-20 w-20 object-cover rounded-md"
                  />
                : product?.image 
                  ? <img
                    src={product.image}
                    alt="Original Image Preview"
                    className=" items-center h-20 w-20 object-cover rounded-md"
                    />
                  :
               (
                <div className=" items-center text-sm border-1 p-2 rounded-md w-20 h-20">هیچ تصویری انتخاب نشده</div>
              )}
              </div>
                </Label>
                  <Button
                    onClick={() => {setImagePreview("")
                    }}
                    size={"icon"}
                    variant={"outline"}
                    className={"border-2 -mt-16 mr-1"}
                  >
                    <X/>
                  </Button>
              </div>
            
            <div className="row-2">
              {toPersianDigits(progress)} / {toPersianDigits(100)} 
            </div>
            
            </div>
            
            {/* Name */}
            <div className="space-y-2 pt-4">
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
              <Label htmlFor="slug">
                {t("common.slug") || "Public slug"}
              </Label>
              <Input
                id="slug"
                dir="ltr"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="organic-honey"
              />
              <p className="text-xs text-muted-foreground">
                {t("common.slugHelp") || "Leave blank to generate it from the name. Saved slugs are normalized and kept unique."}
              </p>
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
                  id="basePrice"
                  type="number"
                  min="0"
                  step="1000"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder=""
                  required
                />
              </div>

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
                  <Link href={`/${locale}/dashboard/categories`}>
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
                      <SelectItem key={locale+category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sortOrder">
                {t("product.sortOrder") || "sortOrder"} 
              </Label>
              <Input
                id="sortOrder"
                type="number"
                min="0"
                step="1"
                value={Number(sortOrder)}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                placeholder="0"
              />
            </div>
            
            {/* Active Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">
                  {t("common.active") || "Active"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("product.activeDescription") || "This product will be available for booking"}
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {/* ------------- lowStockThreshold and  */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="trackInventory">
                    { trackInventory ? (t("common.trackInventory") || "trackInventory") : (t("common.inactive") || "Inactive")}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("product.trackInventory_description") || "..."}
                  </p>
                </div>
                <Switch
                  id="trackInventory"
                  checked={trackInventory}
                  onCheckedChange={setTrackInventory}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">
                  {t("product.lowStockThreshold") || "lowStockThreshold"} 
                </Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  min="1"
                  step="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  placeholder={"20"}
                  required ={trackInventory}
                  disabled = {!trackInventory}
                />
              </div>

            {/* Discount */}
            <div className="space-y-2">
              <Label htmlFor="discountType">نوع تخفیف</Label>
              <select
                id="discountType"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "none" | "percentage" | "fixed")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="none">بدون تخفیف</option>
                <option value="percentage">درصدی</option>
                <option value="fixed">مبلغ ثابت</option>
              </select>
            </div>
            {discountType !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="discountValue">
                  {discountType === "percentage" ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  min="0"
                  step={discountType === "percentage" ? "1" : "1000"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            )}
            
            {/* ------------- variants and  */}
              <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="trackInventory">
                  {(t("product.addVariant") || "addVariant")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("product.addVariant_description") || "..."}
                </p>
              </div>
              <div>
                
              <Button
                id="addVariant"
                size={"icon"}
                variant={"secondary"}
                onClick={() => setAddVariantDialogOpen(true)}
              >
                  <Plus/>
              </Button>
            
              </div>
              </div>
                {
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 row-2 col-span-2">
                  {variants.length>0 &&
                  variants.map(v=>{
                    return (
                    <Button 
                    variant={"outline"}
                    className={"h-20 border-3 text-sm"}
                    key={locale+v.id}
                      onClick={()=>{
                        v.price = Number(v.price)
                        setSelectedVariant(v);
                        setEditVariantDialogOpen(true);
                      }}
                    >
                      {v.name}
                      </Button>
                  )})}
                </div>
                }

            {/* Actions */}
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

      {/* Edit Variant Dialog */}
      <Dialog open={(editVariantDialogOpen && !!selectedVariant)} onOpenChange={setEditVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("product.editVariant") || "Edit Product Variant"}
            </DialogTitle>
            <DialogDescription>
              {t("product.editVariant_description") || "Edit Product Variant"}
            </DialogDescription>
            <Button 
          variant="destructive" 
          onClick={handleDeleteVariant}
          className={"h-8 w-18"}
        >
          <Trash2 className={"h-4 w-4" + isRTL(locale) ? "mr-2" : "ml-2"} />
          {t("common.delete") || "Delete"}
        </Button>
          </DialogHeader>

          <form onSubmit={handleEditVariantFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("product.name") || "Name"} </Label>
              <Input
                id="name"
                type="string"
                value={selectedVariant.name || ""}
                onChange={(e) => {selectedVariant && setSelectedVariant(prev => ({ ...prev, name: e.target.value }))}}
                placeholder={t("product.name_placeholder") || "variant name"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="variantPrice">{t("product.variantPrice") || "variant Price"}</Label>

            <Input
                  id="variantPrice"
                  type="number"
                  min="0"
                  step="1000"
                  value={selectedVariant? Number(selectedVariant.price) : basePrice}
                  onChange={(e) => {selectedVariant && setSelectedVariant(prev => ({ ...prev, price: Number(e.target.value)}))}}
                  placeholder=""
                  required
                />
            </div>

            
            <div className="space-y-2">
              <Label htmlFor="inventory">{t("product.inventory") || "inventory"}</Label>
              <Input
                  id="inventory"
                  type="number"
                  min="0"
                  step="10"
                  value={selectedVariant? Number(selectedVariant.inventory) : 0}
                  onChange={(e) => setSelectedVariant(prev => ({ ...prev, inventory: Number(e.target.value) as number}))}
                  placeholder=""
                />
            </div>
            
            <DialogFooter>
            <div className="flex gap-3 pt-4">

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditVariantDialogOpen(false)}
                disabled={saving}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") || "Saving..." : t("common.save") || "Save"}
              </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Variant Dialog */}
      <Dialog open={(addVariantDialogOpen && !!newVariant)} onOpenChange={setAddVariantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("product.new_category") || "New Category"}
            </DialogTitle>
            <DialogDescription>
                {t("Create a new category to organize your products")}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddVariantFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("product.name") || "Name"} *</Label>
              <Input
                id="name"
                value={newVariant?.name || ""}
                onChange={(e) => setNewVariant(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t("product.variantName_placeholder") || "Variant name"}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="variantSku">{t("product.variantSku") || "SKU"}</Label>
              <Input
                id="variantSku"
                value={newVariant.sku?.toString() || ""}
                onChange={(e) => setNewVariant(prev => ({ ...prev, sku: e.target.value }))}
                placeholder={t("product.variantSku_placeholder") || "Variant sku"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variantPrice">{t("product.variantPrice") || "variant Price"}</Label>

            <Input
                  id="variantPrice"
                  type="number"
                  min="0"
                  step="1000"
                  value={Number(newVariant.price)}
                  onChange={(e) => setNewVariant(prev => ({ ...prev, price: Number(e.target.value) }))}
                  placeholder="0"
                />
            </div>

            
            <div className="space-y-2">
              <Label htmlFor="inventory">{t("product.inventory") || "inventory"}</Label>
              <Input
                  id="inventory"
                  type="number"
                  min="0"
                  step="1"
                  value={Number(newVariant.inventory)}
                  onChange={(e) => setNewVariant(prev => ({ ...prev, inventory: Number(e.target.value) }))}
                  placeholder="10"
                  required
                />
            </div>
            
            <DialogFooter>
            <div className="flex gap-3 pt-4">

              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setAddVariantDialogOpen(false)}
                disabled={saving}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") || "Saving..." : t("common.save") || "Save"}
              </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete") || "Delete Product"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{product?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("common.loading") || "Deleting..." : t("common.delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  )
}
