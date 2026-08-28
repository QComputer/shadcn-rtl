"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { buildOrganizationPublicPath } from "@/lib/custom-domain-routing"
import { ArrowRight, Save, Loader2, Plus } from "lucide-react"
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
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman } from "@/lib/persian"
import { useDashboardAccess } from "@/hooks/use-auth"
import { useSession } from "next-auth/react"
import { SlugPreviewActions } from "@/components/dashboard/slug-preview-actions"

interface Category {
  id: string
  name: string
  organization?: {
    slug: string
  }
}

interface StaffMember {
  id: string
  userId: string
  user?: {
    firstName: string | null
    lastName: string | null
  }
}

export default function NewServicePage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const router = useRouter()
  
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  const { data: session } = useSession()
  
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [duration, setDuration] = useState("30")
  const [categoryId, setCategoryId] = useState("")
  const [image, setImage] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [serviceProviderId, setServiceProviderId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch categories and staff members
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    
    Promise.all([
      fetch("/api/service-categories?pageSize=100")
        .then(res => res.json())
        .then(data => data.data || []),
      fetch("/api/users/me/membership")
        .then(res => res.json())
        .then(data => {
          if (data.membership?.organizationId) {
            return fetch(`/api/organizations/${data.membership.organizationId}/members`)
              .then(res => res.json())
              .then(membersData => membersData.members || membersData || [])
          }
          return []
        })
        .catch(() => [])
    ]).then(([categoriesData, staffData]) => {
      setCategories(categoriesData)
      setStaffMembers(staffData)
    }).catch(() => {
      setCategories([])
      setStaffMembers([])
    }).finally(() => setLoading(false))
  }, [hasAccess, accessLoading])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const selectedCategory = categories.find(category => category.id === categoryId)
  const servicePreviewPath = slug.trim() && selectedCategory?.organization?.slug
    ? buildOrganizationPublicPath({ locale, organizationSlug: selectedCategory.organization.slug, surface: "appointment", subPath: `/services/${slug.trim()}` })
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !price || !duration || !categoryId) {
      setError(t("errors.required_fields") || "Please fill in all required fields")
      return
    }
    
    setSaving(true)
    setError(null)
    
     try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            slug: slug.trim() || undefined,
            description: description || undefined,
            price: parseFloat(price),
            duration: parseInt(duration),
            categoryId,
            image: image || undefined,
            isActive,
            serviceProviderId: serviceProviderId,// || undefined,
          }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create service")
      }
      
      // Redirect to services list
      router.push(`/${locale}/dashboard/services`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service")
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

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href={`/${locale}/dashboard/services`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-5 w-5 rotate-180" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold">{t("service.new") || "New Service"}</h2>
          <p className="text-muted-foreground">
            {t("service.create_description") || "Create a new service for your organization"}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("service.details") || "Service Details"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
            
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t("service.name") || "Service Name"} *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("service.name_placeholder") || "Enter service name"}
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
                placeholder="hair-cut"
              />
              <p className="text-xs text-muted-foreground">
                {t("common.slugHelp") || "Leave blank to generate it from the name. Saved slugs are normalized and kept unique."}
              </p>
              <SlugPreviewActions path={servicePreviewPath} />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                {t("service.description") || "Description"}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("service.description_placeholder") || "Describe your service"}
                rows={3}
              />
            </div>
            
            {/* Price and Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">
                  {t("service.price") || "Price"} (Toman) *
                </Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="1000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  required
                />
                {price && (
                  <p className="text-sm text-muted-foreground">
                    {formatToman(parseFloat(price))}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">
                  {t("appointment.duration") || "Duration"} ({t("appointment.minutes") || "minutes"}) *
                </Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="30">30</SelectItem>
                    <SelectItem value="45">45</SelectItem>
                    <SelectItem value="60">60</SelectItem>
                    <SelectItem value="90">90</SelectItem>
                    <SelectItem value="120">120</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">
                {t("service.category") || "Category"} *
              </Label>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : categories.length === 0 ? (
                <div className="flex items-center gap-2">
                  <Input disabled placeholder={t("service.no_categories") || "No categories available"} />
                  <Link href={`/${locale}/dashboard/service-categories`}>
                    <Button type="button" variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <Select value={categoryId} onValueChange={setCategoryId} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("service.select_category") || "Select a category"} />
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
            
            {/* Image URL */}
            <div className="space-y-2">
              <Label htmlFor="image">
                {t("service.image") || "Image URL"}
              </Label>
              <Input
                id="image"
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            
            {/* Service Provider (only visible to ADMIN) */}
            {session?.user?.role === "ADMIN" && staffMembers.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="serviceProvider">
                  {t("appointment.provider") || "Service Provider"}
                </Label>
                <Select 
                  value={serviceProviderId || ""} 
                  onValueChange={(value) => setServiceProviderId(value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("service.select_provider") || "Select a service provider"} />
                  </SelectTrigger>
                  <SelectContent>
                    {staffMembers.map(member => (
                      <SelectItem key={locale+member.userId} value={member.userId}>
                        {member.user?.firstName} {member.user?.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Active Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">
                  {t("common.active") || "Active"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("service.activeDescription") || "This service will be available for booking"}
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
            
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
    </div>
  )
}
