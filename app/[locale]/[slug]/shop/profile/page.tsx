"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  MapPin, 
  Phone, 
  Mail, 
  ChevronRight,
  Package,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { PublicImage } from "@/components/public/public-image"
import { WebPushOptIn } from "@/components/public/web-push-opt-in"
import { buildShopCheckoutPath, buildShopOrderPath, buildShopProductsPath } from "@/lib/shop-public-paths"
import { useShopRoutePaths } from "@/lib/contexts/shop-route-context"

interface ShopProfile {
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

export default function ShopProfilePage({ 
  params 
 }: { 
   params: Promise<{ locale: string; slug: string }>
 }) {
   const resolvedParams = use(params)
   const locale = resolvedParams.locale
   const slug = resolvedParams.slug
   
   const [mounted, setMounted] = useState(false)
   const [profile, setProfile] = useState<ShopProfile | null>(null)
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)
   const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
   const { productsHref } = useShopRoutePaths({
     productsHref: buildShopProductsPath({ locale, shopSlug: slug }),
     checkoutHref: buildShopCheckoutPath({ locale, shopSlug: slug }),
     orderHref: (orderNumber) => buildShopOrderPath({ locale, shopSlug: slug, orderNumber }),
   })

   useEffect(() => {
     setMounted(true)
     
     import("@/lib/dictionary").then(({ getDictionary }) => {
       setDict(getDictionary(locale))
     })
     
      fetch(`/api/public/organizations/${slug}`)
       .then(res => {
         if (!res.ok) throw new Error("Shop not found")
         return res.json()
       })
       .then(data => {
         setProfile(data.organization || data)
         setLoading(false)
       })
       .catch(err => {
         setError(err.message)
         setLoading(false)
       })
   }, [locale, slug])

   const t = (key: string): string => {
     if (!dict) return key
     return getDictValue(dict, key)
   }

   if (!mounted || loading) {
     return (
       <div className="min-h-screen bg-background">
         <Skeleton className="h-64 w-full" />
         <div className="container mx-auto px-4 py-8 space-y-6">
           <Skeleton className="h-8 w-1/2" />
           <Skeleton className="h-32 w-full" />
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Skeleton className="h-24" />
             <Skeleton className="h-24" />
             <Skeleton className="h-24" />
           </div>
         </div>
       </div>
     )
   }

   if (error || !profile) {
     return (
       <div className="min-h-screen bg-background flex items-center justify-center">
         <Card className="w-full max-w-md">
           <CardHeader>
             <CardTitle className="text-destructive">{t("errors.notFound")}</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">{error || "Shop not found"}</p>
             <Button className="mt-4">
               <Link href={productsHref}>{t("common.back")}</Link>
             </Button>
           </CardContent>
         </Card>
       </div>
     )
   }

   return (
     <div className="min-h-screen bg-background">
       {/* Cover Image */}
       {profile.coverImage && (
         <div className="relative h-48 md:h-64 bg-muted">
           <PublicImage
             src={profile.coverImage}
             alt={profile.name}
             kind="organization"
             className="w-full h-full object-cover"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
         </div>
       )}

       {/* Profile Header */}
       <section className={`${profile.coverImage ? "-mt-20" : "pt-8"} relative`}>
         <div className="container mx-auto px-4">
           <div className="flex flex-col md:flex-row gap-6 items-start">
             {/* Logo */}
             <div className="w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden bg-card border-4 border-background shadow-lg">
               <PublicImage
                 src={profile.logo}
                 alt={profile.name}
                 kind="organization"
                 className="w-full h-full object-cover"
               />
             </div>

             {/* Info */}
             <div className="flex-1">
               <h1 className="text-2xl md:text-3xl font-bold mb-2">
                 {profile.name}
               </h1>
               <Badge variant="secondary" className="mb-3">
                 {profile.type === "SHOP" ? t("organization.shop") : t("organization.appointment")}
               </Badge>
               {profile.description && (
                 <p className="text-muted-foreground mb-4 max-w-2xl">
                   {profile.description}
                 </p>
               )}
               <div className="flex flex-wrap gap-3">
                 <Button>
                   <Link href={productsHref}>
                     <Package className="h-4 w-4 mr-2" />
                     {t("navigation.products")}
                   </Link>
                 </Button>
               </div>
             </div>
           </div>
         </div>
       </section>

       {/* Contact Info */}
       <section className="py-8">
         <div className="container mx-auto px-4">
           <Card>
             <CardHeader>
               <CardTitle>{t("organization.contactInfo") || "Contact Information"}</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {profile.phone && (
                   <a 
                     href={`tel:${profile.phone}`} 
                     className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                   >
                     <div className="p-2 bg-primary/10 rounded-lg">
                       <Phone className="h-5 w-5 text-primary" />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">{t("organization.phone") || "Phone"}</p>
                       <p className="font-medium">{profile.phone}</p>
                     </div>
                   </a>
                 )}
                 {profile.email && (
                   <a 
                     href={`mailto:${profile.email}`}
                     className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                   >
                     <div className="p-2 bg-primary/10 rounded-lg">
                       <Mail className="h-5 w-5 text-primary" />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">{t("organization.email") || "Email"}</p>
                       <p className="font-medium">{profile.email}</p>
                     </div>
                   </a>
                 )}
                 {profile.address && (
                   <div className="flex items-center gap-3 text-sm text-muted-foreground">
                     <div className="p-2 bg-primary/10 rounded-lg">
                       <MapPin className="h-5 w-5 text-primary" />
                     </div>
                     <div>
                       <p className="text-xs text-muted-foreground">{t("organization.address") || "Address"}</p>
                       <p className="font-medium">{profile.address}</p>
                     </div>
                   </div>
                 )}
               </div>
             </CardContent>
           </Card>
         </div>
       </section>

       <section className="pb-8">
         <div className="container mx-auto px-4">
           <WebPushOptIn organizationSlug={profile.slug} organizationName={profile.name} locale={locale} />
         </div>
       </section>
     </div>
   )
 }
