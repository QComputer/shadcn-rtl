"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  User,
  XCircle,
  CheckCircle,
  AlertCircle,
  Copy,
  Check
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, formatPersianDate } from "@/lib/persian"

interface AppointmentData {
  appointment: {
    id: string
    bookingReference: string | null
    date: Date
    startTime: Date
    endTime: Date
    status: string
    notes: string | null
    cancelledAt: Date | null
    cancellationReason: string | null
    customerNameAtBooking: string | null
    customerPhoneAtBooking: string | null
    customerEmailAtBooking: string | null
    service: {
      id: string
      name: string
      description: string | null
      duration: number
      price: number
      image: string | null
      organization: {
        id: string
        name: string
        slug: string
        address: string | null
        phone: string | null
        email: string | null
      }
      category: {
        id: string
        name: string
      } | null
      serviceProvider: {
        id: string
        firstName: string
        lastName: string
        avatar: string | null
        phone: string | null
      } | null
    }
    customer: {
      id: string
      firstName: string | null
      lastName: string | null
      phone: string | null
      email: string | null
    } | null
  }
}

export default function AppointmentDetailPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string; id: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  const appointmentId = resolvedParams.id
  
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<AppointmentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Get phone from localStorage for verification
    const phone = localStorage.getItem(`booking_phone_${slug}`)
    const url = new URL(window.location.href)
    const ref = url.searchParams.get("ref")
    
    let fetchUrl = `/api/public/appointments/${appointmentId}?`
    if (phone) fetchUrl += `phone=${encodeURIComponent(phone)}&`
    if (ref) fetchUrl += `ref=${encodeURIComponent(ref)}`
    
    fetch(fetchUrl)
      .then(res => {
        if (!res.ok) throw new Error("Appointment not found")
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
  }, [locale, slug, appointmentId])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const copyBookingRef = () => {
    if (data?.appointment.bookingReference) {
      navigator.clipboard.writeText(data.appointment.bookingReference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { 
      variant: "default" | "secondary" | "destructive" | "outline"; 
      icon: React.ReactNode; 
      label: string;
      color: string;
    }> = {
      PENDING: { 
        variant: "secondary", 
        icon: <AlertCircle className="h-4 w-4" />, 
        label: t("common.pending"),
        color: "text-yellow-600"
      },
      CONFIRMED: { 
        variant: "default", 
        icon: <CheckCircle className="h-4 w-4" />, 
        label: t("appointment.confirm"),
        color: "text-green-600"
      },
      COMPLETED: { 
        variant: "default", 
        icon: <CheckCircle className="h-4 w-4" />, 
        label: t("appointment.completed"),
        color: "text-green-600"
      },
      CANCELLED: { 
        variant: "destructive", 
        icon: <XCircle className="h-4 w-4" />, 
        label: t("appointment.cancelled"),
        color: "text-red-600"
      },
      NO_SHOW: { 
        variant: "outline", 
        icon: <XCircle className="h-4 w-4" />, 
        label: t("appointment.noShow"),
        color: "text-gray-600"
      },
    }
    
    return statusConfig[status] || statusConfig.PENDING
  }

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <Skeleton className="h-8 w-48 mb-8" />
          <Skeleton className="h-64" />
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
<Link href={`/${locale}/appointment/${slug}/my-appointments`}>
               <Button className="mt-4">{t("common.back")}</Button>
             </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { appointment } = data
  const statusInfo = getStatusInfo(appointment.status)
  const isPast = new Date(appointment.startTime) < new Date()

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
<Link 
             href={`/${locale}/appointment/${slug}`}
             className="hover:text-foreground"
           >
             {appointment.service.organization.name}
           </Link>
           <ChevronRight className="h-4 w-4" />
           <Link 
             href={`/${locale}/appointment/${slug}/my-appointments`}
             className="hover:text-foreground"
           >
             {t("navigation.myAppointments")}
           </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">{t("common.details")}</span>
        </nav>

        {/* Status Alert */}
        {appointment.status === "CANCELLED" && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
            <div className="flex items-center gap-2 font-medium mb-1">
              <XCircle className="h-4 w-4" />
              {t("appointment.cancelled")}
            </div>
            <p className="text-sm">
              {appointment.cancellationReason || "This appointment has been cancelled"}
              {appointment.cancelledAt && (
                <span className="block mt-1">
                  {formatPersianDate(new Date(appointment.cancelledAt), "full")}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Main Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{appointment.service.name}</CardTitle>
                <p className="text-muted-foreground mt-1">
                  {appointment.service.organization.name}
                </p>
              </div>
              <Badge variant={statusInfo.variant} className="gap-1">
                {statusInfo.icon}
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Booking Reference */}
            {appointment.bookingReference && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Booking Reference</p>
                  <p className="font-mono text-lg font-bold">{appointment.bookingReference}</p>
                </div>
                <Button variant="outline" size="icon" onClick={copyBookingRef}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("appointment.selectDate")}</p>
                  <p className="font-medium">
                    {formatPersianDate(new Date(appointment.startTime), "full")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("appointment.selectTime")}</p>
                  <p className="font-medium">
                    {formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.service.duration} {t("appointment.minutes")}
                  </p>
                </div>
              </div>
            </div>

            {/* Service Provider */}
            {appointment.service.serviceProvider && (
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("appointment.provider")}</p>
                  <p className="font-medium">
                    {appointment.service.serviceProvider.firstName} {appointment.service.serviceProvider.lastName}
                  </p>
                  {appointment.service.serviceProvider.phone && (
                    <p className="text-sm text-muted-foreground">
                      {appointment.service.serviceProvider.phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Organization Contact */}
            <div className="space-y-2">
              <h3 className="font-medium">{t("organization.title")} {t("common.details")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {appointment.service.organization.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{appointment.service.organization.address}</span>
                  </div>
                )}
                {appointment.service.organization.phone && (
                  <a 
                    href={`tel:${appointment.service.organization.phone}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Phone className="h-4 w-4" />
                    <span>{appointment.service.organization.phone}</span>
                  </a>
                )}
                {appointment.service.organization.email && (
                  <a 
                    href={`mailto:${appointment.service.organization.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Mail className="h-4 w-4" />
                    <span>{appointment.service.organization.email}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Notes */}
            {appointment.notes && (
              <div>
                <h3 className="font-medium mb-2">{t("appointment.notes")}</h3>
                <p className="text-muted-foreground text-sm p-3 bg-muted rounded-lg">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-muted-foreground">{t("order.total")}:</span>
              <span className="text-2xl font-bold text-primary">
                {formatToman(appointment.service.price)}
              </span>
            </div>

            {/* Actions */}
<div className="flex flex-wrap gap-3 pt-4">
               <Link href={`/${locale}/appointment/${slug}`}>
                 <Button variant="outline">
                   {t("organization.title")}
                 </Button>
               </Link>
               {!isPast && appointment.status !== "CANCELLED" && (
                 <Link href={`/${locale}/appointment/${slug}/booking?service=${appointment.service.id}`}>
                   <Button>
                     {t("appointment.reschedule")}
                   </Button>
                 </Link>
               )}
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
