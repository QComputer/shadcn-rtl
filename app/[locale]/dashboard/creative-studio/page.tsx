"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import {
  AlertTriangle,
  Ban,
  Clock,
  Eye,
  ImageIcon,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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
import { toPersianDigits } from "@/lib/persian"

const GENERATION_POLL_INTERVAL_MS = 3000
const GENERATION_MAX_POLL_ATTEMPTS = 90

type CreativeStudioJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED"
type CreativeStudioAssetStatus = "DRAFT" | "SELECTED" | "APPLIED" | "REJECTED"
type CreativeStudioTargetType = "PRODUCT" | "CAMPAIGN" | "FANPAGE_POST" | "ORGANIZATION_BRAND" | "IMPORTED_MEDIA"
type CreativeStudioAssetType = "PRODUCT_IMAGE" | "CAMPAIGN_IMAGE" | "FANPAGE_IMAGE" | "LOGO" | "COVER" | "OG_IMAGE" | "IMPORT_MEDIA"
type CreativeStudioUsageAction = "JOB_CREATED" | "JOB_CANCELED" | "ASSET_DRAFTED" | "ASSET_SELECTED" | "ASSET_APPLIED"
type CreativeStudioApplyTargetField = "product.image" | "organization.logo" | "organization.coverImage" | "fanpagePost.image"

type OrganizationOption = {
  id: string
  name: string
  slug: string
  type: string
}

type ProductOption = {
  id: string
  name: string
  slug?: string | null
  image?: string | null
  category?: { id: string; name: string } | null
}

type CreativeStudioStatus = {
  enabled: boolean
  provider: "MOCK" | string
  realProviderEnabled: boolean
  planningGate: string
  serverFoundation: string
  canCreateJob: boolean
  limits: {
    dailyJobLimit: number
    remainingDailyJobs: number
  }
  policy: {
    sellerInitiated: boolean
    draftOnly: boolean
    applyEndpointRecordsOnly: boolean
    noPublicAssetMutation: boolean
  }
  generationReadiness?: {
    phase: "P111" | "P112"
    generationRequestEnabled: boolean
    generationUiEnabled: boolean
    browserWorkerCallsAllowed: false
    serverOnly: true
    noNewProviders: true
    service: {
      enabled: boolean
      configured: boolean
      ready: boolean
      urlConfigured: boolean
      internalKeyConfigured: boolean
      timeoutMs: number
    }
    remote: {
      ok: boolean
      checked: boolean
      checks: Array<{ endpoint: string; ok: boolean; status: number | null; code?: string }>
    } | null
    contract: {
      version: string
      createEndpoint: string
      supportedTargets: Array<{ targetType: CreativeStudioTargetType; assetType: CreativeStudioAssetType; targetField: CreativeStudioApplyTargetField }>
      unsupportedTargets: CreativeStudioTargetType[]
    }
    organizationBrandPlan?: {
      phase: "P114"
      targetType: "ORGANIZATION_BRAND"
      generationRequestEnabled: false
      generationUiEnabled: false
      requestControlsPhase?: "P115"
      requestControlsEnabled?: boolean
      providerExecutionEnabled?: boolean
      requestOnlyJobPersistence?: boolean
      providerContractReady: false
      selectionStillRequired: true
      applyStillRequiresConfirmation: true
      publicAutoApplyAllowed: false
      supportedAssets: Array<{
        assetType: "LOGO" | "COVER"
        targetField: "organization.logo" | "organization.coverImage"
        recommendedAspectRatio: "1:1" | "16:9"
        publicApplyPath: string
      }>
      requiredProviderContract: {
        version: string
        createEndpoint: string
        statusEndpoint: string
        cancelEndpoint: string
      }
      readinessChecklist: string[]
      blockers: string[]
    }
    blockers: string[]
    nextPhase: string
  }
}

type CreativeStudioUsageEvent = {
  id: string
  action: CreativeStudioUsageAction
  provider: string
  targetType?: CreativeStudioTargetType | null
  targetId?: string | null
  jobId?: string | null
  assetId?: string | null
  units: number
  createdAt: string
}

type CreativeStudioUsage = {
  dateStart: string
  dailyJobLimit: number
  jobCreateCount: number
  assetDraftCount: number
  assetAppliedCount: number
  remainingDailyJobs: number
  canCreateJob: boolean
  events: CreativeStudioUsageEvent[]
}

type CreativeStudioAsset = {
  id: string
  assetType: CreativeStudioAssetType
  status: CreativeStudioAssetStatus
  sourceUrl?: string | null
  draftUrl?: string | null
  storedUrl?: string | null
  sourceMetadata?: Record<string, unknown> | null
  createdAt: string
  appliedAt?: string | null
}

type CreativeStudioApplyResponse = {
  applied: boolean
  recordedOnly: boolean
  publicMutation: boolean
  appliedUrl?: string | null
  previousValue?: string | null
  target?: {
    type: CreativeStudioTargetType
    id: string
    field: CreativeStudioApplyTargetField
  }
  revalidation?: {
    attempted: boolean
    paths: string[]
    warnings: string[]
  }
}

type CreativeStudioJob = {
  id: string
  organizationId: string
  targetType: CreativeStudioTargetType
  targetId?: string | null
  status: CreativeStudioJobStatus
  provider: string
  prompt?: string | null
  outputCount: number
  createdAt: string
  completedAt?: string | null
  assets?: CreativeStudioAsset[]
  usageEvents?: CreativeStudioUsageEvent[]
}

type CreativeStudioCopy = {
  title: string
  subtitle: string
  organization: string
  refresh: string
  loading: string
  error: string
  status: string
  usage: string
  jobs: string
  details: string
  assets: string
  events: string
  empty: string
  provider: string
  realProvider: string
  dailyLimit: string
  remaining: string
  jobCreates: string
  draftedAssets: string
  appliedAssets: string
  publicMutation: string
  draftOnly: string
  selectedJob: string
  prompt: string
  target: string
  date: string
  view: string
  noSelection: string
  policyYes: string
  policyNo: string
  applyPublic: string
  applyOnProduct: string
  applyAsLogo: string
  applyAsCover: string
  applyOnFanpage: string
  applyUnavailable: string
  publicUrlRequired: string
  unsupportedAsset: string
  alreadyApplied: string
  confirmationTitle: string
  confirmationDescription: string
  confirmationPlaceholder: string
  confirmationRequired: string
  applying: string
  applySuccess: string
  applyFailed: string
  targetField: string
  previousImage: string
  currentImage: string
  appliedUrl: string
  cacheUpdated: string
  cacheWarning: string
  readiness: string
  generationGate: string
  generationDisabled: string
  aiServiceReady: string
  contractVersion: string
  supportedGeneration: string
  unsupportedGeneration: string
  serverOnly: string
  browserCalls: string
  readinessBlockers: string
  brandGenerationPlan: string
  logoCoverReadiness: string
  providerContract: string
  plannedBrandTargets: string
  brandGenerationDisabled: string
  applyStillManual: string
  brandRequestForm: string
  brandAsset: string
  brandPromptPlaceholder: string
  requestOnlyMode: string
  providerExecution: string
  startBrandRequest: string
  startingBrandRequest: string
  brandRequestStarted: string
  brandRequestFailed: string
  generationForm: string
  product: string
  productPlaceholder: string
  generationPrompt: string
  generationPromptPlaceholder: string
  imageCount: string
  aspectRatio: string
  stylePreset: string
  startGeneration: string
  startingGeneration: string
  generationStarted: string
  generationFailed: string
  generationInProgress: string
  generationComplete: string
  continuePolling: string
  cancelGeneration: string
  cancelingGeneration: string
  pollingAttempts: string
  remoteUnavailable: string
  noProductSelected: string
  generatedReview: string
  selectAsset: string
  selectingAsset: string
  selectedAsset: string
  selectSuccess: string
  selectFailed: string
  selectionNoMutation: string
  selectBeforeApply: string
  statuses: Record<CreativeStudioJobStatus | CreativeStudioAssetStatus, string>
  targetTypes: Record<CreativeStudioTargetType, string>
  assetTypes: Record<CreativeStudioAssetType, string>
  actions: Record<CreativeStudioUsageAction, string>
}

