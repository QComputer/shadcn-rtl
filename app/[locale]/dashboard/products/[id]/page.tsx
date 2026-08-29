"use client"
import { appFetch } from "@/lib/app-base-path";
// TOODO: add deleting a Variant 
import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing"
import { ArrowRight, Save, Loader2, Trash2, ArrowLeft, Plus, ChevronLeftIcon, ChevronRightIcon, X, Sparkles, Clock, RotateCcw, Ban } from "lucide-react"
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
import { SlugPreviewActions } from "@/components/dashboard/slug-preview-actions"
import {
  AiMediaProviderState,
  canCreateAiMediaJob,
  getAiMediaSellerState,
  type AiMediaStatusResponse,
  type AiMediaUsageSummary,
} from "@/components/dashboard/ai-media-provider-state"
import {
  getAiMediaStatusDetailLines,
  getAiMediaStatusDisplay,
  isAiMediaStatusInFlight,
  normalizeAiMediaServiceStatusPayload,
  type NormalizedAiMediaStatus,
} from "@/lib/ai-media/status"
import { AiMediaAssetPicker } from "@/components/ai-media/ai-media-asset-picker"

const AI_JOB_POLL_INTERVAL_MS = 3000
const AI_JOB_MAX_POLL_ATTEMPTS = 90

type AiJobOutput = { url: string }

type AiJobSnapshot = {
  job_id?: string
  status?: string | null
  canonical_status?: string | null
  status_details?: unknown
  provider?: string | null
  created_at?: string | null
  updated_at?: string | null
  error_message?: string | null
  outputs?: AiJobOutput[] | null
  output_images?: string[] | null
}

type AiLocalJobSnapshot = {
  jobId?: string
  status?: string | null
  canonical_status?: string | null
  status_details?: unknown
  provider?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  errorMessage?: string | null
  outputs?: AiJobOutput[] | null
}

type AiJobApiResponse = {
  job?: AiJobSnapshot | null
  local?: AiLocalJobSnapshot | null
  remoteUnavailable?: boolean
}


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
  organizationSlug?: string
}

interface Product {
  id: string
  name: string
  slug: string | null
  description: string | null
  basePrice: number
  images: string[]
  image: string | null
  aiPrimaryMediaAssetId?: string | null
  sku: string | null
  isActive: boolean
  trackInventory: boolean
  lowStockThreshold: number
  category: ProductCategory
  variants: ProductVariant[]
  createdAt: string
  sortOrder: number
  organizationSlug: string
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
  const [aiPrimaryMediaAssetId, setAiPrimaryMediaAssetId] = useState<string | null>(null)
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

