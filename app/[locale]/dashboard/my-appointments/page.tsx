"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  CheckCircle,
  AlertCircle,
  XCircle
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { formatToman, toPersianDigits } from "@/lib/persian"

interface Appointment {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  notes: string | null
  service: {
    name: string
    price: number
    duration: number
    organization: {
      name: string
      slug: string
    }
  }
  customer: {
    firstName: string
    lastName: string
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

export default function MyAppointmentsPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming")
  

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary("fa"))
    })
    
    // Fetch user appointments
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

  // Filter appointments
  const filteredAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.date)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    if (filter === "upcoming") {
      return aptDate >= now && !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(apt.status)
    } else if (filter === "past") {
      return aptDate < now || ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(apt.status)
    }
    return true
  })

  // Cancel appointment
  const handleCancel = async (id: string) => {
    if (!confirm("آیا مطمئن هستید که می‌خواهید این نوبت را لغو کنید؟")) {
      return
    }

    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
      })
      
      if (!res.ok) throw new Error("Failed to cancel")
      
      // Refresh appointments
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === id 
            ? { ...apt, status: "CANCELLED" }
            : apt
        )
      )
    } catch (err) {
      alert("خطا در لغو نوبت")
    }
  }

  if (!mounted) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t("navigation.appointments")}</h1>
        <p className="text-muted-foreground">مشاهده و مدیریت نوبت‌های شما</p>
      </div>

      {/* Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">{t("appointment.upcoming")}</TabsTrigger>
          <TabsTrigger value="past">{t("appointment.past")}</TabsTrigger>
          <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Appointments List */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">{t("calendar.noAppointments")}</p>
            <Button className="mt-4">
              <Link href="/fa">رزرو نوبت جدید</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((apt) => {
            const status = statusConfig[apt.status]
            const StatusIcon = status?.icon || AlertCircle
            const aptDate = new Date(apt.date)
            
            return (
              <Card key={apt.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Date Section */}
                    <div className={`p-4 md:w-32 flex items-center justify-center ${status?.color || 'bg-muted'}`}>
                      <div className="text-white text-center">
                        <p className="text-2xl font-bold">
                          {toPersianDigits(aptDate.getDate())}
                        </p>
                        <p className="text-sm">
                          {aptDate.toLocaleDateString("fa-IR", { month: "long" })}
                        </p>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">{apt.service.name}</h3>
                          <p className="text-muted-foreground text-sm">
                            {apt.service.organization.name}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(apt.startTime).toLocaleTimeString("fa-IR", { 
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })}
                            </span>
                            <span>{apt.service.duration} دقیقه</span>
                            <span className="font-medium text-primary">
                              {formatToman(apt.service.price)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Badge variant={status?.variant || "secondary"}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {status?.label || apt.status}
                          </Badge>

                          {!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(apt.status) && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">
                                <Link href={`/fa/organizations/${apt.service.organization.slug}/booking`}>
                                  {t("appointment.reschedule")}
                                </Link>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleCancel(apt.id)}
                              >
                                {t("appointment.cancel")}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {apt.notes && (
                        <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                          <strong>یادداشت:</strong> {apt.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