const copyByLocale: Record<string, CreativeStudioCopy> = {
  fa: {
    title: "استودیوی خلاقیت",
    subtitle: "مرور وضعیت، مصرف، درخواست‌ها و دارایی‌های پیش‌نویس",
    organization: "سازمان",
    refresh: "تازه‌سازی",
    loading: "در حال بارگذاری استودیوی خلاقیت...",
    error: "بارگذاری استودیوی خلاقیت ناموفق بود",
    status: "وضعیت",
    usage: "مصرف امروز",
    jobs: "درخواست‌ها",
    details: "جزئیات درخواست",
    assets: "دارایی‌های پیش‌نویس",
    events: "رویدادها",
    empty: "هنوز موردی ثبت نشده است.",
    provider: "ارائه‌دهنده",
    realProvider: "ارائه‌دهنده واقعی",
    dailyLimit: "سقف روزانه",
    remaining: "باقی‌مانده",
    jobCreates: "درخواست ساخته‌شده",
    draftedAssets: "دارایی پیش‌نویس",
    appliedAssets: "ثبت اعمال",
    publicMutation: "تغییر عمومی",
    draftOnly: "فقط پیش‌نویس",
    selectedJob: "درخواست انتخاب‌شده",
    prompt: "پرامپت",
    target: "هدف",
    date: "تاریخ",
    view: "مشاهده",
    noSelection: "برای دیدن جزئیات، یک درخواست را انتخاب کنید.",
    policyYes: "فعال",
    policyNo: "غیرفعال",
    applyPublic: "اعمال روی هدف عمومی",
    applyOnProduct: "اعمال روی محصول",
    applyAsLogo: "اعمال به‌عنوان لوگو",
    applyAsCover: "اعمال به‌عنوان کاور",
    applyOnFanpage: "اعمال روی پست فن‌پیج",
    applyUnavailable: "قابل اعمال نیست",
    publicUrlRequired: "این دارایی هنوز URL عمومی قابل استفاده ندارد.",
    unsupportedAsset: "این نوع دارایی در این فاز قابل اعمال نیست.",
    alreadyApplied: "این دارایی قبلا اعمال شده است.",
    confirmationTitle: "تایید اعمال دارایی",
    confirmationDescription: "این تغییر روی صفحه عمومی فروشگاه دیده می‌شود. برای تایید، عبارت «اعمال شود» را وارد کنید.",
    confirmationPlaceholder: "اعمال شود",
    confirmationRequired: "برای اعمال، عبارت «اعمال شود» را وارد کنید.",
    applying: "در حال اعمال...",
    applySuccess: "دارایی با موفقیت روی هدف عمومی اعمال شد.",
    applyFailed: "اعمال دارایی ناموفق بود.",
    targetField: "فیلد هدف",
    previousImage: "تصویر قبلی",
    currentImage: "تصویر فعلی",
    appliedUrl: "URL اعمال‌شده",
    cacheUpdated: "کش صفحات عمومی پس از اعمال به‌روزرسانی می‌شود.",
    cacheWarning: "هشدار به‌روزرسانی کش",
    readiness: "آمادگی تولید",
    generationGate: "دروازه آمادگی تولید",
    generationDisabled: "در این فاز فرم تولید یا فراخوانی ارائه‌دهنده فعال نیست.",
    aiServiceReady: "آمادگی سرویس AI",
    contractVersion: "نسخه قرارداد",
    supportedGeneration: "هدف‌های پشتیبانی‌شده",
    unsupportedGeneration: "هدف‌های خارج از این فاز",
    serverOnly: "فقط سمت سرور",
    browserCalls: "فراخوانی مستقیم مرورگر",
    readinessBlockers: "موانع آمادگی",
    brandGenerationPlan: "برنامه تولید برند سازمان",
    logoCoverReadiness: "آمادگی لوگو و کاور",
    providerContract: "قرارداد ارائه‌دهنده",
    plannedBrandTargets: "هدف‌های برند برنامه‌ریزی‌شده",
    brandGenerationDisabled: "اجرای ارائه‌دهنده برای لوگو و کاور هنوز فعال نیست؛ درخواست فقط به‌صورت پیش‌نویس داخلی ثبت می‌شود.",
    applyStillManual: "اعمال عمومی همچنان با انتخاب داخلی و تایید جداگانه انجام می‌شود.",
    brandRequestForm: "درخواست لوگو و کاور",
    brandAsset: "دارایی برند",
    brandPromptPlaceholder: "مثلا: لوگوی مینیمال با حس محلی، کاور روشن برای صفحه فروشگاه",
    requestOnlyMode: "ثبت درخواست داخلی",
    providerExecution: "اجرای ارائه‌دهنده",
    startBrandRequest: "ثبت درخواست برند",
    startingBrandRequest: "در حال ثبت...",
    brandRequestStarted: "درخواست لوگو/کاور به‌صورت پیش‌نویس داخلی ثبت شد.",
    brandRequestFailed: "ثبت درخواست لوگو/کاور ناموفق بود.",
    generationForm: "ساخت تصویر محصول",
    product: "محصول",
    productPlaceholder: "یک محصول را انتخاب کنید",
    generationPrompt: "توضیح تکمیلی",
    generationPromptPlaceholder: "مثلا: نور طبیعی، پس‌زمینه ساده، تمرکز روی بسته‌بندی",
    imageCount: "تعداد تصویر",
    aspectRatio: "نسبت تصویر",
    stylePreset: "سبک",
    startGeneration: "شروع تولید",
    startingGeneration: "در حال شروع...",
    generationStarted: "درخواست تولید تصویر محصول ثبت شد.",
    generationFailed: "ثبت درخواست تولید تصویر ناموفق بود.",
    generationInProgress: "در حال تولید تصویر",
    generationComplete: "تصاویر پیشنهادی آماده بررسی هستند.",
    continuePolling: "ادامه پیگیری",
    cancelGeneration: "لغو تولید",
    cancelingGeneration: "در حال لغو...",
    pollingAttempts: "تعداد پیگیری",
    remoteUnavailable: "ارتباط با سرویس تصویر موقتا در دسترس نیست؛ آخرین وضعیت ذخیره‌شده نمایش داده می‌شود.",
    noProductSelected: "برای شروع تولید، ابتدا محصول را انتخاب کنید.",
    generatedReview: "بررسی و انتخاب خروجی‌ها",
    selectAsset: "انتخاب این تصویر",
    selectingAsset: "در حال انتخاب...",
    selectedAsset: "تصویر انتخاب‌شده",
    selectSuccess: "تصویر پیشنهادی انتخاب شد؛ اعمال عمومی هنوز نیازمند تایید جداگانه است.",
    selectFailed: "انتخاب تصویر پیشنهادی ناموفق بود.",
    selectionNoMutation: "انتخاب فقط برای مرور داخلی است و صفحه عمومی را تغییر نمی‌دهد.",
    selectBeforeApply: "ابتدا گزینه مناسب را انتخاب کنید، سپس در صورت تایید آن را اعمال کنید.",
    statuses: {
      QUEUED: "در صف",
      PROCESSING: "در حال پردازش",
      COMPLETED: "تکمیل‌شده",
      FAILED: "ناموفق",
      CANCELED: "لغوشده",
      DRAFT: "پیش‌نویس",
      SELECTED: "انتخاب‌شده",
      APPLIED: "ثبت‌شده",
      REJECTED: "ردشده",
    },
    targetTypes: {
      PRODUCT: "محصول",
      CAMPAIGN: "کمپین",
      FANPAGE_POST: "پست فن‌پیج",
      ORGANIZATION_BRAND: "برند سازمان",
      IMPORTED_MEDIA: "رسانه واردشده",
    },
    assetTypes: {
      PRODUCT_IMAGE: "تصویر محصول",
      CAMPAIGN_IMAGE: "تصویر کمپین",
      FANPAGE_IMAGE: "تصویر فن‌پیج",
      LOGO: "لوگو",
      COVER: "کاور",
      OG_IMAGE: "تصویر اشتراک",
      IMPORT_MEDIA: "رسانه وارداتی",
    },
    actions: {
      JOB_CREATED: "درخواست ساخته شد",
      JOB_CANCELED: "درخواست لغو شد",
      ASSET_DRAFTED: "دارایی پیش‌نویس شد",
      ASSET_SELECTED: "دارایی انتخاب شد",
      ASSET_APPLIED: "اعمال دارایی ثبت شد",
    },
  },
  en: {
    title: "Creative Studio",
    subtitle: "Review status, usage, jobs, and draft assets",
    organization: "Organization",
    refresh: "Refresh",
    loading: "Loading Creative Studio...",
    error: "Creative Studio could not be loaded",
    status: "Status",
    usage: "Today usage",
    jobs: "Jobs",
    details: "Job details",
    assets: "Draft assets",
    events: "Events",
    empty: "Nothing has been recorded yet.",
    provider: "Provider",
    realProvider: "Real provider",
    dailyLimit: "Daily limit",
    remaining: "Remaining",
    jobCreates: "Jobs created",
    draftedAssets: "Draft assets",
    appliedAssets: "Apply records",
    publicMutation: "Public mutation",
    draftOnly: "Draft only",
    selectedJob: "Selected job",
    prompt: "Prompt",
    target: "Target",
    date: "Date",
    view: "View",
    noSelection: "Select a job to review its details.",
    policyYes: "Enabled",
    policyNo: "Disabled",
    applyPublic: "Apply to public target",
    applyOnProduct: "Apply to product",
    applyAsLogo: "Apply as logo",
    applyAsCover: "Apply as cover",
    applyOnFanpage: "Apply to fanpage post",
    applyUnavailable: "Cannot apply",
    publicUrlRequired: "This asset does not have a public URL yet.",
    unsupportedAsset: "This asset type cannot be applied in this phase.",
    alreadyApplied: "This asset has already been applied.",
    confirmationTitle: "Confirm asset application",
    confirmationDescription: "This change will be visible on the public shop page. To confirm, enter “اعمال شود”.",
    confirmationPlaceholder: "اعمال شود",
    confirmationRequired: "Enter “اعمال شود” to apply.",
    applying: "Applying...",
    applySuccess: "Asset applied to the public target.",
    applyFailed: "Asset application failed.",
    targetField: "Target field",
    previousImage: "Previous image",
    currentImage: "Current image",
    appliedUrl: "Applied URL",
    cacheUpdated: "Public page cache is refreshed after apply.",
    cacheWarning: "Cache warning",
    readiness: "Generation readiness",
    generationGate: "Generation readiness gate",
    generationDisabled: "This phase does not enable generation forms or provider calls.",
    aiServiceReady: "AI service readiness",
    contractVersion: "Contract version",
    supportedGeneration: "Supported targets",
    unsupportedGeneration: "Out of scope targets",
    serverOnly: "Server-only",
    browserCalls: "Direct browser calls",
    readinessBlockers: "Readiness blockers",
    brandGenerationPlan: "Organization brand generation plan",
    logoCoverReadiness: "Logo and cover readiness",
    providerContract: "Provider contract",
    plannedBrandTargets: "Planned brand targets",
    brandGenerationDisabled: "Logo and cover provider execution is still disabled; requests are recorded as internal drafts only.",
    applyStillManual: "Public apply still requires internal selection and separate confirmation.",
    brandRequestForm: "Logo and cover requests",
    brandAsset: "Brand asset",
    brandPromptPlaceholder: "Example: minimal logo with local warmth, bright cover for the shop page",
    requestOnlyMode: "Internal request record",
    providerExecution: "Provider execution",
    startBrandRequest: "Record brand request",
    startingBrandRequest: "Recording...",
    brandRequestStarted: "Logo/cover request was recorded as an internal draft.",
    brandRequestFailed: "Could not record logo/cover request.",
    generationForm: "Product image generation",
    product: "Product",
    productPlaceholder: "Select a product",
    generationPrompt: "Extra direction",
    generationPromptPlaceholder: "Example: natural light, simple background, focus on packaging",
    imageCount: "Image count",
    aspectRatio: "Aspect ratio",
    stylePreset: "Style",
    startGeneration: "Start generation",
    startingGeneration: "Starting...",
    generationStarted: "Product image generation request was created.",
    generationFailed: "Could not create product image generation request.",
    generationInProgress: "Image generation in progress",
    generationComplete: "Suggested images are ready for review.",
    continuePolling: "Continue polling",
    cancelGeneration: "Cancel generation",
    cancelingGeneration: "Canceling...",
    pollingAttempts: "Polling attempts",
    remoteUnavailable: "The image service is temporarily unavailable; the latest stored status is shown.",
    noProductSelected: "Select a product before starting generation.",
    generatedReview: "Review and select outputs",
    selectAsset: "Select this image",
    selectingAsset: "Selecting...",
    selectedAsset: "Selected image",
    selectSuccess: "Suggested image was selected; public apply still requires separate confirmation.",
    selectFailed: "Could not select suggested image.",
    selectionNoMutation: "Selection is internal review only and does not change the public page.",
    selectBeforeApply: "Select the best option first, then apply it when confirmed.",
    statuses: {
      QUEUED: "Queued",
      PROCESSING: "Processing",
      COMPLETED: "Completed",
      FAILED: "Failed",
      CANCELED: "Canceled",
      DRAFT: "Draft",
      SELECTED: "Selected",
      APPLIED: "Recorded",
      REJECTED: "Rejected",
    },
    targetTypes: {
      PRODUCT: "Product",
      CAMPAIGN: "Campaign",
      FANPAGE_POST: "Fanpage post",
      ORGANIZATION_BRAND: "Organization brand",
      IMPORTED_MEDIA: "Imported media",
    },
    assetTypes: {
      PRODUCT_IMAGE: "Product image",
      CAMPAIGN_IMAGE: "Campaign image",
      FANPAGE_IMAGE: "Fanpage image",
      LOGO: "Logo",
      COVER: "Cover",
      OG_IMAGE: "Share image",
      IMPORT_MEDIA: "Import media",
    },
    actions: {
      JOB_CREATED: "Job created",
      JOB_CANCELED: "Job canceled",
      ASSET_DRAFTED: "Asset drafted",
      ASSET_SELECTED: "Asset selected",
      ASSET_APPLIED: "Asset apply recorded",
    },
  },
  ar: {
    title: "استوديو الإبداع",
    subtitle: "مراجعة الحالة والاستخدام والطلبات والأصول المسودة",
    organization: "المؤسسة",
    refresh: "تحديث",
    loading: "جار تحميل استوديو الإبداع...",
    error: "تعذر تحميل استوديو الإبداع",
    status: "الحالة",
    usage: "استخدام اليوم",
    jobs: "الطلبات",
    details: "تفاصيل الطلب",
    assets: "الأصول المسودة",
    events: "الأحداث",
    empty: "لا توجد عناصر مسجلة بعد.",
    provider: "المزود",
    realProvider: "المزود الحقيقي",
    dailyLimit: "الحد اليومي",
    remaining: "المتبقي",
    jobCreates: "طلبات منشأة",
    draftedAssets: "أصول مسودة",
    appliedAssets: "سجلات تطبيق",
    publicMutation: "تغيير عام",
    draftOnly: "مسودة فقط",
    selectedJob: "الطلب المحدد",
    prompt: "الموجه",
    target: "الهدف",
    date: "التاريخ",
    view: "عرض",
    noSelection: "اختر طلبا لمراجعة تفاصيله.",
    policyYes: "مفعل",
    policyNo: "غير مفعل",
    applyPublic: "تطبيق على الهدف العام",
    applyOnProduct: "تطبيق على المنتج",
    applyAsLogo: "تطبيق كشعار",
    applyAsCover: "تطبيق كغلاف",
    applyOnFanpage: "تطبيق على منشور الصفحة",
    applyUnavailable: "غير قابل للتطبيق",
    publicUrlRequired: "لا يحتوي هذا الأصل على رابط عام قابل للاستخدام بعد.",
    unsupportedAsset: "هذا النوع من الأصول غير قابل للتطبيق في هذه المرحلة.",
    alreadyApplied: "تم تطبيق هذا الأصل مسبقا.",
    confirmationTitle: "تأكيد تطبيق الأصل",
    confirmationDescription: "سيظهر هذا التغيير في صفحة المتجر العامة. للتأكيد، أدخل «اعمال شود».",
    confirmationPlaceholder: "اعمال شود",
    confirmationRequired: "أدخل «اعمال شود» للتطبيق.",
    applying: "جار التطبيق...",
    applySuccess: "تم تطبيق الأصل على الهدف العام.",
    applyFailed: "فشل تطبيق الأصل.",
    targetField: "حقل الهدف",
    previousImage: "الصورة السابقة",
    currentImage: "الصورة الحالية",
    appliedUrl: "الرابط المطبق",
    cacheUpdated: "يتم تحديث كاش الصفحات العامة بعد التطبيق.",
    cacheWarning: "تحذير الكاش",
    readiness: "جاهزية التوليد",
    generationGate: "بوابة جاهزية التوليد",
    generationDisabled: "لا تفعل هذه المرحلة نماذج التوليد أو استدعاءات المزود.",
    aiServiceReady: "جاهزية خدمة AI",
    contractVersion: "نسخة العقد",
    supportedGeneration: "الأهداف المدعومة",
    unsupportedGeneration: "الأهداف خارج النطاق",
    serverOnly: "الخادم فقط",
    browserCalls: "استدعاءات المتصفح المباشرة",
    readinessBlockers: "عوائق الجاهزية",
    brandGenerationPlan: "خطة توليد علامة المؤسسة",
    logoCoverReadiness: "جاهزية الشعار والغلاف",
    providerContract: "عقد المزود",
    plannedBrandTargets: "أهداف العلامة المخططة",
    brandGenerationDisabled: "تنفيذ مزود الشعار والغلاف لا يزال معطلا؛ يتم تسجيل الطلبات كمسودات داخلية فقط.",
    applyStillManual: "يتطلب التطبيق العام اختيارا داخليا وتأكيدا منفصلا.",
    brandRequestForm: "طلبات الشعار والغلاف",
    brandAsset: "أصل العلامة",
    brandPromptPlaceholder: "مثال: شعار بسيط بطابع محلي، غلاف مضيء لصفحة المتجر",
    requestOnlyMode: "سجل طلب داخلي",
    providerExecution: "تنفيذ المزود",
    startBrandRequest: "تسجيل طلب العلامة",
    startingBrandRequest: "جار التسجيل...",
    brandRequestStarted: "تم تسجيل طلب الشعار/الغلاف كمسودة داخلية.",
    brandRequestFailed: "تعذر تسجيل طلب الشعار/الغلاف.",
    generationForm: "توليد صورة المنتج",
    product: "المنتج",
    productPlaceholder: "اختر منتجا",
    generationPrompt: "توجيه إضافي",
    generationPromptPlaceholder: "مثال: إضاءة طبيعية، خلفية بسيطة، تركيز على التغليف",
    imageCount: "عدد الصور",
    aspectRatio: "نسبة الصورة",
    stylePreset: "النمط",
    startGeneration: "بدء التوليد",
    startingGeneration: "جار البدء...",
    generationStarted: "تم إنشاء طلب توليد صورة المنتج.",
    generationFailed: "تعذر إنشاء طلب توليد صورة المنتج.",
    generationInProgress: "توليد الصورة قيد التنفيذ",
    generationComplete: "الصور المقترحة جاهزة للمراجعة.",
    continuePolling: "متابعة التحقق",
    cancelGeneration: "إلغاء التوليد",
    cancelingGeneration: "جار الإلغاء...",
    pollingAttempts: "عدد محاولات التحقق",
    remoteUnavailable: "خدمة الصور غير متاحة مؤقتا؛ يتم عرض آخر حالة محفوظة.",
    noProductSelected: "اختر منتجا قبل بدء التوليد.",
    generatedReview: "مراجعة واختيار المخرجات",
    selectAsset: "اختر هذه الصورة",
    selectingAsset: "جار الاختيار...",
    selectedAsset: "الصورة المختارة",
    selectSuccess: "تم اختيار الصورة المقترحة؛ ما زال النشر العام يحتاج إلى تأكيد منفصل.",
    selectFailed: "تعذر اختيار الصورة المقترحة.",
    selectionNoMutation: "الاختيار للمراجعة الداخلية فقط ولا يغير الصفحة العامة.",
    selectBeforeApply: "اختر الخيار الأنسب أولا، ثم طبقه عند التأكيد.",
    statuses: {
      QUEUED: "في الانتظار",
      PROCESSING: "قيد المعالجة",
      COMPLETED: "مكتمل",
      FAILED: "فشل",
      CANCELED: "ملغى",
      DRAFT: "مسودة",
      SELECTED: "محدد",
      APPLIED: "مسجل",
      REJECTED: "مرفوض",
    },
    targetTypes: {
      PRODUCT: "منتج",
      CAMPAIGN: "حملة",
      FANPAGE_POST: "منشور صفحة",
      ORGANIZATION_BRAND: "علامة المؤسسة",
      IMPORTED_MEDIA: "وسائط مستوردة",
    },
    assetTypes: {
      PRODUCT_IMAGE: "صورة منتج",
      CAMPAIGN_IMAGE: "صورة حملة",
      FANPAGE_IMAGE: "صورة صفحة",
      LOGO: "شعار",
      COVER: "غلاف",
      OG_IMAGE: "صورة مشاركة",
      IMPORT_MEDIA: "وسائط مستوردة",
    },
    actions: {
      JOB_CREATED: "تم إنشاء الطلب",
      JOB_CANCELED: "تم إلغاء الطلب",
      ASSET_DRAFTED: "تمت مسودة الأصل",
      ASSET_SELECTED: "تم تحديد الأصل",
      ASSET_APPLIED: "تم تسجيل تطبيق الأصل",
    },
  },
}

