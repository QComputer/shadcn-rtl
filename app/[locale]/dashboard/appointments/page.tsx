"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
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
import { getDictionary, getDictValue } from "@/lib/dictionary"

interface Appointment {
  id: string
  customerName: string
  customerPhone: string
  serviceName: string
  staffName?: string
  date: Date
  startTime: string
  endTime: string
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED"
  notes?: string
}

// Persian number helper
function toPersianDigits(str: string | number): string {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str)
    .split("")
    .map((char) => (/\d/.test(char) ? persianDigits[parseInt(char)] : char))
    .join("");
}

const sampleAppointments: Appointment[] = [
  { id: "1", customerName: "علی محمدی", customerPhone: "۰۹۱۲۳۴۵۶۷۸۹", serviceName: "مشاوره طراحی", staffName: "سارا احمدی", date: new Date(), startTime: "۱۰:۰۰", endTime: "۱۱:۰۰", status: "PENDING", notes: "مشاوره اولیه" },
  { id: "2", customerName: "سارا احمدی", customerPhone: "۰۹۱۲۳۴۵۶۷۸۸", serviceName: "طراحی لوگو", staffName: "محمد رضایی", date: new Date(Date.now() + 86400000), startTime: "۱۴:۰۰", endTime: "۱۶:۰۰", status: "CONFIRMED" },
  { id: "3", customerName: "مریم کاظمی", customerPhone: "۰۹۱۲۳۴۵۶۷۸۶", serviceName: "توسعه وب", staffName: "احمد حسنی", date: new Date(Date.now() + 172800000), startTime: "۰۹:۰۰", endTime: "۱۳:۰۰", status: "PENDING" },
  { id: "4", customerName: "احمد حسنی", customerPhone: "۰۹۱۲۳۴۵۶۷۸۵", serviceName: "مشاوره سئو", date: new Date(Date.now() - 86400000), startTime: "۱۱:۰۰", endTime: "۱۲:۰۰", status: "COMPLETED", notes: "جلسه موفق" },
  { id: "5", customerName: "زهرا علوی", customerPhone: "۰۹۱۲۳۴۵۶۷۸۴", serviceName: "طراحی گرافیک", date: new Date(Date.now() - 172800000), startTime: "۱۵:۰۰", endTime: "۱۷:۰۰", status: "CANCELLED", notes: "کنسل شده توسط مشتری" },
]

const statusConfig: Record<string, { label: string; icon: any; color: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "در انتظار", icon: AlertCircle, color: "bg-yellow-500", variant: "default" },
  CONFIRMED: { label: "تأیید شده", icon: CheckCircle, color: "bg-blue-500", variant: "default" },
  COMPLETED: { label: "تکمیل شده", icon: CheckCircle, color: "bg-green-500", variant: "secondary" },
  CANCELLED: { label: "لغو شده", icon: XCircle, color: "bg-red-500", variant: "destructive" },
}

export default function AppointmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params)
  const locale = resolvedParams.locale || "fa"
  
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [appointments] = useState<Appointment[]>(sampleAppointments)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)

  useEffect(() => {
    setMounted(true)
    import("@/lib/dictionary").then(({ getDictionary }) => {
      setDict(getDictionary(locale))
    })
  }, [locale])

  const t = (key: string): string => {
    if (!dict) return key
    return getDictValue(dict, key)
  }

  const filteredAppointments = appointments.filter(apt => {
    const matchesSearch = apt.customerName.includes(searchQuery) || 
                         apt.serviceName.includes(searchQuery) ||
                         apt.customerPhone.includes(searchQuery)
    const matchesStatus = statusFilter === "all" || apt.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (!mounted) {
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

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredAppointments.map((apt) => {
          const status = statusConfig[apt.status]
          const StatusIcon = status.icon
          
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
                        {apt.date.toLocaleDateString("fa-IR", { 
                          year: "numeric", 
                          month: "long", 
                          day: "numeric",
                          weekday: "long"
                        })}
                      </p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{apt.startTime} - {apt.endTime}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Service Info */}
                  <div className="flex-1">
                    <p className="font-bold">{apt.customerName}</p>
                    <p className="text-sm text-muted-foreground">{apt.customerPhone}</p>
                    <p className="text-sm">{apt.serviceName}</p>
                    {apt.staffName && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{apt.staffName}</span>
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
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive">
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

      {/* Empty State */}
      {filteredAppointments.length === 0 && (
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
    </div>
  )
}
