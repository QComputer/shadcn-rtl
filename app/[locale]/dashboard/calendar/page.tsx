"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  ChevronRight,
  ChevronLeft,
  User as UserIcon,
  CheckCircle,
  AlertCircle,
  XCircle,
  Filter,
  Grid,
  List,
  ClockPlusIcon,
  ClockCheck
} from "lucide-react"

//import FullCalendar from "@fullcalendar/react";
//import dayGridPlugin from "@fullcalendar/daygrid";
//import timeGridPlugin from "@fullcalendar/timegrid";
//import interactionPlugin from "@fullcalendar/interaction";
//import faLocale from "@fullcalendar/core/locales/fa";
import dayjs from "dayjs";
import jalaliday from "jalaliday";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
import { BusinessHour, OrganizationMember, Service, User } from "@prisma/client";
import { useAuth } from "@/hooks/use-auth";
import { toJalali } from "@/lib/jalali-adapter";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { AppointmentBooker } from "@/components/appointment/book";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";


export interface TimeInterval {
  index: number
  providerUserId: string
  hour: number
  minute: number
  startTime?: string | null
  appointment?: Appointment|null
}

interface Appointment {
  id: string
  date: string
  startTime: string
  endTime: string
  status: string
  notes: string | null
  startIndex: number | null
  endIndex: number | null
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

interface Provider{
  id: string
  firstName: string
  lastName: string
  providedServices: Service[]
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


dayjs.extend(jalaliday);

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
  const [membersData, setMembersData] = useState<any[]>([])
  const [businessHourss, setBusinessHourss] = useState<BusinessHour|null>(null)
  const [organizationBusinessHourss, setOrganizationBusinessHourss] = useState<BusinessHour|null>(null)
  const [timeIntervals, setTimeIntervals] = useState<TimeInterval[]>([])
  const [timeIntervals_s, setTimeIntervals_s] = useState<TimeInterval[][]>([])
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<ReturnType<typeof getDictionary> | null>(null)
  const [view, setView] = useState<"day" | "week">("day")
  const [viewCalendar, setViewCalendar] = useState<"grid" | "list">("list")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [selectedTimeInterval, setSelectedTimeInterval] = useState<TimeInterval | null>(null)
  const [minutScale, setMinutScale] = useState<number>(5)
  
  const { user, organizationMembership } = useAuth()
  
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<Provider|null>(null)
  const [selectedProviderUserId, setSelectedProviderUserId] = useState<string | null>(null)
  const [isMultiProviders, setIsMultiProviders] = useState(false)
  
  // Booking result
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
    useEffect(() => {
      setMembersData(membersData)
  }, [selectedDate])

  function updateMembers(membersData: any[]) {
    // pars data
    const _providers: Provider[]=[]
    membersData.map((item)=>{
      _providers.push(item.user)
    })
    setProviders(_providers)
    // setDayTimeIntervals
    if (_providers.length>1 ) {
      setIsMultiProviders(true)
      setDayTimeIntervalsForAllProviders(_providers)
    } else if (_providers.length == 1) {
      setIsMultiProviders(false)
      setSelectedProviderUserId(_providers[0].id)
      setDayTimeIntervalsForOneProvider(_providers[0].id)
      setDayTimeIntervalsForAllProviders(_providers)
    } else {
      setIsMultiProviders(false)
      setSelectedProviderUserId(user?.id || null)
      user?.id && setDayTimeIntervalsForOneProvider(user.id)
    }
    return _providers
  }
  useEffect(() => {
      updateMembers(membersData)
  }, [membersData, selectedDate])



  useEffect(() => {
    //console.log("-------->organizationMembership:", organizationMembership);

    // fetch members
    organizationMembership &&
    fetch(`/api/organizations/${organizationMembership.organizationId}/members`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch members ")
        return res.json()
      })
      .then(data => {
        setMembersData(data || [])
      })
      .catch(err => {
        setError(err.message)
        setLoading(false) 
    })  
  }, [organizationMembership])

