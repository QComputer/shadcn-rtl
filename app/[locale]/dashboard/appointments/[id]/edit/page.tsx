"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Save, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDictionary, getDictValue } from "@/lib/dictionary"
import { useDashboardAccess } from "@/hooks/use-auth"

interface Appointment {
  id: string
  date: string
  startTime: string
  endTime: string
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  notes?: string
  cancellationReason?: string
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

const statusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No Show" },
]

export default function EditAppointmentPage({ 
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [status, setStatus] = useState<string>("PENDING")
  const [notes, setNotes] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')

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
        setStatus(data.status)
        setNotes(data.notes)
        setCancellationReason(data.cancellationReason)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setSaving(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes: notes || undefined,
          cancellationReason: cancellationReason || undefined,
        }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update appointment")
      }
      
      // Redirect to appointment detail page
      router.push(`/${locale}/dashboard/appointments/${appointmentId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update appointment")
    } finally {
      setSaving(false)
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

  const customerName = appointment.customer.firstName && appointment.customer.lastName 
    ? `${appointment.customer.firstName} ${appointment.customer.lastName}`
    : appointment.customer.name
  const staffName = appointment.service.serviceProvider 
    ? `${appointment.service.serviceProvider.firstName} ${appointment.service.serviceProvider.lastName}`
    : "—"
  const aptDate = new Date(appointment.date)

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href={`/${locale}/dashboard/appointments/${appointmentId}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-5 w-5 rotate-180" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{t("appointment.edit") || "Edit Appointment"}</h2>
            <p className="text-muted-foreground">
              {appointment.service.name} - {customerName}
            </p>
          </div>
        </div>
      </div>

      {/* Appointment Details (Read-only) */}
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
                  <h3 className="text-lg font-semibold mb-2">{t("customer.title") || "Customer"}</h3>
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
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("appointment.edit_details") || "Edit Details"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
            
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">
                {t("common.status") || "Status"} *
              </Label>
              <Select value={status} onValueChange={setStatus} required>
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select_status") || "Select status"} />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {t("appointment.notes") || "Notes"}
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("appointment.notes_placeholder") || "Add notes..."}
                rows={3}
              />
            </div>
            
            {/* Cancellation Reason (only if status is cancelled) */}
            {status === "CANCELLED" && (
              <div className="space-y-2">
                <Label htmlFor="cancellationReason">
                  {t("appointment.cancellation_reason") || "Cancellation Reason"}
                </Label>
                <Textarea
                  id="cancellationReason"
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder={t("appointment.cancellation_placeholder") || "Enter cancellation reason..."}
                  rows={2}
                />
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    {t("common.saving") || "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 ml-2" />
                    {t("common.save") || "Save"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}