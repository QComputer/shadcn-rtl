"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing"
import { ArrowRight, Save, Loader2, Plus, ArrowLeft, ChevronLeftIcon, ChevronRightIcon, X, Sparkles } from "lucide-react"
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
import { FieldLabel } from "@/components/ui/field"
import { SlugPreviewActions } from "@/components/dashboard/slug-preview-actions"
import {
  AiMediaProviderState,
  type AiMediaStatusResponse,
  type AiMediaUsageSummary,
} from "@/components/dashboard/ai-media-provider-state"

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
  organizationSlug: string
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

interface ImageRecord {
  id: number;
  url: string;
  filename: string;
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
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [basePrice, setBasePrice] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [sku, setSku] = useState("")
  const [lowStockThreshold, setLowStockThreshold] = useState("20")
  const [sortOrder, setSortOrder] = useState("0")
  const [image, setImage] = useState<ImageRecord|null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(true)
  const [aiFeatureEnabled, setAiFeatureEnabled] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiMediaStatusResponse | null>(null)
  const [aiUsage, setAiUsage] = useState<AiMediaUsageSummary>(null)
  const [aiStateLoading, setAiStateLoading] = useState(false)

   const [images, setImages] = useState<ImageRecord[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState<number>(0);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

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
        resolve(JSON.parse(xhr.responseText));
      };

      xhr.onerror = reject;
      xhr.send(form);
    });
  }
  // Handle file selection 
  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = await uploadFile(file);
      setImage(img);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
    }
    e.target.value = ""; // Reset file input to allow uploading the same file again
  };

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  useEffect(() => {
    if (!hasAccess || accessLoading) return

    let active = true

    setAiStateLoading(true)
    Promise.all([
      fetch("/api/dashboard/ai-media/status")
        .then(async (res) => {
          if (!res.ok) return { enabled: false }
          return res.json()
        })
        .catch(() => ({ enabled: false })),
      fetch("/api/dashboard/ai-media/usage")
        .then(async (res) => {
          if (!res.ok) return { usage: null }
          return res.json()
        })
        .catch(() => ({ usage: null })),
    ])
      .then(([statusData, usageData]) => {
        if (!active) return
        setAiStatus(statusData)
        setAiUsage(usageData.usage || null)
        setAiFeatureEnabled(Boolean(statusData.enabled))
      })
      .finally(() => {
        if (active) setAiStateLoading(false)
      })

    return () => {
      active = false
    }
  }, [hasAccess, accessLoading])

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

  const selectedCategory = categories.find(category => category.id === categoryId)
  const productPreviewPath = slug.trim() && selectedCategory?.organizationSlug
    ? buildOrganizationPublicPath({ locale, organizationSlug: selectedCategory.organizationSlug, surface: "shop", subPath: `/product/${slug.trim()}` })
    : null

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imageFile = e.target.files[0];
      setImageFile(imageFile);
      try {
        const img = await uploadFile(imageFile);
        setImage(img);
        
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !basePrice || !categoryId) {
      setError(t("errors.required_fields") || "Please fill in all required fields")
      return
    }
    
    setSaving(true)
    setError(null)
    
     try {
      let imageUrl;
      if (imageFile) {
        const img = await uploadFile(imageFile)
        imageUrl = img.url
      }
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            name,
            slug: slug.trim() || undefined,
            description: description || undefined,
            basePrice: parseFloat(basePrice),
            image: imageUrl || undefined,
            sku,
            categoryId,
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
  
    // Handle file drop (remains mostly the same, but gets ImageRecord)
    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
  
      try {
        const img = await uploadFile(file);
        setImage(img);
      } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload failed. Please try again.");
      }
    };
  
  
  // Delete Image function
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    const id = image?.id 
    if(!id) return
    try {
      const response = await fetch(`/api/images/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete image");
      }

      // Remove image from state
      setImages((prev) => prev.filter((img) => img.id !== id));
      alert("Image deleted successfully!");
    } catch (error: any) {
      console.error("Deletion failed:", error);
      alert(`Deletion failed: ${error.message}`);
    }
  };

  const prevent = (e: React.DragEvent) => e.preventDefault();


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
            {t("product.createDescription") || "Create a new product for your organization"}
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
              {/* Upload Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="image">
                    {t("product.image") || "Product image"}
                  </Label>
                </div>
                <div className="mt-1 flex items-center">
                
            <input
              type="file"
              accept="image/*" // Only accept image files
              onChange={handleImageChange}
              className="sr-only" // Hide the default file input
              id="imageUpload"
            />
         
            <label
              htmlFor="imageUpload"
            >
 
            {imagePreview && (
              <img
              src={imagePreview}
              alt="Image Preview"
              className=" items-center mr-2 h-20 w-20 object-cover rounded-md"
              />
                          
            )}

          {!image && (
            <div className=" items-center mr-2 text-xs border-1 p-2 rounded-md w-20 h-20">هیچ تصویری انتخاب نشده</div>
          )}
              
            </label>
                <Button
                  onClick={() => {
                    setImage(null);
                    setImagePreview("")
                  }}
                  size={"icon"}
                  variant={"ghost"}
                  className={" -mt-16 mr-1"}
                >
                  <X/>
                </Button>
                {(aiFeatureEnabled || aiStatus || aiStateLoading) && (
                  <div className="mr-2 flex flex-col gap-1">
                    <Button type="button" variant="secondary" disabled className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      پیشنهاد تصویر حرفه‌ای با AI
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      پس از ذخیره محصول، پیشنهادهای AI در صفحه ویرایش فعال می‌شود.
                    </p>
                  </div>
                )}
            
          </div>
          {(aiStatus || aiStateLoading) && (
            <div className="md:col-span-2">
              <AiMediaProviderState
                status={aiStatus}
                usage={aiUsage}
                loading={aiStateLoading}
                locale={locale}
                productSaved={false}
              />
            </div>
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
                <SlugPreviewActions path={productPreviewPath} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">
                  {t("product.sku") || "Product sku"}
                </Label>
                <Input
                  id="sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
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
                placeholder={t("product.descriptionPlaceholder") || "Describe your product"}
                rows={3}
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
                  <Link href={`/${locale}/dashboard/product-categories`}>
                    <Button type="button" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("product.selectCategory") || "Select a category"} />
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

            {/* ------------- Active Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="active">
                    {isActive ? (t("common.active") || "Active") : (t("common.inactive") || "Inactive")}
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
