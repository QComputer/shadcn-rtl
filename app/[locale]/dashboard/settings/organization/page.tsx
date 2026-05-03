"use client"
//TODO: complete the organization settings control
import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Save, User, Bell, Lock, Palette, Globe, Loader2, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { useTheme } from "@/hooks/use-theme"
import { BusinessHour, Organization, OrganizationSettings, PaymentSettings } from "@prisma/client"
import { ShopStatusBadge } from "@/components/ShopStatusBadge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ImageRecord {
  id: number;
  url: string;
  filename: string;
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
  //const [paymentSettings, setPaymentSettings ] = useState<PaymentSettings|null>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedLocale, setSelectedLocale] = useState(locale)
  const [selectedTheme, setSelectedTheme] = useState("system")

  const [cardNumber, setCardNumber] = useState<string>("")
  const [cardOwnerName, setCardOwnerName] = useState<string>("")
  const [paymentMethodInt, setPaymentMethodInt] = useState<string>("0")
  const [paymentCondition, setPaymenCondition] = useState(false)
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
    fetch(`/api/organizations/noId/settings`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch organization settings")
        return res.json()
      })
      .then(settings => {
      setSettings(settings)
      setOrganization(settings.organization)
      setName(settings.organization.name)
      setAddress(settings.organization.address)
      setPhone(settings.organization.phone)
      setDescription(settings.organization.description)
      setBusinessHours(settings.organization.businessHours)
      //setPaymentSettings(settings.organization.paymentSettings)
      settings.organization?.paymentSettings?.paymentMethodInt && setPaymentMethodInt(settings.organization.paymentSettings.paymentMethodInt.toString())
      settings.organization?.paymentSettings?.paymentCondition && setPaymenCondition(settings.organization.paymentSettings.paymentCondition)
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
      const response = await fetch(`/api/organizations/open`, {
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
      const response = await fetch(`/api/organizations/open`)
      
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
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          description: description || undefined,
          address: address || undefined,
          phone: phone || undefined,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save")
      }
      
      const updatedOrganization = await response.json()
      setOrganization(updatedOrganization)
      setName(updatedOrganization.name)
      setAddress(updatedOrganization.address)
      setPhone(updatedOrganization.phone)
      setDescription(updatedOrganization.description)
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
      const response = await fetch(`/api/organizations/${organization.id}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentCondition: false,
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
      setPaymentMethodInt(updatedPaymentSettings.paymentMethodInt)
      setPaymenCondition(updatedPaymentSettings.paymentCondition)
      setCardNumber(updatedPaymentSettings.cardNumber)
      setCardOwnerName(updatedPaymentSettings.cardOwnerName)
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
      const response = await fetch(`/api/organizations/${organization.id}`, {
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

  const handleSaveImages = async () => {
    if (!organization) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
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

  const handleThemeChange = (newTheme: string) => {
    setSelectedTheme(newTheme)
    setTheme(newTheme as "light" | "dark" | "system")
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
          {saving ? "ذخیره کردن..." : " ذخیره" }
        </Button>
        </div>
        </CardFooter>
      </Card>
    </div>
  )
}
