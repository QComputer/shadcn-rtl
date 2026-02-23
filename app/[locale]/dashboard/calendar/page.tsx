"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  ChevronRight,
  ChevronLeft,
  User,
  CheckCircle,
  AlertCircle,
  XCircle,
  Filter
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatPersianDate, formatToman, toPersianDigits } from "@/lib/persian"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"

interface Appointment {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  notes: string | null
  service: {
    id: string
    name: string
    price: number
    duration: number
    category: {
      name: string
    }
    serviceProvider: {
      id: string
      firstName: string
      lastName: string
    } | null
  }
  customer: {
    id: string
    firstName: string
    lastName: string
    phone: string
  }
}

const statusConfig: Record<string, { 
  label: string; 
  icon: any; 
  color: string; 
  variant: "default" | "secondary" | "destructive" | "outline"
}> = {
  PENDING: { label: "در انتظار", icon: AlertCircle, color: "bg-yellow-500", variant: "default" },
  CONFIRMED: { label: "تأیید شده", icon: CheckCircle, color: "bg-blue-500", variant: "default" },
  COMPLETED: { label: "تکمیل شده", icon: CheckCircle, color: "bg-green-500", variant: "secondary" },
  CANCELLED: { label: "لغو شده", icon: XCircle, color: "bg-red-500", variant: "destructive" },
  NO_SHOW: { label: "عدم حضور", icon: XCircle, color: "bg-gray-500", variant: "secondary" },
}

export default function StaffCalendarPage({ 
  params 
}: { 
  params: Promise<{ locale: string }>
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [view, setView] = useState<"day" | "week">("day")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
    
    // Fetch all appointments
    fetch("/api/appointments")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch appointments")
        return res.json()
      })
      .then(data => {
        setAppointments(data.data || [])
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

  // Filter appointments for selected date
  const dayAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date).toDateString()
    const selected = selectedDate.toDateString()
    return aptDate === selected
  })

  // Update appointment status
  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      
      if (!res.ok) throw new Error("Failed to update")
      
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === id 
            ? { ...apt, status }
            : apt
        )
      )
      setSelectedAppointment(null)
    } catch (err) {
      alert("خطا در به‌روزرسانی")
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">تقویم نوبت‌ها</h1>
            <p className="text-muted-foreground">مدیریت و پیگیری نوبت‌ها</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                const newDate = new Date(selectedDate)
                newDate.setDate(selectedDate.getDate() - 1)
                setSelectedDate(newDate)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="px-4 py-2 bg-muted rounded-lg font-medium min-w-[140px] text-center">
              {formatPersianDate(selectedDate, "full")}
            </div>
            <Button 
              variant="outline"
              onClick={() => {
                const newDate = new Date(selectedDate)
                newDate.setDate(selectedDate.getDate() + 1)
                setSelectedDate(newDate)
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline"
              onClick={() => setSelectedDate(new Date())}
            >
              {t("calendar.today")}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{dayAppointments.length}</div>
              <p className="text-sm text-muted-foreground">مجموع نوبت‌ها</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">
                {dayAppointments.filter(a => a.status === "PENDING").length}
              </div>
              <p className="text-sm text-muted-foreground">در انتظار</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {dayAppointments.filter(a => a.status === "CONFIRMED").length}
              </div>
              <p className="text-sm text-muted-foreground">تأیید شده</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">
                {dayAppointments.filter(a => a.status === "COMPLETED").length}
              </div>
              <p className="text-sm text-muted-foreground">تکمیل شده</p>
            </CardContent>
          </Card>
        </div>

        {/* Appointments Timeline */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : dayAppointments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">نوبتی برای این روز وجود ندارد</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {dayAppointments
              .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
              .map((apt) => {
                const status = statusConfig[apt.status]
                const StatusIcon = status?.icon || AlertCircle
                
                return (
                  <Card 
                    key={apt.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedAppointment(apt)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Time */}
                        <div className="flex items-center gap-4 min-w-[150px]">
                          <div className={`p-2 rounded-lg ${status?.color || 'bg-muted'}`}>
                            <Clock className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold">
                              {new Date(apt.startTime).toLocaleTimeString("fa-IR", { 
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {apt.service.duration} دقیقه
                            </p>
                          </div>
                        </div>

                        {/* Service & Customer */}
                        <div className="flex-1">
                          <h3 className="font-semibold">{apt.service.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{apt.customer.firstName} {apt.customer.lastName}</span>
                            <span>•</span>
                            <span>{apt.customer.phone}</span>
                          </div>
                          {apt.service.category && (
                            <Badge variant="outline" className="mt-1">
                              {apt.service.category.name}
                            </Badge>
                          )}
                        </div>

                        {/* Status & Actions */}
                        <div className="flex items-center gap-3">
                          <Badge variant={status?.variant || "secondary"}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {status?.label || apt.status}
                          </Badge>
                        </div>
                      </div>

                      {apt.notes && (
                        <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                          <strong>یادداشت:</strong> {apt.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
          </div>
        )}

        {/* Appointment Details Dialog */}
        <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>جزئیات نوبت</DialogTitle>
            </DialogHeader>
            {selectedAppointment && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold text-lg">{selectedAppointment.service.name}</h3>
                  <p className="text-muted-foreground">{selectedAppointment.service.category?.name}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مشتری:</span>
                    <span className="font-medium">
                      {selectedAppointment.customer.firstName} {selectedAppointment.customer.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تلفن:</span>
                    <span>{selectedAppointment.customer.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ساعت:</span>
                    <span>
                      {new Date(selectedAppointment.startTime).toLocaleTimeString("fa-IR", { 
                        hour: "2-digit", 
                        minute: "2-digit" 
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">قیمت:</span>
                    <span className="font-bold text-primary">
                      {formatToman(selectedAppointment.service.price)}
                    </span>
                  </div>
                </div>

                {selectedAppointment.notes && (
                  <div>
                    <span className="text-muted-foreground">یادداشت:</span>
                    <p className="mt-1">{selectedAppointment.notes}</p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(selectedAppointment.status) && (
                    <>
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatus(selectedAppointment.id, "CONFIRMED")}
                      >
                        <CheckCircle className="h-4 w-4 ml-1" />
                        تأیید
                      </Button>
                      <Button 
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => updateStatus(selectedAppointment.id, "COMPLETED")}
                      >
                        تکمیل شده
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatus(selectedAppointment.id, "CANCELLED")}
                      >
                        <XCircle className="h-4 w-4 ml-1" />
                        لغو
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
