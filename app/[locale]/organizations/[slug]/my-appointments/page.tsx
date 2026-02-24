"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  ChevronRight,
  Search,
  Phone,
  XCircle,
  CheckCircle,
  AlertCircle,
  CalendarClock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, formatPersianDate } from "@/lib/persian"

interface Appointment {
  id: string
  bookingReference: string | null
  date: Date
  startTime: Date
  endTime: Date
  status: string
  notes: string | null
  customerNameAtBooking: string | null
  customerPhoneAtBooking: string | null
  service: {
    id: string
    name: string
    duration: number
    price: number
    organization: {
      name: string
      slug: string
    }
  }
  customer: {
    firstName: string | null
    lastName: string | null
    phone: string | null
  } | null
}

export default function MyAppointmentsPage({ 
  params 
}: { 
  params: Promise<{ locale: string; slug: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale
  const slug = resolvedParams.slug
  
  const [mounted, setMounted] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  
  // Lookup state
  const [phone, setPhone] = useState("")
  const [bookingRef, setBookingRef] = useState("")
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [showLookup, setShowLookup] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Check for stored phone in localStorage
    const storedPhone = localStorage.getItem(`booking_phone_${slug}`)
    if (storedPhone) {
      setPhone(storedPhone)
      lookupAppointments(storedPhone)
    } else {
      setLoading(false)
      setShowLookup(true)
    }
  }, [locale, slug])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const lookupAppointments = async (phoneNumber?: string, reference?: string) => {
    setLookupLoading(true)
    setLookupError(null)
    
    try {
      const response = await fetch("/api/public/appointments/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber || phone || undefined,
          bookingReference: reference || bookingRef || undefined,
          organizationSlug: slug,
        }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to lookup appointments")
      }
      
      const data = await response.json()
      setAppointments(data.appointments)
      setShowLookup(false)
      
      // Store phone for future visits
      if (phoneNumber || phone) {
        localStorage.setItem(`booking_phone_${slug}`, phoneNumber || phone)
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed")
    } finally {
      setLookupLoading(false)
      setLoading(false)
    }
  }

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (phone || bookingRef) {
      lookupAppointments()
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode; label: string }> = {
      PENDING: { variant: "secondary", icon: <AlertCircle className="h-3 w-3" />, label: t("common.pending") },
      CONFIRMED: { variant: "default", icon: <CheckCircle className="h-3 w-3" />, label: t("appointment.confirm") },
      COMPLETED: { variant: "default", icon: <CheckCircle className="h-3 w-3" />, label: t("appointment.completed") },
      CANCELLED: { variant: "destructive", icon: <XCircle className="h-3 w-3" />, label: t("appointment.cancelled") },
      NO_SHOW: { variant: "outline", icon: <XCircle className="h-3 w-3" />, label: t("appointment.noShow") },
    }
    
    const config = statusConfig[status] || statusConfig.PENDING
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })
  }

  const isUpcoming = (startTime: Date) => {
    return new Date(startTime) > new Date()
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show lookup form if no appointments loaded
  if (showLookup) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>{t("appointment.title")}s</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLookupSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("user.phone")}</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {t("common.optional")}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Booking Reference</label>
                  <Input
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                    placeholder="ABC12345"
                    maxLength={8}
                  />
                </div>
                
                {lookupError && (
                  <p className="text-sm text-destructive">{lookupError}</p>
                )}
                
                <Button type="submit" className="w-full" disabled={lookupLoading}>
                  {lookupLoading ? t("common.loading") : t("common.search")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Split appointments into upcoming and past
  const upcomingAppointments = appointments.filter(a => isUpcoming(a.startTime) && a.status !== "CANCELLED")
  const pastAppointments = appointments.filter(a => !isUpcoming(a.startTime) || a.status === "CANCELLED")

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link 
              href={`/${locale}/organizations/${slug}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              {t("common.back")}
            </Link>
            <h1 className="text-3xl font-bold">{t("navigation.myAppointments")}</h1>
            <p className="text-muted-foreground">
              {appointments.length} {t("appointment.title").toLowerCase()}
            </p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Search className="h-4 w-4 ml-2" />
                {t("common.search")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("common.search")} {t("appointment.title")}</DialogTitle>
                <DialogDescription>
                  Enter your phone number or booking reference to find your appointments
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); lookupAppointments(); }} className="space-y-4">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("user.phone")}
                />
                <Input
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                  placeholder="Booking Reference"
                  maxLength={8}
                />
                <Button type="submit" className="w-full" disabled={lookupLoading}>
                  {lookupLoading ? t("common.loading") : t("common.search")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {appointments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">{t("common.no_results")}</p>
              <Link href={`/${locale}/organizations/${slug}/booking`}>
                <Button>{t("organization.bookNow")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Upcoming Appointments */}
            {upcomingAppointments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">{t("appointment.upcoming")}</h2>
                <div className="space-y-4">
                  {upcomingAppointments.map(appointment => (
                    <Card key={appointment.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium">{appointment.service.name}</h3>
                              {getStatusBadge(appointment.status)}
                            </div>
                            
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{formatPersianDate(new Date(appointment.startTime), "full")}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatTime(appointment.startTime)} - {formatTime(appointment.endTime)}</span>
                              </div>
                            </div>
                            
                            {appointment.bookingReference && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Reference: <span className="font-mono">{appointment.bookingReference}</span>
                              </p>
                            )}
                          </div>
                          
                          <div className="text-left">
                            <p className="font-bold text-primary">
                              {formatToman(appointment.service.price)}
                            </p>
                            <Link href={`/${locale}/organizations/${slug}/appointment/${appointment.id}`}>
                              <Button variant="outline" size="sm" className="mt-2">
                                {t("common.details")}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Past Appointments */}
            {pastAppointments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">{t("appointment.past")}</h2>
                <div className="space-y-4">
                  {pastAppointments.map(appointment => (
                    <Card key={appointment.id} className="opacity-75">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-medium">{appointment.service.name}</h3>
                              {getStatusBadge(appointment.status)}
                            </div>
                            
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{formatPersianDate(new Date(appointment.startTime), "date")}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatTime(appointment.startTime)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-left">
                            <p className="font-bold text-muted-foreground">
                              {formatToman(appointment.service.price)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