function formatNumber(value: number | null | undefined, locale: string) {
  const normalized = String(value ?? 0)
  return locale === "fa" || locale === "ar" ? toPersianDigits(normalized) : normalized
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return "-"
  return new Date(value).toLocaleString(locale === "fa" ? "fa-IR" : locale)
}

function statusVariant(status: CreativeStudioJobStatus | CreativeStudioAssetStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "FAILED" || status === "REJECTED") return "destructive"
  if (status === "COMPLETED" || status === "APPLIED" || status === "SELECTED") return "default"
  if (status === "CANCELED") return "outline"
  return "secondary"
}

function isJobInFlight(status: CreativeStudioJobStatus | string | null | undefined) {
  return status === "QUEUED" || status === "PROCESSING"
}

function getAssetPublicUrl(asset: CreativeStudioAsset) {
  return asset.storedUrl || asset.draftUrl || asset.sourceUrl || null
}

function getP110Application(asset: CreativeStudioAsset) {
  const application = asset.sourceMetadata?.p110Application
  return application && typeof application === "object" && !Array.isArray(application)
    ? application as {
        targetField?: CreativeStudioApplyTargetField
        previousValue?: string | null
        appliedUrl?: string | null
        publicMutation?: boolean
        cacheRevalidation?: { warnings?: string[]; paths?: string[] }
      }
    : null
}

