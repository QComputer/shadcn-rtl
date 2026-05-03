"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Calendar, 
  Clock, 
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  User,
  Phone,
  Mail,
  ArrowRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, formatPersianDate, toPersianDigits } from "@/lib/persian"

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
  image: string | null
  categoryId: string
  category: {
    id: string
    name: string
  }
  serviceProvider: {
    id: string
    name: string
    firstName: string
    lastName: string
  } | null
  organization: Organization
}

interface ServiceCategory {
  id: string
  name: string
  services: Service[]
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
}

interface OrganizationData {
  organization: Organization
  categories: ServiceCategory[]
  businessHours: BusinessHour[]
}

type BookingStep = "service" | "datetime" | "details" | "confirm"

const dayNames: Record<string, string> = {
  SATURDAY: "شنبه",
  SUNDAY: "یکشنبه",
  MONDAY: "دوشنبه",
  TUESDAY: "سه‌شنبه",
  WEDNESDAY: "چهارشنبه",
  THURSDAY: "پنج‌شنبه",
  FRIDAY: "جمعه",
}

export default function BookingPage({ 
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
  
  // Booking state
  const [step, setStep] = useState<BookingStep>("service")
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  
  // Customer details
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [notes, setNotes] = useState("")
  
  // Booking result
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
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

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedService || !selectedDate) {
      setAvailableSlots([])
      return
    }

    setLoadingSlots(true)
    const dateStr = selectedDate.toISOString().split('T')[0]
    
    fetch(`/api/services/${selectedService.id}/slots?date=${dateStr}`)
      .then(res => res.json())
      .then(slots => {
        setAvailableSlots(slots.data || [])
        setLoadingSlots(false)
      })
      .catch(() => {
        setAvailableSlots([])
        setLoadingSlots(false)
      })
  }, [selectedService, selectedDate])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Get week dates
  const getWeekDates = (startDate: Date) => {
    const dates: Date[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const diff = dayOfWeek === 0 ? -1 : 6 - dayOfWeek // Adjust for Sunday start
    const saturday = new Date(today)
    saturday.setDate(today.getDate() + diff)
    return saturday
  })

  const weekDates = getWeekDates(weekStart)

  const handleSubmitBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return

    setSubmitting(true)
    setBookingError(null)

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          date: selectedDate.toISOString(),
          startTime: selectedTime,
          notes: notes || undefined,
          // Include customer details for guest booking
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to book appointment")
      }

      setBookingSuccess(true)
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
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
              <Link href={`/${locale}/organizations/${slug}`}>{t("common.back")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { organization, categories } = data

  // Success state
  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="text-center py-8">
            <CardContent>
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold mb-2">{t("appointment.bookingConfirmed")}</h1>
              <p className="text-muted-foreground mb-6">{t("appointment.thankYou")}</p>
              
              <div className="bg-muted rounded-lg p-4 text-right mb-6">
                <p className="font-medium">سرویس: {selectedService?.name}</p>
                <p className="font-medium"> ارائه دهنده: {selectedService?.serviceProvider?.firstName} {selectedService?.serviceProvider?.lastName}</p>
                <p className="text-muted-foreground">
                  {selectedDate && formatPersianDate(selectedDate, "full")}
                </p>
                <p className="text-muted-foreground">
                  {selectedTime && formatPersianDate(selectedTime)}
                </p>
              </div>

              <div className="flex gap-4 justify-center">
                <Button variant="outline">
                  <Link href={`/${locale}/organizations/${slug}`}>
                    {t("common.back")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href={`/${locale}/organizations/${slug}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ChevronRight className="h-4 w-4" />
            {t("common.back")}
          </Link>
          <h1 className="text-3xl font-bold">{t("appointment.book")}</h1>
          <p className="text-muted-foreground">{organization.name}</p>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-0 mb-8 text-sm">
          <Badge variant={step === "service" ? "default" : "secondary"}>
            1. {t("appointment.selectService")}
          </Badge>
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === "datetime" ? "default" : "secondary"}>
            2. {t("appointment.selectDate")}
          </Badge>
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === "details" ? "default" : "secondary"}>
            3. {t("appointment.yourInfo")}
          </Badge>
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
          <Badge variant={step === "confirm" ? "default" : "secondary"}>
            4. {t("appointment.confirm")}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Select Service */}
            {step === "service" && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("appointment.selectService")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {categories.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {t("common.no_results")}
                    </p>
                  ) : (
                    categories.map(category => (
                      <div key={locale+category.id} className="space-y-3">
                        <h3 className="font-semibold text-lg">{category.name}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {category.services.map(service => (
                            <div
                              key={locale+service.id}
                              onClick={() => setSelectedService(service)}
                              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                selectedService?.id === service.id
                                  ? "border-primary bg-primary/5"
                                  : "hover:border-primary/50"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium">{service.name}</h4>
                                <span className="font-bold text-primary">
                                  {formatToman(service.price)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{service.duration} {t("appointment.minutes")}</span>
                              </div>
                              {service.serviceProvider && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <User className="h-3 w-3" />
                                  <span>{service.serviceProvider.firstName} {service.serviceProvider.lastName}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 2: Select Date & Time */}
            {step === "datetime" && selectedService && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("appointment.selectDate")} و {t("appointment.selectTime")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Week Navigation */}
                  <div className="flex items-center justify-between">
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newStart = new Date(weekStart)
                        newStart.setDate(weekStart.getDate() - 7)
                        setWeekStart(newStart)
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="font-medium">
                      {formatPersianDate(weekStart, "short")} - {formatPersianDate(weekDates[6], "short")}
                    </span>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newStart = new Date(weekStart)
                        newStart.setDate(weekStart.getDate() + 7)
                        setWeekStart(newStart)
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Date Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {weekDates.map((date, index) => {
                      const isToday = new Date().toDateString() === date.toDateString()
                      const isPast = date < new Date(new Date().setHours(0,0,0,0))
                      const isSelected = selectedDate?.toDateString() === date.toDateString()
                      const dayName = dayNames[date.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()]

                      return (
                        <button
                          key={locale+index}
                          disabled={isPast}
                          onClick={() => {
                            setSelectedDate(date)
                            setSelectedTime(null)
                          }}
                          className={`p-3 rounded-lg text-center transition-all ${
                            isPast 
                              ? "opacity-50 cursor-not-allowed bg-muted"
                              : isSelected
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-primary/10 bg-muted/50"
                          }`}
                        >
                          <p className="text-xs mb-1">{dayName}</p>
                          <p className="text-lg font-bold">{formatPersianDate(date,'daydate')}</p>
                          {isToday && (
                            <Badge variant="secondary" className="text-xs -mr-2">امروز</Badge>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Time Slots */}
                  {selectedDate && (
                    <div>
                      <h4 className="font-medium mb-3">{t("appointment.availableSlots")}</h4>
                      {loadingSlots ? (
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {[...Array(12)].map((_, i) => (
                            <Skeleton key={locale+i} className="h-10" />
                          ))}
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">
                          {t("appointment.noSlots")}
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {availableSlots.map((slot) => (
                            <button
                              key={locale+slot}
                              onClick={() => setSelectedTime(slot)}
                              className={`p-2 rounded-lg text-sm transition-all ${
                                selectedTime === slot
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-primary/10 bg-muted/50"
                              }`}
                            >
                              {formatPersianDate(slot, 'time')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Customer Details */}
            {step === "details" && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("appointment.yourInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("user.firstName")} *</Label>
                      <Input
                        id="name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="نام و نام خانوادگی"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("user.phone")} *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("user.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">{t("appointment.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="توضیحات اضافی..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Confirm */}
            {step === "confirm" && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("appointment.confirm")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bookingError && (
                    <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive">
                      {bookingError}
                    </div>
                  )}
                  
                  <div className="space-y-3 p-4 bg-muted rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("service.name")}:</span>
                      <span className="font-medium">{selectedService?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("appointment.duration")}:</span>
                      <span className="font-medium">{selectedService?.duration} {t("appointment.minutes")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("appointment.selectDate")}:</span>
                      <span className="font-medium">
                        {selectedDate && formatPersianDate(selectedDate, "full")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("appointment.selectTime")}:</span>
                      <span className="font-medium">
                        {selectedTime && formatPersianDate(selectedTime, 'time')}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-3">
                      <span className="text-muted-foreground">{t("order.total")}:</span>
                      <span className="font-bold text-lg text-primary">
                        {selectedService && formatToman(selectedService.price)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p><strong>{t("user.firstName")}:</strong> {customerName}</p>
                    <p><strong>{t("user.phone")}:</strong> {customerPhone}</p>
                    {customerEmail && <p><strong>{t("user.email")}:</strong> {customerEmail}</p>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              {step === "service" ? (
                <div />
              ) : (
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (step === "datetime") setStep("service")
                    else if (step === "details") setStep("datetime")
                    else if (step === "confirm") setStep("details")
                  }}
                >
                  <ChevronRight className="h-4 w-4 ml-2" />
                  {t("common.previous")}
                </Button>
              )}
              
              {step === "service" && (
                <Button 
                  disabled={!selectedService}
                  onClick={() => setStep("datetime")}
                >
                  {t("common.next")}
                  <ChevronLeft className="h-4 w-4 mr-2" />
                </Button>
              )}
              {step === "datetime" && (
                <Button 
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep("details")}
                >
                  {t("common.next")}
                  <ChevronLeft className="h-4 w-4 mr-2" />
                </Button>
              )}
              {step === "details" && (
                <Button 
                  disabled={!customerName || !customerPhone}
                  onClick={() => setStep("confirm")}
                >
                  {t("common.next")}
                  <ChevronLeft className="h-4 w-4 mr-2" />
                </Button>
              )}
              {step === "confirm" && (
                <Button 
                  onClick={handleSubmitBooking}
                  disabled={submitting}
                >
                  {submitting ? t("common.loading") : t("appointment.confirm")}
                  <CheckCircle className="h-4 w-4 mr-2" />
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar - Booking Summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>{t("booking.summary") || "خلاصه رزرو"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedService ? (
                  <>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="font-medium">{selectedService.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedService.duration} {t("appointment.minutes")}
                      </p>
                    </div>
                    {selectedDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatPersianDate(selectedDate, "date")}</span>
                      </div>
                    )}
                    {selectedTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{formatPersianDate(selectedTime, 'time')}</span>
                      </div>
                    )}
                    <div className="border-t pt-4">
                      <div className="flex justify-between">
                        <span>{t("order.total")}:</span>
                        <span className="font-bold text-lg text-primary">
                          {formatToman(selectedService.price)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t("appointment.selectService")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}