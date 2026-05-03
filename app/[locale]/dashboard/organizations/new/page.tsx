"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Save, Loader2, Plus, ArrowLeft, ChevronLeftIcon, ChevronRightIcon, X } from "lucide-react"
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


interface ImageRecord {
  id: number;
  url: string;
  filename: string;
}

export default function NewOrganizationPage({ 
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [slug, setSlug] = useState("")
  const [type, setType] = useState<"SHOP"|"APPOINTMENT">("SHOP")
  const [image, setImage] = useState<ImageRecord|null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null);

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

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imageFile = e.target.files[0];
      setImageFile(imageFile);
      try {
        const img = await uploadFile(imageFile);
        setImage(img);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name) {
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
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: description || undefined,
            image: imageUrl || undefined,
            slug,
            type,
          }),
      })
        const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create organization")
      }
      
      // Redirect to products page
      router.push(`/${locale}/dashboard/products/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization")
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
          <h2 className="text-2xl font-bold">{t("organization.new") || "New Organization"}</h2>
          <p className="text-muted-foreground">
            {t("organization.create_description") || "Create a new organization for your organization"}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("organization.details") || "Organization Details"}</CardTitle>
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
                    {t("organization.image") || "Organization image"}
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
            
          </div>
          </div>
           {/* --------------- Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

    
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t("organization.name") || "Organization Name"} *
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("organization.name_placeholder") || "Enter organization name"}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  {t("organization.slug") || "Organization slug"}
                </Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t("organization.sku_placeholder") || "Enter organization slug"}
                />
              </div>
            </div>
            
            {/* Description */} 
            <div className="space-y-2">
              <Label htmlFor="description">
                {t("organization.description") || "Description"}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("organization.description_placeholder") || "Describe your organization"}
                rows={3}
              />
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