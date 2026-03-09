"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Mail, 
  ChevronRight,
  Star,
  Users,
  CheckCircle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman } from "@/lib/persian"

interface ServiceCategory {
  id: string
  name: string
  description: string | null
  image: string | null
  services: Service[]
}

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
  image: string | null
  serviceProvider: {
    id: string
    firstName: string
    lastName: string
    avatar: string | null
  } | null
}

interface BusinessHour {
  day: string
  openTime: string
  closeTime: string
  isOpen: boolean
}

interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo: string | null
  coverImage: string | null
}

interface OrganizationData {
  organization: Organization
  categories: ServiceCategory[]
  businessHours: BusinessHour[]
}

// Persian day names mapping
const dayNames: Record<string, string> = {
  SATURDAY: "شنبه",
  SUNDAY: "یکشنبه",
  MONDAY: "دوشنبه",
  TUESDAY: "سه‌شنبه",
  WEDNESDAY: "چهارشنبه",
  THURSDAY: "پنج‌شنبه",
  FRIDAY: "جمعه",
}

export default function OrganizationPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<OrganizationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    
    // Load dictionary
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Fetch organization data
    fetch(`/api/public/organizations/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error("Organization not found")
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

  // Get today's hours
  const getTodayHours = () => {
    if (!data?.businessHours) return null
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" })
    const dayMap: Record<string, string> = {
      Saturday: "SATURDAY",
      Sunday: "SUNDAY",
      Monday: "MONDAY",
      Tuesday: "TUESDAY",
      Wednesday: "WEDNESDAY",
      Thursday: "THURSDAY",
      Friday: "FRIDAY",
    }
    const englishDay = dayMap[today]
    return data.businessHours.find(h => h.day === englishDay)
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-96 w-full" />
        <div className="container mx-auto px-4 py-8 space-y-8">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
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
            <p className="text-muted-foreground">{error || "Organization not found"}</p>
            <Button className="mt-4">
              <Link href="/">{t("common.back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { organization, categories, businessHours } = data
  const todayHours = getTodayHours()

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-96 bg-gradient-to-br from-primary/20 via-primary/10 to-background">
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="container mx-auto px-4 pt-32 relative z-10">
          <div className="max-w-3xl">
            {organization.logo && (
              <div className="w-24 h-24 rounded-lg overflow-hidden mb-6 bg-card">
                <img 
                  src={organization.logo} 
                  alt={organization.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-xl text-muted-foreground mb-6">
                {organization.description}
              </p>
            )}
            <div className="flex flex-wrap gap-4 mb-6">
               <Button size="lg" className="gap-2">
                 <Link href={`/${locale}/organizations/${slug}/booking`}>
                   <Calendar className="h-4 w-4" />
                   {t("organization.bookNow")}
                 </Link>
               </Button>
               <Button size="lg" variant="secondary" className="gap-2">
                 <Link href={`/${locale}/organizations/${slug}/my-appointments`}>
                   <Calendar className="h-4 w-4" />
                   <p>{t("organization.myAppointments")}</p>
                 </Link>
               </Button>
             </div>
          </div>
        </div>
      </section>

      {/* Quick Info Bar */}
      <section className="border-b bg-card pt-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            {organization.phone && (
              <a 
                href={`tel:${organization.phone}`} 
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>{organization.phone}</span>
              </a>
            )}
            {organization.email && (
              <a 
                href={`mailto:${organization.email}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>{organization.email}</span>
              </a>
            )}
            {organization.address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{organization.address}</span>
              </div>
            )}
            {todayHours && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {todayHours.isOpen 
                    ? `${todayHours.openTime} - ${todayHours.closeTime}`
                    : t("organization.closed")
                  }
                </span>
                <Badge variant={todayHours.isOpen ? "default" : "secondary"}>
                  {todayHours.isOpen ? t("organization.open") : t("organization.closed")}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">{t("organization.ourServices")}</h2>
              <p className="text-muted-foreground mt-2">
                {categories.length} {t("organization.categories")}
              </p>
            </div>
            <Button variant="outline">
              <Link href={`/${locale}/organizations/${slug}/services`}>
                {t("dashboard.viewAll")}
                <ChevronRight className="h-4 w-4 mr-2" />
              </Link>
            </Button>
          </div>

          {categories.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>{t("common.no_results")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.slice(0, 6).map((category) => (
                <Card key={category.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {category.image && (
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={category.image} 
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-xl">{category.name}</CardTitle>
                    {category.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {category.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.services.slice(0, 3).map((service) => (
                        <div 
                          key={service.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{service.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {service.duration} {t("appointment.minutes")}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-primary">
                              {formatToman(service.price)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {category.services.length > 3 && (
                        <Button variant="ghost" size="sm" className="w-full">
                          <Link href={`/${locale}/organizations/${slug}/services?category=${category.id}`}>
                            +{category.services.length - 3} {t("common.more")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Business Hours */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">{t("organization.businessHours")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {businessHours.map((hours) => (
              <Card key={hours.day}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{dayNames[hours.day]}</span>
                    <Badge variant={hours.isOpen ? "default" : "secondary"}>
                      {hours.isOpen ? t("organization.open") : t("organization.closed")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-2">
                    {hours.isOpen 
                      ? `${hours.openTime} - ${hours.closeTime}`
                      : "-"
                    }
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features / Why Choose Us */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8 text-center">چرا ما را انتخاب کنید؟</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">رزرو آنلاین آسان</h3>
                <p className="text-muted-foreground">
                  در هر زمان و مکانی به راحتی نوبت خود را رزرو کنید
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">تیم حرفه‌ای</h3>
                <p className="text-muted-foreground">
                  متخصصان مجرب و با تجربه آماده ارائه خدمات به شما
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Star className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">رضایت مشتری</h3>
                <p className="text-muted-foreground">
                  اولویت ما رضایت شماست
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">آماده رزرو هستید؟</h2>
          <p className="text-xl mb-8 opacity-90">
            همین الان نوبت خود را رزرو کنید
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="gap-2"
          >
            <Link href={`/${locale}/organizations/${slug}/booking`}>
              <Calendar className="h-5 w-5" />
              {t("organization.bookNow")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
