"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Save, Loader2, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { formatToman, toPersianDigits } from "@/lib/persian"
import { useDashboardAccess } from "@/hooks/use-auth"

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

const statusConfig: Record<string, { label: string; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "در انتظار", color: "bg-yellow-500", variant: "default" },
  CONFIRMED: { label: "تأیید شده", color: "bg-blue-500", variant: "default" },
  COMPLETED: { label: "تکمیل شده", color: "bg-green-500", variant: "secondary" },
  CANCELLED: { label: "لغو شده", color: "bg-red-500", variant: "destructive" },
  NO_SHOW: { label: "عدم حضور", color: "bg-gray-500", variant: "secondary" },
}

export default function AppointmentDetailPage({ 
  params 
}: { 
  params: Promise<{ locale: string; id: string }> 
}) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  const appointmentId = resolvedParams.id
  const router = useRouter()
  
  const { hasAccess, isLoading: accessLoading } = useDashboardAccess()
  
  const [mounted, setMounted] = useState(false)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [appointment, setAppointment] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  // Fetch appointment
  useEffect(() => {
    if (!hasAccess || accessLoading) return
    
    setLoading(true)
    
    fetch(`/api/appointments/${appointmentId}`)
      .then(res => {
        if (!res.ok) throw new Error("Appointment not found")
        return res.json()
      })
      .then(data => {
        setAppointment(data)
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [hasAccess, accessLoading, appointmentId])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete appointment")
      }
      
      router.push(`/${locale}/dashboard/appointments`)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete appointment")
    } finally {
      setDeleting(false)
    }
  }

  if (accessLoading || !mounted) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">Access Denied</h2>
          <p className="text-muted-foreground mt-2">You do not have access to this page</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full max-w-2xl" />
      </div>
    )
  }

  if (error && !appointment) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">{t("errors.notFound")}</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
          <Link href={`/${locale}/dashboard/appointments`}>
            <Button className="mt-4">{t("common.back")}</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-muted-foreground">{t("errors.notFound")}</h2>
          <p className="text-muted-foreground mt-2">Appointment not found</p>
          <Link href={`/${locale}/dashboard/appointments`}>
            <Button className="mt-4">{t("common.back")}</Button>
          </Link>
        </div>
      </div>
    )
  }

  const status = statusConfig[appointment.status] || statusConfig.PENDING
  const aptDate = new Date(appointment.date)
  const customerName = appointment.customer.firstName && appointment.customer.lastName 
    ? `${appointment.customer.firstName} ${appointment.customer.lastName}`
    : appointment.customer.name
  const staffName = appointment.service.serviceProvider 
    ? `${appointment.service.serviceProvider.firstName} ${appointment.service.serviceProvider.lastName}`
    : "—"

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href={`/${locale}/dashboard/appointments`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{t("appointment.details") || "Appointment Details"}</h2>
            <p className="text-muted-foreground">
              {appointment.service.name} - {customerName}
            </p>
          </div>
        </div>
        
        <Button 
          variant="destructive" 
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 ml-2" />
          {t("common.delete") || "Delete"}
        </Button>
      </div>

      {/* Appointment Details */}
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>{t("appointment.information") || "Appointment Information"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date & Time */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{t("appointment.date") || "Date & Time"}</h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {aptDate.toLocaleDateString("fa-IR", { 
                      year: "numeric", 
                      month: "long", 
                      day: "numeric",
                      weekday: "long"
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(appointment.startTime).toLocaleTimeString("fa-IR", { 
                      hour: "2-digit", 
                      minute: "2-digit" 
                    })} - 
                    {new Date(appointment.endTime).toLocaleTimeString("fa-IR", { 
                      hour: "2-digit", 
                      minute: "2-digit" 
                    })}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-lg font-semibold mb-2">{t("common.status") || "Status"}</h3>
                <Badge variant={status.variant} className="text-sm px-3 py-1">
                  {status.label}
                </Badge>
              </div>
            </div>

            {/* Service & Customer */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">{t("service.title") || "Service"}</h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{appointment.service.name}</p>
                  <p className="text-muted-foreground">{appointment.service.category.name}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">{t("appointment.customerInfo") || "Customer"}</h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{customerName}</p>
                  {appointment.customer.phone && (
                    <p className="text-muted-foreground">{appointment.customer.phone}</p>
                  )}
                  {appointment.customer.email && (
                    <p className="text-muted-foreground">{appointment.customer.email}</p>
                  )}
                </div>
              </div>

              {/* Service Provider */}
              <div>
                <h3 className="text-lg font-semibold mb-2">{t("appointment.provider") || "Service Provider"}</h3>
                <p className="text-sm">{staffName}</p>
              </div>
            </div>
          </div>

          {/* Price & Duration */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">
                {t("appointment.price") || "Price"}
              </div>
              <div className="text-2xl font-bold text-primary">
                {formatToman(appointment.service.price)}
              </div>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {t("appointment.duration") || "Duration"}: {toPersianDigits(appointment.service.duration)} {t("appointment.minutes") || "minutes"}
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-2">{t("appointment.notes") || "Notes"}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {appointment.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="border-t pt-6 flex gap-3">
            <Button 
              variant="outline"
              onClick={() => router.back()}
            >
              {t("common.back") || "Back"}
            </Button>
            <Button 
              onClick={() => router.push(`/${locale}/dashboard/appointments/${appointment.id}/edit`)}
            >
              <Save className="h-4 w-4 ml-2" />
              {t("common.edit") || "Edit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete") || "Delete Appointment"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this appointment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? t("common.loading") || "Deleting..." : t("common.delete") || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}