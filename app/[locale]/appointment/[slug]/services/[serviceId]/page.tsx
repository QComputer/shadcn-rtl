"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Clock, 
  User, 
  ChevronRight,
  Calendar,
  Phone,
  Mail,
  Tag
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman } from "@/lib/persian"
import { getServicePrimaryMediaUrl } from "@/lib/ai-media/entity-primary-media"

interface ServiceData {
  service: {
    id: string
    name: string
    description: string | null
    price: number
    duration: number
    image: string | null
    aiPrimaryMediaAssetId?: string | null
    category: {
      id: string
      name: string
      description: string | null
    }
    serviceProvider: {
      id: string
      firstName: string
      lastName: string
      avatar: string | null
      phone: string | null
    } | null
    bookingCount: number
  }
}

export default function ServiceDetailPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string; serviceId: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  const serviceId = resolvedParams.serviceId
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<ServiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    fetch(`/api/public/organizations/${slug}/services/${serviceId}`)
      .then(res => {
        if (!res.ok) throw new Error("Service not found")
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [locale, slug, serviceId])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">{t("errors.notFound")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <Button className="mt-4">
              <Link href={`/${locale}/appointment/${slug}/services`}>{t("common.back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { service } = data

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
<Link 
             href={`/${locale}/appointment/${slug}`}
             className="hover:text-foreground"
           >
             {t("organization.title")}
           </Link>
           <ChevronRight className="h-4 w-4" />
           <Link 
             href={`/${locale}/appointment/${slug}/services`}
             className="hover:text-foreground"
           >
             {t("service.title")}s
           </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{service.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Image */}
            {getServicePrimaryMediaUrl(service) && (
              <div className="rounded-lg overflow-hidden">
                <img 
                  src={getServicePrimaryMediaUrl(service) || undefined}
                  alt={service.name}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {/* Service Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-2xl">{service.name}</CardTitle>
                  <Badge variant="secondary">{service.category.name}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {service.description && (
                  <p className="text-muted-foreground">
                    {service.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-5 w-5" />
                    <span>{service.duration} {t("appointment.minutes")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="h-5 w-5" />
                    <span>{service.bookingCount} {t("appointment.completed")}</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t("service.price")}</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatToman(service.price)}
                      </p>
                    </div>
<Link href={`/${locale}/appointment/${slug}/booking?service=${service.id}`}>
                       <Button size="lg">
                        <Calendar className="h-5 w-5 ml-2" />
                        {t("organization.bookNow")}
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Provider */}
            {service.serviceProvider && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("appointment.provider")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {service.serviceProvider.avatar ? (
                      <img 
                        src={service.serviceProvider.avatar}
                        alt={`${service.serviceProvider.firstName} ${service.serviceProvider.lastName}`}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-lg">
                        {service.serviceProvider.firstName} {service.serviceProvider.lastName}
                      </p>
                      {service.serviceProvider.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Phone className="h-4 w-4" />
                          <span>{service.serviceProvider.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Booking Card */}
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>{t("appointment.book")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.duration} {t("appointment.minutes")}
                  </p>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t("order.total")}:</span>
                  <span className="font-bold text-xl text-primary">
                    {formatToman(service.price)}
                  </span>
                </div>

<Link 
                   href={`/${locale}/appointment/${slug}/booking?service=${service.id}`} className="block">
                  <Button className="w-full">
                    <Calendar className="h-4 w-4 ml-2" />
                    {t("organization.bookNow")}
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Category Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("category.title")}</CardTitle>
              </CardHeader>
              <CardContent>
<Link 
                   href={`/${locale}/appointment/${slug}/services?category=${service.category.id}`}
                   className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                 >
                  <span>{service.category.name}</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