  useEffect(() => {
    if (selectedProviderUserId == 'all') {
      setDayTimeIntervalsForAllProviders(providers)
      setSelectedProvider(null) 
    } else if (selectedProviderUserId){
      setDayTimeIntervalsForOneProvider(selectedProviderUserId)
      const provider = providers.find(p=> {return p.id == selectedProviderUserId} )
      provider && setSelectedProvider(provider)
    } else {
      setSelectedProvider(null) 
    }
  }, [selectedProviderUserId])

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
    const aptJalaliStartTime = toJalali(new Date(apt.startTime))
    const selectedJalali = toJalali(new Date(selectedDate))
    let _return: boolean = (aptJalaliStartTime.year() === selectedJalali.year() && aptJalaliStartTime.date() === selectedJalali.date() && aptJalaliStartTime.month() === selectedJalali.month())
    if (_return)  {
      apt.startIndex = getIndexFromJalali(aptJalaliStartTime)
      apt.endIndex =  getJalaliIndex(apt.endTime)
      if (apt.service.serviceProvider?.id) { 
        if (selectedProviderUserId && selectedProviderUserId!='all') { 
          _return = _return && (selectedProviderUserId == apt.service.serviceProvider.id)
          _return //&& console.log(`~~~~~~~~~~~Filter appointment for today and selectedProviderUserId=${selectedProviderUserId}~~~~~~~`, apt);
        }
      } else {
        _return = false
      }
    }
    return _return
  })
  function getJalaliIndex(time: string) {
    const jalalidate = toJalali(new Date(time))
    const index = jalalidate.hour() * 12 + (Math.floor(jalalidate.minute()/5)) 
    return index
  }
  function getIndexFromJalali(time: any) {
    const index = time.hour() * 12 + (Math.floor(time.minute()/5)) 
    return index
  }


  // TODO: it is not efficient at all
  function getTimeIntervalAppointment (timeInterval: TimeInterval, dayAppointments: Appointment[]){
      const _dayAppointments = dayAppointments.filter(apt => apt.service.serviceProvider?.id === timeInterval.providerUserId)
      for (let index = 0; index < _dayAppointments.length; index++) {
        const apt = _dayAppointments[index];
        if (apt.startIndex && apt.endIndex) {
          if (apt.startIndex <= timeInterval.index && apt.endIndex >= timeInterval.index) return apt
        } else  {
          console.error("appointment is not indexed");
          return null
        }
      }
      return null
    }


  function setDayTimeIntervalsForOneProvider(userId: string) {
    const _dayAppointments = dayAppointments.filter(apt => {
      return apt.service.serviceProvider?.id === userId
    });
    //console.log(`dayAppointments for userId=${userId} : `, _dayAppointments);
    
    const arr: TimeInterval[] = []
    for (let index = 0; index < 12 * 24; index++) {
      const hour = Math.floor(index/12)
      const minute = (index % 12) * 5

      let timeInterval: TimeInterval = {index, hour, minute,  providerUserId: userId}
      timeInterval.appointment = getTimeIntervalAppointment(timeInterval, _dayAppointments)
      
      timeInterval.appointment && //console.log("timeInterval:" , timeInterval);
      arr.push(timeInterval);
    }

    setTimeIntervals(arr)
    return arr
  }
  
  function setDayTimeIntervalsForAllProviders(providers: any[]) {
    const _dayAppointments = dayAppointments;
    //console.log("dayAppointments", _dayAppointments);
    
    const arrs: TimeInterval[][] = []
    providers.map((p)=>{
      arrs.push(setDayTimeIntervalsForOneProvider(p.id))
    })
    setTimeIntervals_s(arrs)
    return arrs
  }

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

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold pb-2">تقویم نوبت‌ها</h1>
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
            <div className="text-xs px-4 py-2 bg-muted rounded-lg font-medium min-w-[100px] text-center">
              {viewCalendar=='grid'? formatPersianDate(selectedDate, "full") : formatPersianDate(selectedDate, "short")}
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
              className="text-xs"
              onClick={() => setSelectedDate(new Date())}
            >
              {t("calendar.today")}
            </Button>
            
          </div>
          <div className="flex items-center gap-2 w-50 p-2">
          <Select value={selectedProviderUserId || undefined} onValueChange={setSelectedProviderUserId} required>
            <SelectTrigger>
              <SelectValue placeholder={"انتخاب سرویس دهنده"} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem key={"all"} value={"all"}>
                  {"همه سرویس دهندگان"}
                </SelectItem>
              {providers.map(member => (
                <SelectItem key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button 
            className={"transition-shadow cursor-pointer"}
              variant={viewCalendar=="grid"? "secondary" : "outline"}
              onClick={() => setViewCalendar('grid')}
            >
              <Grid/>
            </Button>
            <Button 
            className={"transition-shadow cursor-pointer"}
              variant={viewCalendar=="list"? "secondary" : "outline"}
              onClick={() => setViewCalendar('list')}
            >
              <List/>
            </Button>
          </div>
          

        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-3">
              <div className="text-lg font-bold">{toPersianDigits(dayAppointments.length)}</div>
              <p className="text-sm text-muted-foreground">مجموع نوبت‌ها</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3">
              <div className="text-lg font-bold text-yellow-600">
                {toPersianDigits(dayAppointments.filter(a => a.status === "PENDING").length)}
              </div>
              <p className="text-sm text-muted-foreground">در انتظار</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3">
              <div className="text-lg font-bold text-green-600">
                {toPersianDigits(dayAppointments.filter(a => a.status === "CONFIRMED").length)}
              </div>
              <p className="text-sm text-muted-foreground">تأیید شده</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-3">
              <div className="text-lg font-bold text-blue-600">
                {toPersianDigits(dayAppointments.filter(a => a.status === "COMPLETED").length)}
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
        ) : (
          <div className={viewCalendar=='list'
          ? "grid grid-rows max-w-100"
          : "grid grid-cols-4 md:grid-cols-8 gap-4 mb-6"}>
              {timeIntervals
              .map((timeInterval) => {
                const apt = timeInterval.appointment;
                if (apt?.startIndex === timeInterval.index) {
                  const status = statusConfig[apt.status]
                  const StatusIcon = status?.icon || AlertCircle
                  return (
                    <Card 
                    key={apt.id} 
                    className={viewCalendar=='list'
                      ? "hover:shadow-md transition-shadow cursor-pointer rounded-none"
                      : `${status.color} hover:shadow-md transition-shadow cursor-pointer`
                    }
                    onClick={() => setSelectedAppointment(apt)}
                  >
                    {viewCalendar=='list' 
                    ? 
                    <CardContent className="">
                      <div className="flex flex-row items-center justify-between gap-4 ">
                        {/* Time */}
                        <div className="flex items-center gap-4 min-w-[150px]">
                          <div className={`p-2 rounded-lg ${status?.color || 'bg-muted'}`}>
                            <Clock className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-bold">
                              {new Date(apt.startTime).toLocaleTimeString("fa-IR", { 
                                hour: "2-digit", 
                                minute: "2-digit" 
                              })}
                            </p>
                           
                            <p className="text-xs text-muted-foreground">
                              {apt.service.duration} دقیقه
                            </p>
                          </div>
                        </div>

                        {/* Service & Customer */}
                        <div className="flex-1">
                          <h3 className="font-semibold pb-1 px-4">{apt.service.name}</h3>
                          <div className="text-xs flex items-center gap-2 text-muted-foreground">
                            <UserIcon className="h-3 w-3" />
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
                        <div className="hidden md:inline flex items-center gap-3">
                          <Badge variant={status?.variant || "secondary"}>
                            <StatusIcon className="h-3 w-3 ml-1" />
                            {status?.label || apt.status}
                          </Badge>
                        </div>
                      </div>

                      {apt.notes && (
                        <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                          <strong>یادداشت:</strong> {apt.notes}
                        </p>
                      )}
                    </CardContent>
                    : 
                    <CardContent className="">
                        <p className="text-xs ">
                           <ClockCheck/>
                        </p>      
                        <p className="text-xs mt-3">
                          {timeInterval.hour+":"+timeInterval.minute}
                        </p>             
                      </CardContent>
                    }
                    </Card>
                  )
                } else if (apt?.endIndex && apt?.endIndex > timeInterval.index) {
                  return null
                } else if ((timeInterval.minute == 0 || timeInterval.minute==30) && timeInterval.hour>=0 && timeInterval.hour<=15 ) {
                  return (
                    <Card
                      key={`${timeInterval.hour}:${timeInterval.minute}`}
                      className={viewCalendar=='list'
                      ? "hover:shadow-md transition-shadow cursor-pointer rounded-none bg-bg h-5 pb-10 pt-2"
                      : `hover:shadow-md transition-shadow cursor-pointer h-20 items-center grid grid-cols-2`
                    }
                      onClick={() => setSelectedTimeInterval(timeInterval)}
                    >
                      <CardContent className="">
                        { viewCalendar=='grid' && 
                           <ClockPlusIcon/>
                          }    
                        <p className="text-xs text-muted-foreground">
                          {timeInterval.hour+":"+timeInterval.minute}
                        </p>             
                      </CardContent>
                    </Card>
                  )
                }
              })}
          </div>
        )}

        {/* Appointment/TimeInterval Details Dialog */}
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
        <Dialog open={!!selectedTimeInterval} onOpenChange={() => setSelectedTimeInterval(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ثبت نوبت</DialogTitle>
            </DialogHeader>
            {selectedTimeInterval && 
              <Card>
                {/* Status */}
                <CardContent className="space-y-2">
                  <Label htmlFor="status">
                    {"سرویس"} *
                  </Label>
              <Select value={selectedServiceId||undefined} onValueChange={setSelectedServiceId} required>
                <SelectTrigger>
                  <SelectValue placeholder={"انتخاب سرویس"} />
                </SelectTrigger>
                <SelectContent>
                  {selectedProvider?.providedServices?.map(service => (
                    <SelectItem key={service.name} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </CardContent>
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
            }
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
