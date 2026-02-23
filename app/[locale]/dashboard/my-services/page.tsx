"use client"

import { useState, useEffect } from "react"
import { 
  Scissors, 
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, toPersianDigits } from "@/lib/persian"

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
  isActive: boolean
  category: {
    name: string
  }
  organization: {
    name: string
  }
  _count?: {
    appointments: number
  }
}

export default function MyServicesPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState<Service[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary("fa"))
    })
    
    // Fetch services assigned to the current user
    fetch("/api/services?provider=me")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch services")
        return res.json()
      })
      .then(data => {
        setServices(data.data || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  if (!mounted) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("navigation.services")}</h1>
        <p className="text-muted-foreground">خدماتی که شما ارائه می‌دهید</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Scissors className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{toPersianDigits(services.length)}</p>
                <p className="text-sm text-muted-foreground">خدمات فعال</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {toPersianDigits(services.reduce((acc, s) => acc + (s._count?.appointments || 0), 0))}
                </p>
                <p className="text-sm text-muted-foreground">نوبت‌های انجام شده</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {toPersianDigits(services.reduce((acc, s) => acc + s.duration, 0))}
                </p>
                <p className="text-sm text-muted-foreground">دقیقه میانگین</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Scissors className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">هنوز خدمتی به شما اختصاص داده نشده</p>
            <p className="text-sm text-muted-foreground mt-2">
              با مدیر سازمان خود تماس بگیرید
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <Card key={service.id} className={!service.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <Badge variant={service.isActive ? "default" : "secondary"}>
                    {service.isActive ? "فعال" : "غیرفعال"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {service.description || "بدون توضیحات"}
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">دسته‌بندی:</span>
                    <span>{service.category?.name || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مدت:</span>
                    <span>{toPersianDigits(service.duration)} دقیقه</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">قیمت:</span>
                    <span className="font-medium text-primary">
                      {formatToman(service.price)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">سازمان:</span>
                    <span>{service.organization?.name || "-"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
