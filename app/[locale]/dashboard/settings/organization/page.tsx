"use client"
import { appFetch } from "@/lib/app-base-path";
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Save, User, Bell, Lock, Palette, Globe, Loader2, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import dynamic from "next/dynamic"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { useTheme } from "@/hooks/use-theme"
import type { ClientBusinessHour as BusinessHour, ClientOrganization as Organization, ClientOrganizationSettings as OrganizationSettings, ClientPaymentSettings as PaymentSettings } from "@/lib/client-model-types"
import { ShopStatusBadge } from "@/components/ShopStatusBadge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BUSINESS_CAPABILITY_REGISTRY, type BusinessCapability } from "@/lib/business-capability-registry"

interface ImageRecord {
  id: number;
  url: string;
  filename: string;
}

const MapLocationPicker = dynamic(() => import("@/components/ui/map-location-picker"), { ssr: false })

const businessCapabilityLabels: Record<BusinessCapability, string> = {
  SHOP: "فروشگاه",
  APPOINTMENT: "نوبت‌دهی",
}

function readDefaultPublicCapability(settings: OrganizationSettings | null): BusinessCapability | null {
  const value = settings?.settings;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = (value as Record<string, unknown>).defaultPublicCapability;
  return candidate === "SHOP" || candidate === "APPOINTMENT" ? candidate : null;
}

export default function OrganizationSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const router = useRouter()
  const { theme: currentTheme, setTheme } = useTheme()
  
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingOrganization, setSavingOrganization] = useState(false)
  const [savingImages, setSavingImages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [businessHours, setBusinessHours] = useState<BusinessHour|null>()
  
  const [coverImage, setCoverImage] = useState("")
  const [logo, setLogo] = useState("")
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  
  const [organization, setOrganization ] = useState<Organization|null>(null)
  const [settings, setSettings ] = useState<OrganizationSettings|null>(null)
  const [defaultPreparationMinutes, setDefaultPreparationMinutes] = useState(30)
  const [savingPreparationSettings, setSavingPreparationSettings] = useState(false)
  const [capabilities, setCapabilities] = useState<BusinessCapability[]>([])
  const [savingCapabilities, setSavingCapabilities] = useState(false)
  const [defaultPublicCapability, setDefaultPublicCapability] = useState<BusinessCapability | "AUTO">("AUTO")
  const [savingDefaultPublicCapability, setSavingDefaultPublicCapability] = useState(false)
  //const [paymentSettings, setPaymentSettings ] = useState<PaymentSettings|null>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedLocale, setSelectedLocale] = useState(locale)
  const [selectedTheme, setSelectedTheme] = useState("system")
  
  const [lat, setLat] = useState<number | undefined>(undefined)
  const [lng, setLng] = useState<number | undefined>(undefined)

  const [cardNumber, setCardNumber] = useState<string>("")
  const [cardOwnerName, setCardOwnerName] = useState<string>("")
  const [paymentMethodInt, setPaymentMethodInt] = useState<string>("0")
  const [paymentCondition, setPaymentCondition] = useState(false)
  function paymentMethodDict (int: string) {
    if (int=="0") return "پرداخت نقدی و انتقال"
    else if (int=="1") return "فقط پرداخت از طریق انتقال"
    else if (int=="2") return "فقط پرداخت نقدی"
  }
  const [savingPayment, setSavingPayment] = useState(false)

  const [isOpen, setIsOpen] = useState(true)
    useEffect(() => {
      setMounted(true)
      
      import("@/lib/dictionary").then(({ getDictionary }) => {
        setDict(getDictionary(locale))
      })
    }, [locale])
  
  useEffect(() => {
    if (!saving) return
    
    setLoading(true)

    // Fetch user profile
    appFetch(`/api/organizations/noId/settings`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch organization settings")
        return res.json()
      })
.then(settings => {
       setSettings(settings)
       setDefaultPreparationMinutes(settings.defaultPreparationMinutes || 30)
       const configuredDefaultPublicCapability = readDefaultPublicCapability(settings)
       setDefaultPublicCapability(configuredDefaultPublicCapability ?? "AUTO")
       setOrganization(settings.organization)
       setCapabilities(
         settings.organization.capabilitiesInitializedAt
           ? (settings.organization.capabilities || [])
               .filter((capability: { status: string }) => capability.status === "ACTIVE")
               .map((capability: { key: BusinessCapability }) => capability.key)
           : settings.organization.type
             ? [settings.organization.type]
             : [],
       )
       setName(settings.organization.name)
       setAddress(settings.organization.address || "")
       setPhone(settings.organization.phone || "")
       setDescription(settings.organization.description || "")
       setLat(settings.organization.lat ?? undefined)
       setLng(settings.organization.lng ?? undefined)
       setBusinessHours(settings.organization.businessHours)
      //setPaymentSettings(settings.organization.paymentSettings)
      settings.organization?.paymentSettings?.paymentMethodInt && setPaymentMethodInt(settings.organization.paymentSettings.paymentMethodInt.toString())
      if (typeof settings.organization?.paymentSettings?.paymentCondition === "boolean") setPaymentCondition(settings.organization.paymentSettings.paymentCondition)
      settings.organization?.paymentSettings?.cardNumber && setCardNumber(settings.organization.paymentSettings.cardNumber)
      settings.organization?.paymentSettings?.cardOwnerName && setCardOwnerName(settings.organization.paymentSettings.cardOwnerName)
      setIsOpen(settings.organization?.isOpen || false)
        setLoading(false)
        setSaving(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
        setSaving(false)
      })
  }, [saving])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }
  const handleCoverImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imageFile = e.target.files[0];
      try {
        const img = await uploadFile(imageFile);
        setCoverImage(img.url);
        //console.log('-----------img:',img);
        
        // Create a preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
      } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload failed. Please try again.");
      }
    }
  };
    