  // AI Media suggestion state
  const [aiFeatureEnabled, setAiFeatureEnabled] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiMediaStatusResponse | null>(null)
  const [aiUsage, setAiUsage] = useState<AiMediaUsageSummary>(null)
  const [aiStateLoading, setAiStateLoading] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiJobId, setAiJobId] = useState<string | null>(null)
  const [aiJobStatus, setAiJobStatus] = useState<string | null>(null)
  const [aiJobStatusDetails, setAiJobStatusDetails] = useState<NormalizedAiMediaStatus | null>(null)
  const [aiJobProvider, setAiJobProvider] = useState<string | null>(null)
  const [aiJobCreatedAt, setAiJobCreatedAt] = useState<string | null>(null)
  const [aiJobUpdatedAt, setAiJobUpdatedAt] = useState<string | null>(null)
  const [aiOutputs, setAiOutputs] = useState<Array<{ url: string }>>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPolling, setAiPolling] = useState(false)
  const [aiPollAttempts, setAiPollAttempts] = useState(0)
  const [aiRemoteUnavailable, setAiRemoteUnavailable] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSelectedImage, setAiSelectedImage] = useState<string | null>(null)
  const [aiSelectedIndex, setAiSelectedIndex] = useState<number | null>(null)
  const [aiConfirming, setAiConfirming] = useState(false)
  const [aiCanceling, setAiCanceling] = useState(false)
  const aiPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiPollRunIdRef = useRef(0)
    
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

  useEffect(() => {
    if (!hasAccess || accessLoading) return

    let active = true

    setAiStateLoading(true)
    Promise.all([
      appFetch("/api/dashboard/ai-media/status")
        .then(async (res) => {
          if (!res.ok) return { enabled: false }
          return res.json()
        })
        .catch(() => ({ enabled: false })),
      appFetch("/api/dashboard/ai-media/usage")
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

  useEffect(()=>{
  //console.log(newVariant);

  },[newVariant])
  // Fetch product and categories
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    
    // Fetch product and categories in parallel
    Promise.all([
      appFetch(`/api/products/${productId}`)
        .then(res => {
          if (!res.ok) throw new Error("Product not found")
          return res.json()
        })
        .then(data => data.product || data),
      appFetch(`/api/product-categories`)
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
      setAiPrimaryMediaAssetId(productData.aiPrimaryMediaAssetId || productData.aiPrimaryMediaAsset?.id || null)
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

  const productSlugSegment = slug.trim() || product?.slug || ""
  const productPreviewPath = product?.organizationSlug && productSlugSegment
    ? buildOrganizationPublicPath({ locale, organizationSlug: product.organizationSlug, surface: "shop", subPath: `/product/${productSlugSegment}` })
    : null
  const aiSellerState = getAiMediaSellerState(aiStatus, aiUsage, aiStateLoading)
  const aiCanCreate = canCreateAiMediaJob(aiSellerState)

  const clearAiPollingTimer = () => {
    aiPollRunIdRef.current += 1
    if (aiPollTimerRef.current) {
      clearTimeout(aiPollTimerRef.current)
      aiPollTimerRef.current = null
    }
  }

  const getAiStatusDetails = (job?: AiJobSnapshot | AiLocalJobSnapshot | null) => {
    if (!job) return normalizeAiMediaServiceStatusPayload({ status: aiJobStatus })
    return normalizeAiMediaServiceStatusPayload({
      ...job,
      ...(typeof job.status_details === "object" && job.status_details ? job.status_details : {}),
    })
  }

  const isAiJobInFlight = (status: string | null) => Boolean(status) && isAiMediaStatusInFlight({ status })

  const normalizeAiOutputs = (job?: AiJobSnapshot | AiLocalJobSnapshot | null): AiJobOutput[] => {
    if (!job) return []
    if (Array.isArray(job.outputs)) {
      return job.outputs.filter((output) => output && typeof output.url === "string")
    }
    if ("output_images" in job && Array.isArray(job.output_images)) {
      return job.output_images.map((url) => ({ url }))
    }
    return []
  }

  const formatAiTimestamp = (value: string | null) => {
    if (!value) return "ثبت نشده"
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const applyAiJobSnapshot = (data: AiJobApiResponse) => {
    const job = data.job
    const local = data.local
    const statusDetails = getAiStatusDetails(job || local || null)
    const nextJobId = job?.job_id || local?.jobId || null
    const nextStatus = statusDetails.legacyStatus
    const nextProvider = job?.provider || local?.provider || null
    const nextCreatedAt = job?.created_at || local?.createdAt || null
    const nextUpdatedAt = job?.updated_at || local?.updatedAt || null
    const outputs = normalizeAiOutputs(job).length > 0 ? normalizeAiOutputs(job) : normalizeAiOutputs(local)

    if (nextJobId) setAiJobId(nextJobId)
    setAiJobStatus(nextStatus)
    setAiJobStatusDetails(statusDetails)
    setAiJobProvider(nextProvider)
    setAiJobCreatedAt(nextCreatedAt)
    setAiJobUpdatedAt(nextUpdatedAt)
    setAiRemoteUnavailable(Boolean(data.remoteUnavailable))
    if (outputs.length > 0) setAiOutputs(outputs)
    if (nextStatus === "FAILED") setAiError(job?.error_message || local?.errorMessage || "در تولید تصویر خطا رخ داد.")
    if (nextStatus === "CANCELED") setAiError("درخواست تصویر لغو شد.")
  }

  useEffect(() => {
    return () => clearAiPollingTimer()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !basePrice|| !categoryId) {
      setError(t("errors.required_fields") || "Please fill in all required fields")
      return
    }
    
    setSaving(true)
    setError(null)
    
     try {
      const response = await appFetch(`/api/products/${productId}`, {
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
      const response = await appFetch(`/api/products/${productId}`, {
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
      const response = await appFetch(`/api/products/${productId}/variants/${selectedVariant.id}`, {
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

  const createAiJob = async () => {
    if (!aiFeatureEnabled || !aiCanCreate) {
      setAiError("پیشنهاد تصویر AI در حال حاضر فعال نیست.")
      return
    }

    clearAiPollingTimer()
    setAiLoading(true)
    setAiError(null)
    setAiOutputs([])
    setAiSelectedImage(null)
    setAiSelectedIndex(null)
    setAiJobStatus(null)
    setAiJobStatusDetails(null)
    setAiJobProvider(null)
    setAiJobCreatedAt(null)
    setAiJobUpdatedAt(null)
    setAiRemoteUnavailable(false)
    setAiPollAttempts(0)

    try {
      const response = await appFetch(`/api/dashboard/products/${productId}/ai-image-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 3,
          aspect_ratio: "1:1",
          style_preset: "LIGHT_MENU_PHOTO",
          seller_prompt: description || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create AI suggestion job")
      }

      const data = await response.json()
      const statusDetails = normalizeAiMediaServiceStatusPayload(data)
      setAiJobId(data.job_id)
      setAiJobStatus(statusDetails.legacyStatus)
      setAiJobStatusDetails(statusDetails)
      setAiJobProvider(data.provider || null)
      setAiJobCreatedAt(new Date().toISOString())
      setAiJobUpdatedAt(new Date().toISOString())
      setAiLoading(false)
      setAiPolling(true)
      pollAiJob(data.job_id)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to start AI suggestion")
      setAiLoading(false)
    }
  }

  const pollAiJob = (jobId: string) => {
    clearAiPollingTimer()
    setAiPolling(true)
    setAiLoading(false)
    setAiError(null)
    setAiRemoteUnavailable(false)
    setAiPollAttempts(0)

    const runId = aiPollRunIdRef.current
    let attempts = 0

    const stopPolling = (message?: string) => {
      if (aiPollRunIdRef.current !== runId) return
      if (aiPollTimerRef.current) {
        clearTimeout(aiPollTimerRef.current)
        aiPollTimerRef.current = null
      }
      setAiPolling(false)
      setAiLoading(false)
      if (message) setAiError(message)
    }

    const pollOnce = async () => {
      if (aiPollRunIdRef.current !== runId) return
      attempts++
      setAiPollAttempts(attempts)
      try {
        const response = await appFetch(`/api/dashboard/ai-image-suggestions/${jobId}`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Failed to poll job")
        }
        const data = await response.json()
        applyAiJobSnapshot(data)
        const status = getAiStatusDetails(data.job || data.local || null).legacyStatus
        const outputs = normalizeAiOutputs(data.job).length > 0
          ? normalizeAiOutputs(data.job)
          : normalizeAiOutputs(data.local)

        if (status === "COMPLETED") {
          if (outputs.length > 0) {
            setAiOutputs(outputs)
            stopPolling()
          } else {
            stopPolling("تصویر پیشنهادی برای این درخواست برنگشت. دوباره تلاش کنید.")
          }
        } else if (status === "FAILED") {
          stopPolling(data.job?.error_message || data.local?.errorMessage || "در تولید تصویر خطا رخ داد.")
        } else if (status === "CANCELED") {
          stopPolling("درخواست تصویر لغو شد.")
        } else if (attempts >= AI_JOB_MAX_POLL_ATTEMPTS) {
          stopPolling("درخواست تصویر هنوز در صف یا در حال پردازش است. کمی بعد ادامه دهید، آن را لغو کنید، یا درخواست تازه بسازید.")
        } else {
          if (data.remoteUnavailable) {
            setAiError("ارتباط با سرویس تصویر کند یا موقتاً قطع است؛ آخرین وضعیت ذخیره‌شده نمایش داده می‌شود.")
          }
          aiPollTimerRef.current = setTimeout(pollOnce, AI_JOB_POLL_INTERVAL_MS)
        }
      } catch (err) {
        stopPolling(err instanceof Error ? err.message : "Failed to poll job")
      }
    }

    void pollOnce()
  }

  const handleAiSelectImage = async (imageUrl: string, outputIndex: number) => {
    if (!aiJobId) {
      setAiError("شناسه درخواست تصویر پیدا نشد. دوباره تلاش کنید.")
      return
    }

    setAiSelectedImage(imageUrl)
    const confirmed = window.confirm("آیا می‌خواهید این تصویر را به عنوان تصویر اصلی محصول انتخاب کنید؟")
    if (!confirmed) {
      setAiSelectedImage(null)
      setAiSelectedIndex(null)
      return
    }

    setAiConfirming(true)
    try {
      const response = await appFetch(`/api/dashboard/products/${productId}/ai-image-suggestions/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: aiJobId, image_url: imageUrl, output_index: outputIndex }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to select image")
      }

      const data = await response.json()
      const selectedImageUrl = data.imageUrl || imageUrl

      setImage(selectedImageUrl)
      setImagePreview(selectedImageUrl)
      setProduct((current) => current ? { ...current, image: selectedImageUrl } : current)
      setAiDialogOpen(false)
      setAiSelectedImage(null)
      setAiSelectedIndex(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to select image")
    } finally {
      setAiConfirming(false)
    }
  }

  const retryAiJob = () => {
    clearAiPollingTimer()
    setAiError(null)
    setAiOutputs([])
    setAiSelectedImage(null)
    setAiSelectedIndex(null)
    setAiJobStatus(null)
    setAiJobStatusDetails(null)
    setAiJobId(null)
    setAiJobProvider(null)
    setAiJobCreatedAt(null)
    setAiJobUpdatedAt(null)
    setAiRemoteUnavailable(false)
    setAiPollAttempts(0)
    createAiJob()
  }

  const recoverLatestAiJob = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const response = await appFetch(`/api/dashboard/products/${productId}/ai-image-suggestions`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to recover AI media job")
      }
      const data = await response.json()
      if (!data.job && !data.local) {
        setAiError("درخواست قبلی برای این محصول پیدا نشد.")
        return
      }
      applyAiJobSnapshot(data)
      const recoveredJobId = data.job?.job_id || data.local?.jobId
      const recoveredStatus = getAiStatusDetails(data.job || data.local || null).legacyStatus
      if (recoveredJobId && isAiJobInFlight(recoveredStatus)) {
        pollAiJob(recoveredJobId)
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to recover AI media job")
    } finally {
      setAiLoading(false)
    }
  }

  const cancelAiJob = async () => {
    if (!aiJobId) {
      setAiError("شناسه درخواست تصویر پیدا نشد.")
      return
    }

    setAiCanceling(true)
    try {
      const response = await appFetch(`/api/dashboard/ai-image-suggestions/${aiJobId}/cancel`, {
        method: "POST",
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to cancel AI media job")
      }
      const data = await response.json()
      clearAiPollingTimer()
      applyAiJobSnapshot({ job: data.job, remoteUnavailable: false })
      setAiJobStatus("CANCELED")
      setAiJobStatusDetails(normalizeAiMediaServiceStatusPayload({ status: "CANCELED" }))
      setAiPolling(false)
      setAiLoading(false)
      setAiError("درخواست تصویر لغو شد.")
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to cancel AI media job")
    } finally {
      setAiCanceling(false)
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
      const response = await appFetch(`/api/products/${productId}/variants`, {
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
      const response = await appFetch(`/api/products/${productId}/variants`, {
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

  const currentAiStatusDetails = aiJobStatusDetails || (aiJobStatus ? normalizeAiMediaServiceStatusPayload({ status: aiJobStatus }) : null)
  const currentAiStatusDisplay = currentAiStatusDetails ? getAiMediaStatusDisplay(currentAiStatusDetails, locale) : null
  const currentAiStatusDetailLines = currentAiStatusDetails ? getAiMediaStatusDetailLines(currentAiStatusDetails, locale) : []
  const currentAiStatusBadgeVariant = currentAiStatusDisplay?.tone === "danger"
    ? "destructive"
    : currentAiStatusDisplay?.tone === "success"
      ? "default"
      : "secondary"

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
               <div className="mt-1 px-5 flex items-center gap-2">
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

                   {(aiFeatureEnabled || aiStatus || aiStateLoading) && (
                     <Button
                       type="button"
                       variant="secondary"
                       className="gap-2"
                       disabled={!aiCanCreate}
                       onClick={() => {
                         setAiDialogOpen(true)
                         setAiError(null)
                         setAiOutputs([])
                         setAiSelectedImage(null)
                         setAiSelectedIndex(null)
                         setAiJobStatus(null)
                         setAiJobId(null)
                       }}
                     >
                       <Sparkles className="h-4 w-4" />
                       پیشنهاد تصویر حرفه‌ای با AI
                     </Button>
                   )}
               </div>
            
            <div className="row-2">
              {toPersianDigits(progress)} / {toPersianDigits(100)} 
            </div>
            {(aiStatus || aiStateLoading) && (
              <div className="md:col-span-2">
                <AiMediaProviderState
                  status={aiStatus}
                  usage={aiUsage}
                  loading={aiStateLoading}
                  locale={locale}
                />
              </div>
            )}
            
            </div>

            <AiMediaAssetPicker
              entityLabel="تصویر اصلی AI محصول"
              attachUrl={`/api/dashboard/products/${productId}/ai-media-asset`}
              initialAssetId={aiPrimaryMediaAssetId}
              locale={locale}
              onAttached={(_publicMediaUrl, assetId) => {
                setAiPrimaryMediaAssetId(assetId)
                setProduct((current) => current ? { ...current, aiPrimaryMediaAssetId: assetId } : current)
              }}
            />
            
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
              <SlugPreviewActions path={productPreviewPath} />
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

      {/* AI Image Suggestion Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>پیشنهاد تصویر با AI</DialogTitle>
            <DialogDescription>
              {aiLoading && !aiPolling && "در حال ایجاد درخواست تصویر..."}
              {aiPolling && (currentAiStatusDisplay?.description || "در حال پیگیری درخواست تصویر...")}
              {!aiPolling && currentAiStatusDisplay?.description}
              {aiError && aiJobStatus !== "FAILED" && aiError}
            </DialogDescription>
          </DialogHeader>

          {(aiJobId || aiJobStatus) && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={currentAiStatusBadgeVariant}>
                  {currentAiStatusDisplay?.badgeText || "نامشخص"}
                </Badge>
                {aiJobProvider && <Badge variant="outline">{aiJobProvider}</Badge>}
                {aiRemoteUnavailable && <Badge variant="secondary">آخرین وضعیت محلی</Badge>}
              </div>
              {currentAiStatusDisplay && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">{currentAiStatusDisplay.label}</div>
                  <div>{currentAiStatusDisplay.description}</div>
                  {currentAiStatusDetailLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              )}
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  ایجاد: {formatAiTimestamp(aiJobCreatedAt)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  آخرین بروزرسانی: {formatAiTimestamp(aiJobUpdatedAt)}
                </div>
              </div>
              {aiPolling && (
                <p className="text-xs text-muted-foreground">
                  تلاش {toPersianDigits(aiPollAttempts)} از {toPersianDigits(AI_JOB_MAX_POLL_ATTEMPTS)}. اگر سرویس تصویر کند باشد، این صفحه آخرین وضعیت ذخیره‌شده را نگه می‌دارد.
                </p>
              )}
            </div>
          )}

          {aiLoading && !aiPolling && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {aiPolling && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">در حال تولید یا پیگیری تصاویر پیشنهادی...</p>
                {aiJobId && isAiJobInFlight(aiJobStatus) && (
                  <Button type="button" variant="outline" size="sm" onClick={cancelAiJob} disabled={aiCanceling}>
                    {aiCanceling ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Ban className="h-4 w-4 ml-2" />}
                    لغو درخواست
                  </Button>
                )}
              </div>
            </div>
          )}

          {aiJobStatus === "COMPLETED" && aiOutputs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {aiOutputs.map((output, index) => (
                <Card key={index} className={`overflow-hidden ${aiSelectedImage === output.url ? "ring-2 ring-primary" : ""}`}>
                  <CardContent className="p-2">
                    <img
                      src={output.url}
                      alt={`AI suggestion ${index + 1}`}
                      className="w-full h-32 object-cover rounded-md"
                    />
                    <Button
                      type="button"
                      variant={aiSelectedImage === output.url ? "default" : "outline"}
                      className="w-full mt-2"
                      onClick={() => {
                        setAiSelectedImage(output.url)
                        setAiSelectedIndex(index)
                      }}
                      disabled={aiConfirming}
                    >
                      {aiSelectedImage === output.url ? "انتخاب شده" : "انتخاب تصویر"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {aiJobStatus === "FAILED" && (
            <div className="text-center py-8 space-y-4">
              <p className="text-destructive">{aiError || "خطا در تولید تصویر"}</p>
              <Button type="button" variant="outline" onClick={retryAiJob}>
                تلاش مجدد
              </Button>
            </div>
          )}

          {aiError && aiJobStatus !== "FAILED" && (
            <div className="text-center py-8 space-y-4">
              <p className="text-destructive">{aiError}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {aiJobId && isAiJobInFlight(aiJobStatus) && (
                  <Button type="button" variant="outline" onClick={() => pollAiJob(aiJobId)}>
                    <RotateCcw className="h-4 w-4 ml-2" />
                    ادامه پیگیری
                  </Button>
                )}
                {aiJobId && isAiJobInFlight(aiJobStatus) && (
                  <Button type="button" variant="outline" onClick={cancelAiJob} disabled={aiCanceling}>
                    {aiCanceling ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Ban className="h-4 w-4 ml-2" />}
                    لغو درخواست
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={retryAiJob}>
                  تلاش مجدد
                </Button>
              </div>
            </div>
          )}

          {aiJobStatus === "COMPLETED" && aiSelectedImage && aiSelectedIndex !== null && (
            <DialogFooter>
              <Button
                type="button"
                onClick={() => handleAiSelectImage(aiSelectedImage, aiSelectedIndex)}
                disabled={aiConfirming}
                className="w-full"
              >
                {aiConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    در حال اعمال...
                  </>
                ) : (
                  "اعمال تصویر انتخاب شده"
                )}
              </Button>
            </DialogFooter>
          )}

          {!aiLoading && !aiPolling && aiJobStatus !== "COMPLETED" && aiJobStatus !== "FAILED" && !aiError && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                با استفاده از هوش مصنوعی، ۳ تصویر پیشنهادی برای محصول شما تولید می‌شود.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" onClick={createAiJob} disabled={aiLoading || aiPolling}>
                  <Sparkles className="h-4 w-4 ml-2" />
                  شروع تولید تصاویر
                </Button>
                <Button type="button" variant="outline" onClick={recoverLatestAiJob} disabled={aiLoading || aiPolling}>
                  <RotateCcw className="h-4 w-4 ml-2" />
                  ادامه آخرین درخواست
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