function getApplyOption(job: CreativeStudioJob, asset: CreativeStudioAsset, copy: CreativeStudioCopy) {
  let targetField: CreativeStudioApplyTargetField | null = null
  let label = copy.applyPublic

  if (job.targetType === "PRODUCT" && asset.assetType === "PRODUCT_IMAGE") {
    targetField = "product.image"
    label = copy.applyOnProduct
  } else if (job.targetType === "ORGANIZATION_BRAND" && asset.assetType === "LOGO") {
    targetField = "organization.logo"
    label = copy.applyAsLogo
  } else if (job.targetType === "ORGANIZATION_BRAND" && asset.assetType === "COVER") {
    targetField = "organization.coverImage"
    label = copy.applyAsCover
  } else if (job.targetType === "FANPAGE_POST" && asset.assetType === "FANPAGE_IMAGE") {
    targetField = "fanpagePost.image"
    label = copy.applyOnFanpage
  }

  if (!targetField) return { targetField: null, label: copy.applyUnavailable, disabledReason: copy.unsupportedAsset }
  if (asset.status === "APPLIED") return { targetField, label, disabledReason: copy.alreadyApplied }
  if (!getAssetPublicUrl(asset)) return { targetField, label, disabledReason: copy.publicUrlRequired }

  return { targetField, label, disabledReason: null }
}

async function readError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === "string" ? data.error : fallback
  } catch {
    return fallback
  }
}

function metric(label: string, value: string) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

