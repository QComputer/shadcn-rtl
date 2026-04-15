"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Save, User, Bell, Lock, Palette, Globe, Loader2, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { useTheme } from "@/hooks/use-theme"
import { Organization } from "@prisma/client"

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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [coverImage, setCoverImage] = useState("")
  const [logo, setLogo] = useState("")
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  
  const [organization, setOrganization ] = useState<Organization|null>(null)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [selectedLocale, setSelectedLocale] = useState(locale)
  const [selectedTheme, setSelectedTheme] = useState("system")

  
  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Fetch user profile
    fetch("/api/users/me")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch orgabization")
        return res.json()
      })
      .then(data => {
      setOrganization(data.memberOf.organization)
      //console.log(data.memberOf.organization);
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [locale])

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
    <div className="space-y-2">
                  <Label htmlFor="username">{t("auth.username")}</Label>
                  <Input id="username" value={organization?.name || ""} disabled />
                </div>
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
  const handleSave = async () => {
    if (!organization) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          description: description || undefined,
          email: email || undefined,
          phone: phone || undefined,
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
        router.push(`/${selectedLocale}/dashboard/settings`)
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
              Retry
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
        <h2 className="text-2xl font-bold">{t("navigation.settings")}</h2>
        <p className="text-muted-foreground">
          {t("user.settings")}
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-500 text-green-700 dark:text-green-400 rounded-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
          {error}
        </div>
      )}
       
      {/* Upload Logo */}
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       <div className="space-y-2">
         <Label htmlFor="logo">
           {t("organization.logo") || "Organization logo"}
         </Label>
       </div>
       <div className="mt-1 flex items-center">
         <Input
           type="file"
           accept="image/*" // Only accept image files
           onChange={handleLogoChange}
           className="sr-only" // Hide the default file input
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
             className={"border-2 -mt-16 mr-1"}
           >
             <X/>
           </Button>
       </div>
     </div>

      {/* Upload Cover Image */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       <div className="space-y-2">
         <Label htmlFor="coverImage">
           {t("organization.coverImage") || "Organization coverImage"}
         </Label>
       </div>
       <div className="mt-1 mx-5 flex items-center">
         <Input
           type="file"
           accept="image/*" // Only accept image files
           onChange={handleCoverImageChange}
           className="sr-only" // Hide the default file input
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
             className={"border-2 -mt-16 mr-1"}
           >
             <X/>
           </Button>
       </div>
       <Button onClick={handleSave}
       >Save</Button>
      </div>

    </div>
  )
}
