"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  User, 
  ChevronRight,
  Calendar,
  Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman } from "@/lib/persian"
import { buildAppointmentPublicPath, useAppointmentRoutePaths } from "@/lib/contexts/appointment-route-context"

interface StaffMember {
  id: string
  userId: string
  username?: string
  role: string
  user: {
    id: string
    firstName: string | null
    lastName: string | null
    avatar: string | null
    phone: string | null
    email: string | null
  }
  services: {
    id: string
    name: string
    price: number
    duration: number
  }[]
  hasAvailability: boolean
}

interface StaffData {
  staff: StaffMember[]
}

export default function StaffPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  const appointmentRoutes = useAppointmentRoutePaths({
    href: (subPath = "/") => buildAppointmentPublicPath({ locale, organizationSlug: slug, subPath }),
    organizationRootHref: "/",
    isCustomDomain: false,
  })
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<StaffData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    fetch(`/api/public/organizations/${slug}/staff`)
      .then(res => {
        if (!res.ok) throw new Error("Staff not found")
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

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={locale+i} className="h-64" />
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
              <Link href={appointmentRoutes.href()}>{t("common.back")}</Link>
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
            href={appointmentRoutes.href()}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            {t("common.back")}
          </Link>
          <h1 className="text-3xl font-bold">{t("appointment.provider")}s</h1>
          <p className="text-muted-foreground">
            {data.staff.length} {t("appointment.provider").toLowerCase()}
          </p>
        </div>

        {data.staff.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>{t("common.no_results")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.staff.map(member => (
              <Card key={locale+member.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {member.user.avatar ? (
                      <img 
                        src={member.user.avatar}
                        alt={`${member.user.firstName} ${member.user.lastName}`}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {member.user.firstName} {member.user.lastName}
                      </CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {member.role}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Services */}
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">{t("service.title")}s</p>
                    <div className="space-y-2">
                      {member.services.slice(0, 3).map(service => (
                        <div 
                          key={locale+service.id}
                          className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                        >
                          <span>{service.name}</span>
                          <span className="text-primary font-medium">
                            {formatToman(service.price)}
                          </span>
                        </div>
                      ))}
                      {member.services.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{member.services.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link href={appointmentRoutes.href(`/booking?staff=${member.userId}`)} className="flex-1">
                      <Button className="w-full">
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
