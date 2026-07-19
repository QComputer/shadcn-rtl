"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Clock, 
  User, 
  ChevronRight,
  Filter,
  Search,
  Calendar
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman } from "@/lib/persian"
import { cn } from "@/lib/utils"
import { getServicePrimaryMediaUrl } from "@/lib/ai-media/entity-primary-media"

interface Service {
  id: string
  slug: string | null
  name: string
  description: string | null
  price: number
  duration: number
  image: string | null
  aiPrimaryMediaAssetId?: string | null
  category: {
    id: string
    slug: string | null
    name: string
  }
  serviceProvider: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
  } | null
}

interface Category {
  id: string
  slug: string | null
  name: string
  description: string | null
  serviceCount: number
}

interface ServicesData {
  services: Service[]
  categories: Category[]
}

export default function ServicesPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<ServicesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    fetch(`/api/public/organizations/${slug}/services`)
      .then(res => {
        if (!res.ok) throw new Error("Services not found")
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
  }, [locale, slug])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Filter services
  const filteredServices = data?.services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    const matchesCategory = selectedCategory === "all" || service.category.id === selectedCategory
    return matchesSearch && matchesCategory
  }) ?? []

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="flex gap-4 mb-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={locale+i} className="h-48" />
            ))}
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
              <Link href={`/${locale}/appointment/${slug}`}>{t("common.back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
<Link 
             href={`/${locale}/appointment/${slug}`}
             className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            {t("common.back")}
          </Link>
          <h1 className="text-3xl font-bold">{t("service.title")}s</h1>
          <p className="text-muted-foreground">
            {filteredServices.length} {t("service.title").toLowerCase()}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 ml-2" />
              <SelectValue placeholder={t("category.title")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {data.categories.map(category => (
                <SelectItem key={locale+category.id} value={category.id}>
                  {category.name} ({category.serviceCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {data.categories.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <Link
              href={`/${locale}/appointment/${slug}/services`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t("common.all")}
            </Link>
            {data.categories.map((category) => (
              <Link
                key={locale + category.id}
                href={`/${locale}/appointment/${slug}/services/category/${category.slug || category.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                {category.name} ({category.serviceCount})
              </Link>
            ))}
          </div>
        )}

        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>{t("common.no_results")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map(service => (
              <Card key={locale+service.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {getServicePrimaryMediaUrl(service) && (
                  <div className="h-48 overflow-hidden">
                    <Link href={`/${locale}/appointment/${slug}/services/${service.slug || service.id}`}>
                      <img
                        src={getServicePrimaryMediaUrl(service) || undefined}
                        alt={service.name}
                        className="h-full w-full object-cover transition-transform hover:scale-[1.02]"
                      />
                    </Link>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">
                      <Link href={`/${locale}/appointment/${slug}/services/${service.slug || service.id}`} className="hover:text-primary">
                        {service.name}
                      </Link>
                    </CardTitle>
                    <Badge variant="secondary">{service.category.name}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {service.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {service.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{service.duration} {t("appointment.minutes")}</span>
                    </div>
                    {service.serviceProvider && (
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{service.serviceProvider.firstName} {service.serviceProvider.lastName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg text-primary">
                      {formatToman(service.price)}
                    </span>
                    <Link href={`/${locale}/appointment/${slug}/booking?service=${service.id}`}>
                      <Button>
                        <Calendar className="h-4 w-4 ml-2" />
                        {t("organization.bookNow")}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
