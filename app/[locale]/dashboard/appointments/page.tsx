"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { useDashboardAccess } from "@/hooks/use-auth"
import { toPersianDigits } from "@/lib/persian"

interface Appointment {
  id: string
  date: string
  startTime: string
  endTime: string
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
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
    organization: {
      id: string
      name: string
      slug: string
    }
  }
  customer: {
    id: string
    name: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
  }
}

const statusConfig: Record<string, { label: string; icon: any; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "در انتظار", icon: AlertCircle, color: "bg-yellow-500", variant: "default" },
  CONFIRMED: { label: "تأیید شده", icon: CheckCircle, color: "bg-blue-500", variant: "default" },
  COMPLETED: { label: "تکمیل شده", icon: CheckCircle, color: "bg-green-500", variant: "secondary" },
  CANCELLED: { label: "لغو شده", icon: XCircle, color: "bg-red-500", variant: "destructive" },
}

export default function AppointmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  // Access control check
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch appointments from API
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    fetch("/api/appointments")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch appointments")
        return res.json()
      })
      .then(data => {
        setAppointments(data.data || [])
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        setAppointments([])
      })
      .finally(() => setLoading(false))
  }, [hasAccess, accessLoading])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  // Delete appointment handler
  const handleDelete = async () => {
    if (!appointmentToDelete) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/appointments/${appointmentToDelete.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete appointment")
      }

      // Remove from local state
      setAppointments(prev => prev.filter(apt => apt.id !== appointmentToDelete.id))
      setDeleteDialogOpen(false)
      setAppointmentToDelete(null)
    } catch (error) {
      console.error("Error deleting appointment:", error)
      setError("Failed to delete appointment")
    } finally {
      setDeleting(false)
    }
  }

  // Get customer display name
  const getCustomerName = (apt: Appointment) => {
    if (apt.customer.firstName && apt.customer.lastName) {
      return `${apt.customer.firstName} ${apt.customer.lastName}`
    }
    return apt.customer.name
  }

  // Get staff display name
  const getStaffName = (apt: Appointment) => {
    if (apt.service.serviceProvider) {
      return `${apt.service.serviceProvider.firstName} ${apt.service.serviceProvider.lastName}`
    }
    return undefined
  }

  const filteredAppointments = appointments.filter(apt => {
    const customerName = getCustomerName(apt)
    const matchesSearch = customerName.includes(searchQuery) || 
                         apt.service.name.includes(searchQuery) ||
                         (apt.customer.phone?.includes(searchQuery) ?? false)
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Show loading state while checking access
  if (accessLoading || !mounted) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 bg-muted rounded w-1/4" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded" />
          ))}
        </div>
      </div>
    )
  }

  // Show access denied message if no access
  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">دسترسی محدود</h2>
          <p className="text-muted-foreground mt-2">شما دسترسی به این صفحه را ندارید</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t("navigation.appointments") || "نوبت‌ها"}</h2>
          <p className="text-muted-foreground">
            {toPersianDigits(appointments.length.toString())} {t("navigation.appointments") || "نوبت"}
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 ml-2" />
          {t("appointment.book") || "رزرو نوبت"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") || "جستجو..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant={statusFilter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            {t("common.all") || "همه"}
          </Button>
          <Button 
            variant={statusFilter === "PENDING" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("PENDING")}
          >
            {statusConfig.PENDING.label}
          </Button>
          <Button 
            variant={statusFilter === "CONFIRMED" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("CONFIRMED")}
          >
            {statusConfig.CONFIRMED.label}
          </Button>
          <Button 
            variant={statusFilter === "COMPLETED" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("COMPLETED")}
          >
            {statusConfig.COMPLETED.label}
          </Button>
          <Button 
            variant={statusFilter === "CANCELLED" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("CANCELLED")}
          >
            {statusConfig.CANCELLED.label}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => {
              setLoading(true)
              fetch("/api/appointments")
                .then(res => res.json())
                .then(data => {
                  setAppointments(data.data || [])
                  setError(null)
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false))
            }}>
              تلاش مجدد
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Appointments List */}
      {!loading && !error && (
        <div className="space-y-4">
          {filteredAppointments.map((apt) => {
            const status = statusConfig[apt.status] || statusConfig.PENDING
            const StatusIcon = status.icon
            const customerName = getCustomerName(apt)
            const staffName = getStaffName(apt)
            const aptDate = new Date(apt.date)
            
            return (
              <Card key={apt.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Date & Time */}
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${status.color}`}>
                        <Calendar className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">
                          {aptDate.toLocaleDateString("fa-IR", { 
                            year: "numeric", 
                            month: "long", 
                            day: "numeric",
                            weekday: "long"
                          })}
                        </p>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {new Date(apt.startTime).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })} - 
                            {new Date(apt.endTime).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Customer & Service Info */}
                    <div className="flex-1">
                      <p className="font-bold">{customerName}</p>
                      <p className="text-sm text-muted-foreground">{apt.customer.phone || "-"}</p>
                      <p className="text-sm">{apt.service.name}</p>
                      {staffName && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{staffName}</span>
                        </div>
                      )}
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-4">
                      <Badge variant={status.variant}>
                        <StatusIcon className="h-3 w-3 ml-1" />
                        {status.label}
                      </Badge>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => router.push(`/${locale}/dashboard/appointments/${apt.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => router.push(`/${locale}/dashboard/appointments/${apt.id}/edit`)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => {
                            setAppointmentToDelete(apt)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {apt.notes && (
                    <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                      {apt.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredAppointments.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">{t("common.no_results") || "نوبتی یافت نشد"}</p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("common.showing") || "نمایش"} {toPersianDigits("1")} - {toPersianDigits(filteredAppointments.length.toString())} {t("common.of") || "از"} {toPersianDigits(appointments.length.toString())}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("appointment.delete_title") || "Delete Appointment"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("appointment.delete_description") || "Are you sure you want to delete this appointment? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? (t("common.deleting") || "Deleting...") : (t("common.delete") || "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