export default function CreativeStudioDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale = "fa" } = use(params)
  const copy = copyByLocale[locale] ?? copyByLocale.fa
  const { data: session, status: sessionStatus } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([])
  const [organizationId, setOrganizationId] = useState("")
  const [status, setStatus] = useState<CreativeStudioStatus | null>(null)
  const [usage, setUsage] = useState<CreativeStudioUsage | null>(null)
  const [jobs, setJobs] = useState<CreativeStudioJob[]>([])
  const [selectedJob, setSelectedJob] = useState<CreativeStudioJob | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [generationPrompt, setGenerationPrompt] = useState("")
  const [generationCount, setGenerationCount] = useState("3")
  const [generationAspectRatio, setGenerationAspectRatio] = useState("1:1")
  const [generationStylePreset, setGenerationStylePreset] = useState("LIGHT_MENU_PHOTO")
  const [generationSubmitting, setGenerationSubmitting] = useState(false)
  const [brandAssetType, setBrandAssetType] = useState<"LOGO" | "COVER">("LOGO")
  const [brandPrompt, setBrandPrompt] = useState("")
  const [brandCount, setBrandCount] = useState("2")
  const [brandStylePreset, setBrandStylePreset] = useState("BRAND_CLEAN")
  const [brandSubmitting, setBrandSubmitting] = useState(false)
  const [generationPollingJobId, setGenerationPollingJobId] = useState<string | null>(null)
  const [generationCancelingJobId, setGenerationCancelingJobId] = useState<string | null>(null)
  const [generationPollAttempts, setGenerationPollAttempts] = useState(0)
  const generationPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generationPollRunIdRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingApply, setPendingApply] = useState<{
    asset: CreativeStudioAsset
    targetField: CreativeStudioApplyTargetField
    label: string
  } | null>(null)
  const [confirmationText, setConfirmationText] = useState("")
  const [applyingAssetId, setApplyingAssetId] = useState<string | null>(null)
  const [selectingAssetId, setSelectingAssetId] = useState<string | null>(null)
  const [applyNotice, setApplyNotice] = useState<{ type: "success" | "error"; message: string; warnings?: string[] } | null>(null)
  const [generationNotice, setGenerationNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const fetchOrganizations = useCallback(async (signal?: AbortSignal) => {
    if (isSuperAdmin) {
      const response = await fetch("/api/organizations?pageSize=100", { cache: "no-store", signal })
      if (!response.ok) throw new Error(await readError(response, copy.error))
      const data = await response.json()
      const options = (data.data ?? []) as OrganizationOption[]
      setOrganizations(options)
      const nextOrganizationId = organizationId || options[0]?.id || ""
      setOrganizationId(nextOrganizationId)
      return nextOrganizationId
    }

    const response = await fetch("/api/users/me/membership", { cache: "no-store", signal })
    if (!response.ok) throw new Error(await readError(response, copy.error))
    const data = await response.json()
    const membership = data.membership
    const option = membership
      ? {
          id: membership.organizationId,
          name: membership.organizationName,
          slug: membership.organizationSlug,
          type: membership.organizationType,
        }
      : null
    setOrganizations(option ? [option] : [])
    setOrganizationId(option?.id || "")
    return option?.id || ""
  }, [copy.error, isSuperAdmin, organizationId])

  const fetchProductsForOrganization = useCallback(async (orgId: string, signal?: AbortSignal) => {
    if (!orgId) {
      setProducts([])
      setSelectedProductId("")
      return
    }

    const params = new URLSearchParams({
      pageSize: "100",
      isActive: "true",
      organizationId: orgId,
    })
    const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store", signal })
    if (!response.ok) throw new Error(await readError(response, copy.error))
    const data = await response.json()
    const nextProducts = (data.data ?? []) as ProductOption[]
    setProducts(nextProducts)
    setSelectedProductId((current) => current && nextProducts.some((product) => product.id === current)
      ? current
      : nextProducts[0]?.id || "")
  }, [copy.error])

  const loadOverview = useCallback(async (orgId: string, signal?: AbortSignal) => {
    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : ""
    const [statusResponse, usageResponse, jobsResponse] = await Promise.all([
      fetch(`/api/dashboard/creative-studio/status${query}`, { cache: "no-store", signal }),
      fetch(`/api/dashboard/creative-studio/usage${query}`, { cache: "no-store", signal }),
      fetch(`/api/dashboard/creative-studio/jobs${query}`, { cache: "no-store", signal }),
    ])

    if (!statusResponse.ok) throw new Error(await readError(statusResponse, copy.error))
    if (!usageResponse.ok) throw new Error(await readError(usageResponse, copy.error))
    if (!jobsResponse.ok) throw new Error(await readError(jobsResponse, copy.error))

    const statusData = await statusResponse.json()
    const usageData = await usageResponse.json()
    const jobsData = await jobsResponse.json()
    setStatus(statusData.status as CreativeStudioStatus)
    setUsage(usageData.usage as CreativeStudioUsage)
    setJobs((jobsData.jobs ?? []) as CreativeStudioJob[])
  }, [copy.error])

  const loadJob = useCallback(async (jobId: string, orgId = organizationId, signal?: AbortSignal) => {
    const query = orgId ? `?organizationId=${encodeURIComponent(orgId)}` : ""
    const response = await fetch(`/api/dashboard/creative-studio/jobs/${encodeURIComponent(jobId)}${query}`, {
      cache: "no-store",
      signal,
    })
    if (!response.ok) {
      setError(await readError(response, copy.error))
      return
    }
    const data = await response.json()
    setSelectedJob(data.job as CreativeStudioJob)
  }, [copy.error, organizationId])

  const refresh = useCallback(async (signal?: AbortSignal, explicitOrganizationId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const orgId = explicitOrganizationId || await fetchOrganizations(signal)
      await fetchProductsForOrganization(orgId, signal)
      await loadOverview(orgId, signal)
      if (selectedJob?.organizationId === orgId) {
        await loadJob(selectedJob.id, orgId, signal)
      }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : copy.error)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [copy.error, fetchOrganizations, fetchProductsForOrganization, loadOverview, selectedJob?.id, selectedJob?.organizationId])

  useEffect(() => {
    if (sessionStatus === "loading") return
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh, sessionStatus])

  useEffect(() => {
    return () => {
      generationPollRunIdRef.current += 1
      if (generationPollTimerRef.current) {
        clearTimeout(generationPollTimerRef.current)
        generationPollTimerRef.current = null
      }
    }
  }, [])

  async function selectOrganization(nextOrganizationId: string) {
    generationPollRunIdRef.current += 1
    if (generationPollTimerRef.current) {
      clearTimeout(generationPollTimerRef.current)
      generationPollTimerRef.current = null
    }
    setOrganizationId(nextOrganizationId)
    setSelectedJob(null)
    setApplyNotice(null)
    setGenerationNotice(null)
    setGenerationPollingJobId(null)
    setGenerationPollAttempts(0)
    await refresh(undefined, nextOrganizationId)
  }

  async function startProductImageGeneration() {
    if (!selectedProductId) {
      setGenerationNotice({ type: "error", message: copy.noProductSelected })
      return
    }

    setGenerationSubmitting(true)
    setGenerationNotice(null)
    setApplyNotice(null)
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
      const response = await fetch(`/api/dashboard/creative-studio/jobs${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          targetType: "PRODUCT",
          targetId: selectedProductId,
          assetType: "PRODUCT_IMAGE",
          prompt: generationPrompt.trim() || undefined,
          count: Number.parseInt(generationCount, 10),
          aspect_ratio: generationAspectRatio,
          style_preset: generationStylePreset,
          metadata: {
            p112Request: true,
            requestedFrom: "creative-studio-dashboard",
          },
        }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.generationFailed))
      const data = await response.json()
      const job = data.job as CreativeStudioJob
      setGenerationNotice({ type: "success", message: copy.generationStarted })
      await loadOverview(organizationId)
      await loadJob(job.id, organizationId)
      if (isJobInFlight(job.status)) {
        pollCreativeStudioJob(job.id)
      }
    } catch (err) {
      setGenerationNotice({ type: "error", message: err instanceof Error ? err.message : copy.generationFailed })
    } finally {
      setGenerationSubmitting(false)
    }
  }

  async function startOrganizationBrandGeneration() {
    setBrandSubmitting(true)
    setGenerationNotice(null)
    setApplyNotice(null)
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
      const response = await fetch(`/api/dashboard/creative-studio/jobs${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          targetType: "ORGANIZATION_BRAND",
          assetType: brandAssetType,
          prompt: brandPrompt.trim() || undefined,
          count: Number.parseInt(brandCount, 10),
          aspect_ratio: brandAssetType === "LOGO" ? "1:1" : "16:9",
          style_preset: brandStylePreset,
          metadata: {
            p115BrandGeneration: true,
            requestControlsOnly: true,
            providerExecutionEnabled: false,
            requestedFrom: "creative-studio-dashboard",
            targetField: brandAssetType === "LOGO" ? "organization.logo" : "organization.coverImage",
          },
        }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.brandRequestFailed))
      const data = await response.json()
      const job = data.job as CreativeStudioJob
      setGenerationNotice({ type: "success", message: copy.brandRequestStarted })
      await loadOverview(organizationId)
      await loadJob(job.id, organizationId)
    } catch (err) {
      setGenerationNotice({ type: "error", message: err instanceof Error ? err.message : copy.brandRequestFailed })
    } finally {
      setBrandSubmitting(false)
    }
  }

  function pollCreativeStudioJob(jobId: string) {
    generationPollRunIdRef.current += 1
    if (generationPollTimerRef.current) {
      clearTimeout(generationPollTimerRef.current)
      generationPollTimerRef.current = null
    }

    const runId = generationPollRunIdRef.current
    let attempts = 0
    setGenerationPollingJobId(jobId)
    setGenerationPollAttempts(0)

    const stopPolling = (message?: string, type: "success" | "error" = "success") => {
      if (generationPollRunIdRef.current !== runId) return
      if (generationPollTimerRef.current) {
        clearTimeout(generationPollTimerRef.current)
        generationPollTimerRef.current = null
      }
      setGenerationPollingJobId(null)
      if (message) setGenerationNotice({ type, message })
    }

    const pollOnce = async () => {
      if (generationPollRunIdRef.current !== runId) return
      attempts += 1
      setGenerationPollAttempts(attempts)
      try {
        await loadOverview(organizationId)
        const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
        const response = await fetch(`/api/dashboard/creative-studio/jobs/${encodeURIComponent(jobId)}${query}`, {
          cache: "no-store",
        })
        if (!response.ok) throw new Error(await readError(response, copy.error))
        const data = await response.json()
        const job = data.job as CreativeStudioJob
        setSelectedJob(job)
        if (job.status === "COMPLETED") {
          stopPolling(copy.generationComplete)
        } else if (job.status === "FAILED") {
          stopPolling(job.prompt ? copy.generationFailed : copy.generationFailed, "error")
        } else if (job.status === "CANCELED") {
          stopPolling(copy.cancelGeneration, "error")
        } else if (attempts >= GENERATION_MAX_POLL_ATTEMPTS) {
          stopPolling(copy.remoteUnavailable, "error")
        } else {
          generationPollTimerRef.current = setTimeout(pollOnce, GENERATION_POLL_INTERVAL_MS)
        }
      } catch (err) {
        stopPolling(err instanceof Error ? err.message : copy.remoteUnavailable, "error")
      }
    }

    void pollOnce()
  }

  async function cancelGenerationJob(jobId: string) {
    setGenerationCancelingJobId(jobId)
    setGenerationNotice(null)
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
      const response = await fetch(`/api/dashboard/creative-studio/jobs/${encodeURIComponent(jobId)}/cancel${query}`, {
        method: "POST",
      })
      if (!response.ok) throw new Error(await readError(response, copy.generationFailed))
      generationPollRunIdRef.current += 1
      if (generationPollTimerRef.current) {
        clearTimeout(generationPollTimerRef.current)
        generationPollTimerRef.current = null
      }
      setGenerationPollingJobId(null)
      setGenerationNotice({ type: "success", message: copy.cancelGeneration })
      await loadOverview(organizationId)
      await loadJob(jobId, organizationId)
    } catch (err) {
      setGenerationNotice({ type: "error", message: err instanceof Error ? err.message : copy.generationFailed })
    } finally {
      setGenerationCancelingJobId(null)
    }
  }

  async function selectGeneratedAsset(asset: CreativeStudioAsset) {
    if (!selectedJob) return
    const applyOption = getApplyOption(selectedJob, asset, copy)
    setSelectingAssetId(asset.id)
    setApplyNotice(null)
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
      const response = await fetch(`/api/dashboard/creative-studio/assets/${encodeURIComponent(asset.id)}/select${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          targetField: applyOption.targetField ?? undefined,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.selectFailed))
      setApplyNotice({ type: "success", message: copy.selectSuccess })
      await loadOverview(organizationId)
      await loadJob(selectedJob.id, organizationId)
    } catch (err) {
      setApplyNotice({ type: "error", message: err instanceof Error ? err.message : copy.selectFailed })
    } finally {
      setSelectingAssetId(null)
    }
  }

  async function applyPendingAsset() {
    if (!pendingApply || !selectedJob) return
    if (confirmationText.trim() !== "اعمال شود") {
      setApplyNotice({ type: "error", message: copy.confirmationRequired })
      return
    }

    setApplyingAssetId(pendingApply.asset.id)
    setApplyNotice(null)
    try {
      const query = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""
      const response = await fetch(`/api/dashboard/creative-studio/assets/${encodeURIComponent(pendingApply.asset.id)}/apply${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          applyToTarget: true,
          targetField: pendingApply.targetField,
          confirmationText: confirmationText.trim(),
        }),
      })
      if (!response.ok) throw new Error(await readError(response, copy.applyFailed))
      const result = await response.json() as CreativeStudioApplyResponse
      setApplyNotice({
        type: "success",
        message: result.publicMutation ? copy.applySuccess : copy.cacheUpdated,
        warnings: result.revalidation?.warnings ?? [],
      })
      setPendingApply(null)
      setConfirmationText("")
      await loadOverview(organizationId)
      await loadJob(selectedJob.id, organizationId)
    } catch (err) {
      setApplyNotice({ type: "error", message: err instanceof Error ? err.message : copy.applyFailed })
    } finally {
      setApplyingAssetId(null)
    }
  }

  const isReadOnlyPublicMutationBlocked = status?.policy.noPublicAssetMutation === true
  const isDraftOnly = status?.policy.draftOnly === true
  const generationReady = Boolean(
    status?.generationReadiness?.generationRequestEnabled &&
    status.generationReadiness.generationUiEnabled &&
    status.generationReadiness.service.ready &&
    status.canCreateJob
  )
  const brandRequestControlsReady = Boolean(
    status?.generationReadiness?.organizationBrandPlan?.requestControlsEnabled &&
    status.canCreateJob
  )
  const brandProviderExecutionEnabled = Boolean(status?.generationReadiness?.organizationBrandPlan?.providerExecutionEnabled)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={organizationId} onValueChange={selectOrganization} disabled={!isSuperAdmin || loading}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder={copy.organization} />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name} ({organization.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => refresh()} disabled={loading}>
            <RefreshCw className="size-4" />
            {copy.refresh}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {applyNotice && (
        <div className={`rounded-md border p-3 text-sm ${
          applyNotice.type === "success"
            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700"
            : "border-destructive/40 bg-destructive/5 text-destructive"
        }`}>
          <div>{applyNotice.message}</div>
          {applyNotice.warnings?.length ? (
            <div className="mt-2 space-y-1 text-xs">
              {applyNotice.warnings.map((warning) => (
                <div key={warning}>{copy.cacheWarning}: {warning}</div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {generationNotice && (
        <div className={`rounded-md border p-3 text-sm ${
          generationNotice.type === "success"
            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700"
            : "border-destructive/40 bg-destructive/5 text-destructive"
        }`}>
          {generationNotice.message}
        </div>
      )}

      {loading ? (
        <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">{copy.loading}</div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="size-4" />
                  {copy.status}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.provider}</span>
                  <Badge variant="secondary">{status?.provider ?? "MOCK"}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.realProvider}</span>
                  <Badge variant={status?.realProviderEnabled ? "default" : "outline"}>
                    {status?.realProviderEnabled ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.draftOnly}</span>
                  <Badge variant={isDraftOnly ? "default" : "destructive"}>
                    {isDraftOnly ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{copy.publicMutation}</span>
                  <Badge variant={isReadOnlyPublicMutationBlocked ? "outline" : "destructive"}>
                    {isReadOnlyPublicMutationBlocked ? copy.policyNo : copy.policyYes}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4" />
                  {copy.usage}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {metric(copy.dailyLimit, formatNumber(usage?.dailyJobLimit, locale))}
                  {metric(copy.remaining, formatNumber(usage?.remainingDailyJobs, locale))}
                  {metric(copy.jobCreates, formatNumber(usage?.jobCreateCount, locale))}
                  {metric(copy.draftedAssets, formatNumber(usage?.assetDraftCount, locale))}
                  {metric(copy.appliedAssets, formatNumber(usage?.assetAppliedCount, locale))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4" />
                {copy.generationGate}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-4">
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div className="font-medium">{copy.readiness}</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{copy.aiServiceReady}</span>
                  <Badge variant={status?.generationReadiness?.service.ready ? "default" : "outline"}>
                    {status?.generationReadiness?.service.ready ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{copy.serverOnly}</span>
                  <Badge variant={status?.generationReadiness?.serverOnly ? "default" : "destructive"}>
                    {status?.generationReadiness?.serverOnly ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{copy.browserCalls}</span>
                  <Badge variant={status?.generationReadiness?.browserWorkerCallsAllowed ? "destructive" : "outline"}>
                    {status?.generationReadiness?.browserWorkerCallsAllowed ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div className="font-medium">{copy.contractVersion}</div>
                <div className="break-all text-xs text-muted-foreground">
                  {status?.generationReadiness?.contract.version ?? "ai-media-product-image-suggestions-v1"}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {status?.generationReadiness?.contract.createEndpoint ?? "/v1/product-image-suggestions/jobs"}
                </div>
                <div className="pt-2 text-xs">{copy.generationDisabled}</div>
              </div>
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div className="font-medium">{copy.supportedGeneration}</div>
                <div className="text-xs text-muted-foreground">
                  {status?.generationReadiness?.contract.supportedTargets.map((target) => `${copy.targetTypes[target.targetType]} / ${copy.assetTypes[target.assetType]} / ${target.targetField}`).join("، ") || "PRODUCT / PRODUCT_IMAGE / product.image"}
                </div>
                <div className="pt-2 font-medium">{copy.unsupportedGeneration}</div>
                <div className="text-xs text-muted-foreground">
                  {status?.generationReadiness?.contract.unsupportedTargets.map((target) => copy.targetTypes[target]).join("، ") || copy.policyNo}
                </div>
                {status?.generationReadiness?.blockers.length ? (
                  <div className="pt-2 text-xs text-amber-700">
                    {copy.readinessBlockers}: {status.generationReadiness.blockers.join(" | ")}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div className="font-medium">{copy.brandGenerationPlan}</div>
                <div className="text-xs text-muted-foreground">{copy.logoCoverReadiness}</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{copy.providerContract}</span>
                  <Badge variant={status?.generationReadiness?.organizationBrandPlan?.providerContractReady ? "default" : "outline"}>
                    {status?.generationReadiness?.organizationBrandPlan?.providerContractReady ? copy.policyYes : copy.policyNo}
                  </Badge>
                </div>
                <div className="pt-1 text-xs text-muted-foreground">
                  {copy.plannedBrandTargets}: {status?.generationReadiness?.organizationBrandPlan?.supportedAssets.map((asset) => `${copy.assetTypes[asset.assetType]} / ${asset.targetField} / ${asset.recommendedAspectRatio}`).join("، ") || `${copy.assetTypes.LOGO} / ${copy.assetTypes.COVER}`}
                </div>
                <div className="text-xs text-muted-foreground">{copy.applyStillManual}</div>
                <div className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">{copy.brandGenerationDisabled}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4" />
                {copy.generationForm}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_120px_140px_180px]">
                <div className="space-y-2">
                  <Label>{copy.product}</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={!generationReady || products.length === 0 || generationSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder={copy.productPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{copy.generationPrompt}</Label>
                  <Textarea
                    value={generationPrompt}
                    onChange={(event) => setGenerationPrompt(event.target.value)}
                    placeholder={copy.generationPromptPlaceholder}
                    rows={1}
                    disabled={!generationReady || generationSubmitting}
                    className="min-h-10 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{copy.imageCount}</Label>
                  <Select value={generationCount} onValueChange={setGenerationCount} disabled={!generationReady || generationSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{copy.aspectRatio}</Label>
                  <Select value={generationAspectRatio} onValueChange={setGenerationAspectRatio} disabled={!generationReady || generationSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1:1">1:1</SelectItem>
                      <SelectItem value="4:5">4:5</SelectItem>
                      <SelectItem value="16:9">16:9</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{copy.stylePreset}</Label>
                  <Select value={generationStylePreset} onValueChange={setGenerationStylePreset} disabled={!generationReady || generationSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LIGHT_MENU_PHOTO">LIGHT_MENU_PHOTO</SelectItem>
                      <SelectItem value="STUDIO_PRODUCT">STUDIO_PRODUCT</SelectItem>
                      <SelectItem value="MARKETPLACE_CLEAN">MARKETPLACE_CLEAN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={generationReady ? "default" : "outline"}>
                    {generationReady ? copy.policyYes : copy.policyNo}
                  </Badge>
                  <span>{copy.remaining}: {formatNumber(status?.limits.remainingDailyJobs, locale)}</span>
                  {generationPollingJobId ? (
                    <span>{copy.pollingAttempts}: {formatNumber(generationPollAttempts, locale)}</span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  onClick={startProductImageGeneration}
                  disabled={!generationReady || !selectedProductId || generationSubmitting}
                  className="w-full sm:w-auto"
                >
                  {generationSubmitting ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
                  {generationSubmitting ? copy.startingGeneration : copy.startGeneration}
                </Button>
              </div>
              {!generationReady ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
                  {status?.generationReadiness?.blockers.length
                    ? `${copy.readinessBlockers}: ${status.generationReadiness.blockers.join(" | ")}`
                    : copy.generationDisabled}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="size-4" />
                {copy.brandRequestForm}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[180px_minmax(220px,1fr)_120px_180px]">
                <div className="space-y-2">
                  <Label>{copy.brandAsset}</Label>
                  <Select value={brandAssetType} onValueChange={(value) => setBrandAssetType(value as "LOGO" | "COVER")} disabled={!brandRequestControlsReady || brandSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOGO">{copy.assetTypes.LOGO}</SelectItem>
                      <SelectItem value="COVER">{copy.assetTypes.COVER}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{copy.generationPrompt}</Label>
                  <Textarea
                    value={brandPrompt}
                    onChange={(event) => setBrandPrompt(event.target.value)}
                    placeholder={copy.brandPromptPlaceholder}
                    rows={1}
                    disabled={!brandRequestControlsReady || brandSubmitting}
                    className="min-h-10 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{copy.imageCount}</Label>
                  <Select value={brandCount} onValueChange={setBrandCount} disabled={!brandRequestControlsReady || brandSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{copy.stylePreset}</Label>
                  <Select value={brandStylePreset} onValueChange={setBrandStylePreset} disabled={!brandRequestControlsReady || brandSubmitting}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRAND_CLEAN">BRAND_CLEAN</SelectItem>
                      <SelectItem value="LOCAL_MARKET">LOCAL_MARKET</SelectItem>
                      <SelectItem value="PREMIUM_MINIMAL">PREMIUM_MINIMAL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={brandRequestControlsReady ? "default" : "outline"}>
                    {copy.requestOnlyMode}: {brandRequestControlsReady ? copy.policyYes : copy.policyNo}
                  </Badge>
                  <Badge variant={brandProviderExecutionEnabled ? "default" : "outline"}>
                    {copy.providerExecution}: {brandProviderExecutionEnabled ? copy.policyYes : copy.policyNo}
                  </Badge>
                  <span>{copy.aspectRatio}: {brandAssetType === "LOGO" ? "1:1" : "16:9"}</span>
                </div>
                <Button
                  type="button"
                  onClick={startOrganizationBrandGeneration}
                  disabled={!brandRequestControlsReady || brandSubmitting}
                  className="w-full sm:w-auto"
                >
                  {brandSubmitting ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
                  {brandSubmitting ? copy.startingBrandRequest : copy.startBrandRequest}
                </Button>
              </div>
              {!brandProviderExecutionEnabled ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
                  {copy.brandGenerationDisabled}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(320px,520px)_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WandSparkles className="size-4" />
                  {copy.jobs}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">{copy.empty}</div>
                ) : (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div key={job.id} className="rounded-md border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={statusVariant(job.status)}>{copy.statuses[job.status]}</Badge>
                              <Badge variant="outline">{copy.targetTypes[job.targetType]}</Badge>
                              <Badge variant="outline">{job.provider}</Badge>
                            </div>
                            <div className="truncate text-sm font-medium">{job.prompt || job.id}</div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{copy.assets}: {formatNumber(job.assets?.length ?? job.outputCount, locale)}</span>
                              <span>{formatDate(job.createdAt, locale)}</span>
                            </div>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => loadJob(job.id)}>
                            <Eye className="size-4" />
                            {copy.view}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{copy.details}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedJob ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">{copy.noSelection}</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(selectedJob.status)}>{copy.statuses[selectedJob.status]}</Badge>
                        <Badge variant="outline">{copy.targetTypes[selectedJob.targetType]}</Badge>
                        <Badge variant="outline">{selectedJob.provider}</Badge>
                        {isJobInFlight(selectedJob.status) ? (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="size-3" />
                            {copy.generationInProgress}
                          </Badge>
                        ) : selectedJob.status === "COMPLETED" && selectedJob.assets?.length ? (
                          <Badge variant="default">{copy.generationComplete}</Badge>
                        ) : null}
                      </div>
                      {isJobInFlight(selectedJob.status) ? (
                        <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs text-muted-foreground">
                            {generationPollingJobId === selectedJob.id
                              ? `${copy.pollingAttempts}: ${formatNumber(generationPollAttempts, locale)}`
                              : copy.generationInProgress}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => pollCreativeStudioJob(selectedJob.id)}
                              disabled={generationPollingJobId === selectedJob.id}
                            >
                              <RefreshCw className={`size-4 ${generationPollingJobId === selectedJob.id ? "animate-spin" : ""}`} />
                              {copy.continuePolling}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => cancelGenerationJob(selectedJob.id)}
                              disabled={generationCancelingJobId === selectedJob.id}
                            >
                              <Ban className="size-4" />
                              {generationCancelingJobId === selectedJob.id ? copy.cancelingGeneration : copy.cancelGeneration}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.selectedJob}</div>
                          <div className="mt-1 break-all font-medium">{selectedJob.id}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.date}</div>
                          <div className="mt-1 font-medium">{formatDate(selectedJob.createdAt, locale)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.target}</div>
                          <div className="mt-1 break-all font-medium">
                            {copy.targetTypes[selectedJob.targetType]} {selectedJob.targetId ? `- ${selectedJob.targetId}` : ""}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">{copy.assets}</div>
                          <div className="mt-1 font-medium">{formatNumber(selectedJob.assets?.length ?? selectedJob.outputCount, locale)}</div>
                        </div>
                      </div>
                      {selectedJob.prompt && (
                        <div className="rounded-md border bg-muted/30 p-3 text-sm">
                          <div className="mb-1 text-xs text-muted-foreground">{copy.prompt}</div>
                          <div>{selectedJob.prompt}</div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedJob && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ImageIcon className="size-4" />
                        {copy.generatedReview}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">{copy.selectBeforeApply}</p>
                    </CardHeader>
                    <CardContent>
                      {selectedJob.assets?.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {selectedJob.assets.map((asset) => {
                            const applyOption = getApplyOption(selectedJob, asset, copy)
                            const application = getP110Application(asset)
                            const publicUrl = getAssetPublicUrl(asset)
                            const isSelectedAsset = asset.status === "SELECTED"
                            return (
                              <div
                                key={asset.id}
                                className={`rounded-md border p-3 ${
                                  isSelectedAsset ? "border-emerald-500/60 bg-emerald-500/5" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={statusVariant(asset.status)}>{copy.statuses[asset.status]}</Badge>
                                    {isSelectedAsset ? <Badge variant="default">{copy.selectedAsset}</Badge> : null}
                                  </div>
                                  <span className="text-xs text-muted-foreground">{formatDate(asset.createdAt, locale)}</span>
                                </div>
                                <div className="mt-3 text-sm font-medium">{copy.assetTypes[asset.assetType]}</div>
                                <div className="mt-1 break-all text-xs text-muted-foreground">{publicUrl || asset.id}</div>
                                {publicUrl ? (
                                  <div className="mt-3 overflow-hidden rounded-md border bg-muted/20">
                                    <img src={publicUrl} alt={copy.assetTypes[asset.assetType]} className="h-44 w-full object-cover" />
                                  </div>
                                ) : null}
                                <div className="mt-3 rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                                  <div>{copy.targetField}: {applyOption.targetField ?? "-"}</div>
                                  <div>{copy.selectionNoMutation}</div>
                                </div>
                                {application?.publicMutation ? (
                                  <div className="mt-3 space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
                                    <div className="font-medium text-emerald-700">{copy.publicMutation}: {copy.policyYes}</div>
                                    <div className="break-all">{copy.appliedUrl}: {application.appliedUrl ?? "-"}</div>
                                    {application.previousValue ? (
                                      <div className="break-all">{copy.previousImage}: {application.previousValue}</div>
                                    ) : null}
                                    {application.cacheRevalidation?.warnings?.length ? (
                                      <div className="text-amber-700">{copy.cacheWarning}: {application.cacheRevalidation.warnings.join(" | ")}</div>
                                    ) : null}
                                  </div>
                                ) : null}
                                <div className="mt-3">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isSelectedAsset ? "secondary" : "outline"}
                                    className="mb-2 w-full"
                                    disabled={asset.status === "APPLIED" || !publicUrl || selectingAssetId === asset.id}
                                    onClick={() => selectGeneratedAsset(asset)}
                                  >
                                    <ShieldCheck className="size-4" />
                                    {selectingAssetId === asset.id
                                      ? copy.selectingAsset
                                      : isSelectedAsset
                                        ? copy.selectedAsset
                                        : copy.selectAsset}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="w-full"
                                    disabled={Boolean(applyOption.disabledReason) || applyingAssetId === asset.id}
                                    onClick={() => {
                                      if (!applyOption.targetField) return
                                      setConfirmationText("")
                                      setPendingApply({ asset, targetField: applyOption.targetField, label: applyOption.label })
                                    }}
                                  >
                                    {applyingAssetId === asset.id ? copy.applying : applyOption.label}
                                  </Button>
                                  {applyOption.disabledReason ? (
                                    <div className="mt-2 text-xs text-muted-foreground">{applyOption.disabledReason}</div>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">{copy.empty}</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{copy.events}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedJob.usageEvents?.length ? (
                        <div className="space-y-2">
                          {selectedJob.usageEvents.map((event) => (
                            <div key={event.id} className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                              <span>{copy.actions[event.action] ?? event.action}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(event.createdAt, locale)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-sm text-muted-foreground">{copy.empty}</div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <AlertDialog open={Boolean(pendingApply)} onOpenChange={(open) => {
        if (!open && !applyingAssetId) {
          setPendingApply(null)
          setConfirmationText("")
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{copy.confirmationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingApply && (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="font-medium">{pendingApply.label}</div>
                <div className="mt-1 break-all text-xs text-muted-foreground">
                  {copy.targetField}: {pendingApply.targetField}
                </div>
                <div className="mt-1 break-all text-xs text-muted-foreground">
                  {copy.currentImage}: {getAssetPublicUrl(pendingApply.asset) ?? "-"}
                </div>
              </div>
              <Input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                placeholder={copy.confirmationPlaceholder}
                disabled={Boolean(applyingAssetId)}
              />
              {confirmationText && confirmationText.trim() !== "اعمال شود" ? (
                <div className="text-xs text-destructive">{copy.confirmationRequired}</div>
              ) : null}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(applyingAssetId)}>{copy.policyNo}</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmationText.trim() !== "اعمال شود" || Boolean(applyingAssetId)}
              onClick={(event) => {
                event.preventDefault()
                applyPendingAsset()
              }}
            >
              {applyingAssetId ? copy.applying : copy.applyPublic}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