const handleClose = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setError(null)
    
    try {
      const response = await appFetch(`/api/organizations/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOpen: false
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update ")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ")
    } finally {
      setSaving(true)
    }
  }

    
const handleOpen = async (e: React.FormEvent) => {
    setError(null)
    
    try {
      const response = await appFetch(`/api/organizations/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: true }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to open")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close")
    } finally {
      setSaving(true)
    }
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imageFile = e.target.files[0];
      try {
        const img = await uploadFile(imageFile);
        setLogo(img.url);
        //console.log('-----------img:',img);
        
        // Create a preview URL
        const reader = new FileReader();
        reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(imageFile);
      } catch (error) {
        console.error("Upload failed:", error);
        alert("Upload failed. Please try again.");
      }
    }
  };
  
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
  
  const handleSaveOrganization = async () => {
    if (!organization) return
    setSavingOrganization(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await appFetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          description: description || undefined,
          address: address || undefined,
          phone: phone || undefined,
          lat: lat || undefined,
          lng: lng || undefined,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save")
      }
      
      const updatedOrganization = await response.json()
      setOrganization(updatedOrganization)
      setName(updatedOrganization.name)
      setAddress(updatedOrganization.address || "")
      setPhone(updatedOrganization.phone || "")
      setDescription(updatedOrganization.description || "")
      setLat(updatedOrganization.lat ?? undefined)
      setLng(updatedOrganization.lng ?? undefined)
      setSuccess(t("common.success"))
      
      // If locale changed, redirect to new locale
      if (selectedLocale !== locale) {
        router.push(`/${selectedLocale}/dashboard/settings/organization`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save updates")
    } finally {
      setSavingOrganization(false)
    }
  }
  
  const handleSavePayment = async () => {
    if (!organization) return
    setSavingPayment(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await appFetch(`/api/organizations/${organization.id}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentCondition,
          paymentMethodInt: Number(paymentMethodInt),
          cardOwnerName,
          cardNumber,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save")
      }
      
      const updatedPaymentSettings = await response.json()
      setPaymentMethodInt(String(updatedPaymentSettings.paymentMethodInt ?? 0))
      setPaymentCondition(Boolean(updatedPaymentSettings.paymentCondition))
      setCardNumber(updatedPaymentSettings.cardNumber || "")
      setCardOwnerName(updatedPaymentSettings.cardOwnerName || "")
      setSuccess(t("common.success"))

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save updates")
    } finally {
      setSavingPayment(false)
    }
  }
  
  const handleSaveSettings = async()=> {
    if (!organization) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await appFetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save")
      }
      
      const updatedUser = await response.json()
      setSuccess(t("common.success"))
      
      // If locale changed, redirect to new locale
      if (selectedLocale !== locale) {
        router.push(`/${selectedLocale}/dashboard/settings/organization`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreparationSettings = async () => {
    if (!organization) return
    setSavingPreparationSettings(true)
    setError(null)
    try {
      const response = await appFetch(`/api/organizations/${organization.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPreparationMinutes }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "ثبت زمان پیش‌فرض ناموفق بود")
      }
      const updated = await response.json()
      setSettings(updated)
      setSuccess("زمان پیش‌فرض آماده‌سازی ذخیره شد")
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت زمان پیش‌فرض ناموفق بود")
    } finally {
      setSavingPreparationSettings(false)
    }
  }

  const handleSaveImages = async () => {
    if (!organization) return
    setSavingImages(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await appFetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo: logo || undefined,
          coverImage: coverImage || undefined
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save")
      }
      
      const updatedOrganization = await response.json()
      setOrganization(updatedOrganization)
      setLogo(updatedOrganization.logo || "")
      setCoverImage(updatedOrganization.coverImage || "")
      setLogoPreview(null)
      setCoverImagePreview(null)
      setSuccess(t("common.success"))
      
      // If locale changed, redirect to new locale
      if (selectedLocale !== locale) {
        router.push(`/${selectedLocale}/dashboard/settings/organization`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingImages(false)
    }
  }

  const handleThemeChange = (newTheme: string) => {
    setSelectedTheme(newTheme)
    setTheme(newTheme as "light" | "dark" | "system")
  }

  const toggleCapability = (capability: BusinessCapability) => {
    setCapabilities((current) => {
      const next = current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability]
      setDefaultPublicCapability((selected) =>
        selected !== "AUTO" && !next.includes(selected) ? "AUTO" : selected,
      )
      return next
    })
  }

  const handleSaveCapabilities = async () => {
    if (!organization?.id) return
    setSavingCapabilities(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await appFetch(`/api/organizations/${organization.id}/capabilities`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: organization.id, capabilities }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "ذخیره قابلیت‌های کسب‌وکار ناموفق بود")
      }
      const data = await response.json()
      setCapabilities(
        (data.capabilities || [])
          .filter((capability: { status: string }) => capability.status === "ACTIVE")
          .map((capability: { key: BusinessCapability }) => capability.key),
      )
      if (defaultPublicCapability !== "AUTO" && !(data.capabilities || []).some(
        (capability: { key: BusinessCapability; status: string }) =>
          capability.key === defaultPublicCapability && capability.status === "ACTIVE",
      )) {
        setDefaultPublicCapability("AUTO")
      }
      setSuccess("قابلیت‌های کسب‌وکار ذخیره شد")
      window.dispatchEvent(new Event("organization-capabilities-changed"))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره قابلیت‌های کسب‌وکار ناموفق بود")
    } finally {
      setSavingCapabilities(false)
    }
  }

  const handleSaveDefaultPublicCapability = async () => {
    if (!organization?.id) return
    setSavingDefaultPublicCapability(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await appFetch(`/api/organizations/${organization.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultPublicCapability: defaultPublicCapability === "AUTO" ? null : defaultPublicCapability,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || "ذخیره صفحه پیش‌فرض دامنه ناموفق بود")
      }
      const updated = await response.json()
      setSettings(updated)
      setSuccess("صفحه پیش‌فرض دامنه ذخیره شد")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره صفحه پیش‌فرض دامنه ناموفق بود")
    } finally {
      setSavingDefaultPublicCapability(false)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={locale+i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              {t("comon.retry")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{t("navigation.settingsOrganization")}</h2>
        <p className="text-muted-foreground">
          {t("organization.settings")}
        </p>
      </div>
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
          {error}
        </div>
      )}
      <Card>
        <CardHeader>
          وضعیت:
        </CardHeader>
        <CardContent className="">
          <ShopStatusBadge isOpen={isOpen}/>
        </CardContent>
        <CardFooter className="flex p-4 gap-4">
          <Button onClick={handleOpen} className={"bg-green-500"}>
        باز
       </Button>
        <Button onClick={handleClose} variant='destructive'>
        بسته
       </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>قابلیت‌های کسب‌وکار</CardTitle>
          <CardDescription>
            هر سازمان می‌تواند فروشگاه، نوبت‌دهی، هر دو یا فعلاً هیچ‌کدام را فعال داشته باشد. غیرفعال‌سازی داده‌های قبلی را حذف نمی‌کند.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {([
            { key: "SHOP", title: "فروشگاه", description: "محصولات، سفارش‌ها و عملیات تحویل" },
            { key: "APPOINTMENT", title: "نوبت‌دهی", description: "خدمات، تقویم و نوبت‌ها" },
          ] as const).map((capability) => {
            const active = capabilities.includes(capability.key)
            return (
              <button
                key={capability.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCapability(capability.key)}
                className={`rounded-xl border p-4 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/50"}`}
              >
                <span className="block font-medium">{capability.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{capability.description}</span>
                <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {active ? "فعال" : "غیرفعال"}
                </span>
              </button>
            )
          })}
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">انتخاب نکردن هیچ گزینه‌ای، سازمان را در حالت راه‌اندازی نگه می‌دارد.</p>
          <Button type="button" onClick={handleSaveCapabilities} disabled={savingCapabilities}>
            {savingCapabilities ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
            ذخیره قابلیت‌ها
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            صفحه پیش‌فرض دامنه
          </CardTitle>
          <CardDescription>
            این گزینه فقط برای دامنه اختصاصی سازمان استفاده می‌شود و از قابلیت‌های عمومی فعال ساخته می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="default-public-capability">تجربه ریشه دامنه</Label>
            <Select
              value={defaultPublicCapability}
              onValueChange={(value) => setDefaultPublicCapability(value as BusinessCapability | "AUTO")}
              disabled={capabilities.length < 2}
            >
              <SelectTrigger id="default-public-capability">
                <SelectValue placeholder="انتخاب صفحه پیش‌فرض دامنه" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">
                  {capabilities.length === 1
                    ? `خودکار: ${businessCapabilityLabels[capabilities[0]]}`
                    : "صفحه عمومی سازمان"}
                </SelectItem>
                {capabilities
                  .filter((capability) => BUSINESS_CAPABILITY_REGISTRY[capability]?.publicSurface)
                  .map((capability) => (
                    <SelectItem key={capability} value={capability}>
                      {businessCapabilityLabels[capability]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              اگر فقط یک قابلیت عمومی فعال باشد، ریشه دامنه همان تجربه را بدون تنظیم دستی باز می‌کند.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSaveDefaultPublicCapability}
            disabled={savingDefaultPublicCapability || capabilities.length === 0}
          >
            {savingDefaultPublicCapability ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
            ذخیره
          </Button>
        </CardContent>
      </Card>


      <Card>
      <CardHeader>
        تنظیمات عمومی:
      </CardHeader>
      <CardContent className="space-y-4">
<div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="slug">{t("organization.slug")}</Label>
                  <Input id="name" value={organization?.slug || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">{t("organization.name")}</Label>
                  <Input id="name" value={organization?.name || ""} 
                  onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t("organization.description")} </Label>
                  <Input id="description" value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t("organization.address")}</Label>
                  <Input 
                    id="address" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("organization.location") || "موقعیت روی نقشه"}</Label>
                <div className="h-[300px] w-full">
                  <MapLocationPicker
                    onLocationSelect={(lat, lng, newAddress) => {
                      setLat(lat)
                      setLng(lng)
                      setAddress(newAddress)
                    }}
                    defaultLat={lat}
                    defaultLng={lng}
                    defaultAddress={address}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("user.phone")}</Label>
                <Input 
                  id="phone" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  dir="ltr"
                />
              </div>
          </CardContent>
      <CardFooter>
        <div className="flex items-center">
        <Button 
        onClick={handleSaveOrganization}
        disabled={savingOrganization}
        >
        {savingOrganization ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
            {savingOrganization ? "ذخیره کردن..." : " ذخیره" }
        </Button>
        </div>
        </CardFooter>
        </Card>

        <Card>
        <CardHeader>
          تنظیمات پرداخت:
        </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="card-number">{t("organization.cardNumber")}</Label>
                  <Input id="card-number" value={cardNumber} 
                  onChange={(e) => setCardNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                <Label htmlFor="card-cardOwnerName">{t("organization.cardOwnerName")}</Label>
                  <Input id="card-cardOwnerName" value={cardOwnerName} 
                  onChange={(e) => setCardOwnerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">{t("organization.paymentMethod")}</Label>
                   <Select value={paymentMethodInt} onValueChange={setPaymentMethodInt}>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.paymentMethod_select") || "Select payment method"} />
                </SelectTrigger>
                <SelectContent>
                  {["0","1","2"].map(int => (
                    <SelectItem key={"paymentMethod_"+int} value={int}>
                      {paymentMethodDict(int)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-1">
                    <Label htmlFor="payment-condition">{t("organization.paymentCondition")}</Label>
                    <p className="text-xs text-muted-foreground">{t("organization.paymentConditionDescription")}</p>
                  </div>
                  <Switch
                    id="payment-condition"
                    checked={paymentCondition}
                    onCheckedChange={setPaymentCondition}
                  />
                </div>
                
              </div>
            </CardContent>
      <CardFooter>
        <div className="flex items-center">
        <Button 
        onClick={handleSavePayment}
        disabled={savingPayment}
        >
        {savingPayment ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
            {savingPayment ? "ذخیره کردن..." : " ذخیره" }
        </Button>
        </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>زمان آماده‌سازی سفارش</CardTitle>
          <CardDescription>اگر برای محصول زمان جداگانه‌ای تعیین نشده باشد، این مقدار استفاده می‌شود.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="default-preparation-minutes">زمان پیش‌فرض (دقیقه)</Label>
          <div className="flex max-w-md gap-2">
            <Input
              id="default-preparation-minutes"
              type="number"
              min={1}
              max={1440}
              value={defaultPreparationMinutes}
              onChange={(event) => setDefaultPreparationMinutes(Number(event.target.value))}
            />
            <Button
              onClick={handleSavePreparationSettings}
              disabled={savingPreparationSettings || defaultPreparationMinutes < 1}
            >
              {savingPreparationSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          تصاویر:
        </CardHeader>

      <CardContent>
      
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
      
      {/* Upload Logo */}
       <div className="space-y-2">
         <Label htmlFor="logo">
           {t("organization.logo") || "Organization logo"}
         </Label>
       </div>
      <div className="mt-1 mb-10 flex items-center ">
         <Input
           type="file"
           accept="image/*" // Only accept image files
           onChange={handleLogoChange}
           className="sr-only w-20" // Hide the default file input
           id="logoUpload"
         />
         <Label
           htmlFor="logoUpload"
         >
      <div className="items-center rounded-lg border-3">
         {logoPreview ? 
           <img
           src={logoPreview}
           alt="Logo Preview"
           className="items-center h-20 w-20 object-cover rounded-md"
           />
         : organization?.logo
           ? <img
             src={organization.logo}
             alt="Original Logo Preview"
             className=" items-center h-20 w-20 object-cover rounded-md"
             />
           :
        (
         <div className=" items-center text-sm border-1 p-2 rounded-md w-20 h-20">هیچ تصویری انتخاب نشده</div>
       )}
      </div>
         </Label>
           <Button
             onClick={() => {setLogoPreview("")
             }}
             size={"icon"}
             variant={"outline"}
             className={"m-2 "}
           >
             <X/>
           </Button>
       </div>


      {/* Upload Cover Image */}
       <div className="space-y-2">
         <Label htmlFor="coverImage">
           {t("organization.coverImage") || "Organization coverImage"}
         </Label>
       </div>
      <div className="mt-1 mb-10 flex items-center">
         <Input
           type="file"
           accept="image/*" // Only accept image files
           onChange={handleCoverImageChange}
           className="sr-only w-20" // Hide the default file input
           id="coverImageUpload"
         />
         <Label
           htmlFor="coverImageUpload"
         >
         <div className="items-center rounded-lg border-3">
         {coverImagePreview ? 
           <img
           src={coverImagePreview}
           alt="Cover Image Preview"
           className="items-center h-20 w-20 object-cover rounded-md"
           />
         : organization?.coverImage
           ? <img
             src={organization.coverImage}
             alt="Original Cover Image Preview"
             className=" items-center h-20 w-20 object-cover rounded-md"
             />
           :
        (
         <div className=" items-center text-sm border-1 p-2 rounded-md w-20 h-20">هیچ تصویری انتخاب نشده</div>
       )}
       </div>
         </Label>
           <Button
             onClick={() => {setCoverImagePreview("")
             }}
             size={"icon"}
             variant={"outline"}
             className={"m-2"}
           >
             <X/>
           </Button>
       </div>

      </div>
        </CardContent>
        

      <CardFooter>
        <div className="flex items-center">
        <Button 
        onClick={handleSaveImages}
        disabled={savingImages}
        >
          {savingImages ? "ذخیره کردن..." : " ذخیره" }
        </Button>
        </div>
        </CardFooter>
      </Card>
    </div>
  )
}
