"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import faLocale from "@fullcalendar/core/locales/fa";
import arLocale from "@fullcalendar/core/locales/ar";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Clock,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

type AppointmentCustomer = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
} | null;

type AppointmentService = {
  id: string;
  name: string;
  duration: number;
  price?: number | string | null;
  category?: { id?: string; name?: string | null } | null;
  organization?: { id?: string; name?: string | null; slug?: string | null } | null;
  serviceProvider?: {
    id: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type Appointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string | null;
  bookingReference?: string | null;
  customerNameAtBooking?: string | null;
  customerPhoneAtBooking?: string | null;
  service: AppointmentService;
  customer?: AppointmentCustomer;
  guestCustomer?: AppointmentCustomer;
};

type CalendarMember = {
  id: string;
  userId?: string;
  role?: string;
  user?: {
    id: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
};

type CalendarService = {
  id: string;
  name: string;
  duration: number;
  serviceProviderId?: string | null;
  category?: { name?: string | null } | null;
};

type MembershipResponse = {
  membership?: {
    organizationId: string;
    organizationSlug?: string;
    role?: string;
  } | null;
  memberships?: Array<{
    organizationId: string;
    organizationSlug?: string;
    role?: string;
  }>;
};

const STATUS_CONFIG: Record<AppointmentStatus, {
  label: string;
  className: string;
  dotClassName: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
}> = {
  PENDING: {
    label: "در انتظار",
    className: "border-amber-300 bg-amber-50 text-amber-900",
    dotClassName: "bg-amber-500",
    badgeVariant: "outline",
  },
  CONFIRMED: {
    label: "تأیید شده",
    className: "border-blue-300 bg-blue-50 text-blue-900",
    dotClassName: "bg-blue-500",
    badgeVariant: "default",
  },
  COMPLETED: {
    label: "تکمیل شده",
    className: "border-emerald-300 bg-emerald-50 text-emerald-900",
    dotClassName: "bg-emerald-500",
    badgeVariant: "secondary",
  },
  CANCELLED: {
    label: "لغو شده",
    className: "border-red-300 bg-red-50 text-red-900",
    dotClassName: "bg-red-500",
    badgeVariant: "destructive",
  },
  NO_SHOW: {
    label: "عدم حضور",
    className: "border-slate-300 bg-slate-50 text-slate-900",
    dotClassName: "bg-slate-500",
    badgeVariant: "secondary",
  },
};

const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function appointmentCustomerName(appointment: Appointment) {
  const customer = appointment.customer || appointment.guestCustomer;
  const composed = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim();
  return composed || customer?.name || appointment.customerNameAtBooking || "مشتری";
}

function appointmentCustomerPhone(appointment: Appointment) {
  return appointment.customer?.phone || appointment.guestCustomer?.phone || appointment.customerPhoneAtBooking || "—";
}

function providerName(member: CalendarMember) {
  const user = member.user;
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.name || "عضو تیم";
}

function serviceProviderName(service?: AppointmentService | CalendarService | null) {
  const provider = "serviceProvider" in (service || {}) ? (service as AppointmentService).serviceProvider : null;
  return [provider?.firstName, provider?.lastName].filter(Boolean).join(" ").trim() || provider?.name || "بدون سرویس‌دهنده";
}

function getCalendarLocale(locale: string) {
  if (locale === "fa") return faLocale;
  if (locale === "ar") return arLocale;
  return undefined;
}

function getStatusFromEvent(event: { extendedProps?: Record<string, unknown> }) {
  return (event.extendedProps?.status as AppointmentStatus | undefined) || "PENDING";
}

export function AppointmentFullCalendar({
  locale,
  title = "تقویم نوبت‌ها",
  description = "نمایش ماهانه، هفتگی و روزانه نوبت‌ها بر اساس سرویس‌دهنده و وضعیت",
}: {
  locale: string;
  title?: string;
  description?: string;
}) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [members, setMembers] = useState<CalendarMember[]>([]);
  const [services, setServices] = useState<CalendarService[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AppointmentStatus | "ALL">("ALL");
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [selectedService, setSelectedService] = useState<string>("ALL");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [calendarTitle, setCalendarTitle] = useState("");
  const [currentView, setCurrentView] = useState<CalendarView>("timeGridWeek");
  const [currentRange, setCurrentRange] = useState<{ start: Date; end: Date }>(() => {
    const today = new Date();
    return { start: addDays(today, -14), end: addDays(today, 45) };
  });

  const direction = locale === "fa" || locale === "ar" ? "rtl" : "ltr";

  const loadOrganizationContext = useCallback(async () => {
    const res = await fetch("/api/users/me/membership", { cache: "no-store" });
    if (!res.ok) throw new Error("دریافت عضویت سازمانی ناموفق بود");
    const data = (await res.json()) as MembershipResponse;
    const membership = data.membership || data.memberships?.[0] || null;
    if (!membership?.organizationId) throw new Error("عضویت سازمانی فعال یافت نشد");
    setOrganizationId(membership.organizationId);
    return membership.organizationId;
  }, []);

  const loadMembers = useCallback(async (orgId: string) => {
    const res = await fetch(`/api/organizations/${orgId}/members`, { cache: "no-store" });
    if (!res.ok) throw new Error("دریافت سرویس‌دهندگان ناموفق بود");
    const data = await res.json();
    setMembers(Array.isArray(data) ? data : []);
  }, []);

  const loadServices = useCallback(async (orgId: string) => {
    const params = new URLSearchParams({ organizationId: orgId, pageSize: "200", isActive: "true" });
    const res = await fetch(`/api/services?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("دریافت سرویس‌ها ناموفق بود");
    const data = await res.json();
    setServices(Array.isArray(data?.data) ? data.data : []);
  }, []);

  const loadAppointments = useCallback(async (range = currentRange) => {
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        fromDate: range.start.toISOString(),
        toDate: range.end.toISOString(),
        pageSize: "500",
      });
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedProvider !== "ALL") params.set("serviceProviderId", selectedProvider);
      if (organizationId) params.set("organizationId", organizationId);

      const res = await fetch(`/api/appointments?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "دریافت نوبت‌ها ناموفق بود");
      }
      const data = await res.json();
      const rows = Array.isArray(data?.data) ? data.data : [];
      setAppointments(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای نامشخص");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentRange, organizationId, selectedProvider, selectedStatus]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const orgId = await loadOrganizationContext();
        if (!alive) return;
        await Promise.all([loadMembers(orgId), loadServices(orgId)]);
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "خطای بارگذاری تقویم");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [loadMembers, loadOrganizationContext, loadServices]);

  useEffect(() => {
    if (!organizationId) return;
    void loadAppointments(currentRange);
  }, [currentRange, loadAppointments, organizationId, selectedProvider, selectedStatus]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const providerId = appointment.service?.serviceProvider?.id || "";
      const serviceId = appointment.service?.id || "";
      if (selectedProvider !== "ALL" && providerId !== selectedProvider) return false;
      if (selectedService !== "ALL" && serviceId !== selectedService) return false;
      if (selectedStatus !== "ALL" && appointment.status !== selectedStatus) return false;
      return true;
    });
  }, [appointments, selectedProvider, selectedService, selectedStatus]);

  const events = useMemo(() => filteredAppointments.map((appointment) => {
    const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.PENDING;
    return {
      id: appointment.id,
      title: `${appointment.service?.name || "نوبت"} — ${appointmentCustomerName(appointment)}`,
      start: appointment.startTime,
      end: appointment.endTime,
      classNames: ["bazar-calendar-event", `bazar-calendar-event-${appointment.status.toLowerCase()}`],
      backgroundColor: "transparent",
      borderColor: "transparent",
      textColor: "inherit",
      extendedProps: {
        status: appointment.status,
        statusLabel: status.label,
        serviceName: appointment.service?.name || "نوبت",
        customerName: appointmentCustomerName(appointment),
        customerPhone: appointmentCustomerPhone(appointment),
        providerName: serviceProviderName(appointment.service),
      },
    };
  }), [filteredAppointments]);

  const stats = useMemo(() => ({
    total: filteredAppointments.length,
    pending: filteredAppointments.filter((a) => a.status === "PENDING").length,
    confirmed: filteredAppointments.filter((a) => a.status === "CONFIRMED").length,
    completed: filteredAppointments.filter((a) => a.status === "COMPLETED").length,
  }), [filteredAppointments]);

  async function updateAppointmentStatus(appointment: Appointment, status: AppointmentStatus) {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: statusNote || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "به‌روزرسانی وضعیت ناموفق بود");
      }
      setSelectedAppointment(null);
      setStatusNote("");
      await loadAppointments(currentRange);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در به‌روزرسانی نوبت");
    } finally {
      setRefreshing(false);
    }
  }

  function setView(view: CalendarView) {
    setCurrentView(view);
    calendarRef.current?.getApi().changeView(view);
  }

  return (
    <div className="space-y-6" dir={direction}>
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => calendarRef.current?.getApi().today()}>
            امروز
          </Button>
          <Button variant="outline" onClick={() => calendarRef.current?.getApi().prev()}>
            قبلی
          </Button>
          <Button variant="outline" onClick={() => calendarRef.current?.getApi().next()}>
            بعدی
          </Button>
          <Button variant="secondary" onClick={() => loadAppointments(currentRange)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            تازه‌سازی
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">کل نوبت‌ها</p>
            <p className="text-2xl font-bold">{toPersianDigits(stats.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">در انتظار</p>
            <p className="text-2xl font-bold text-amber-600">{toPersianDigits(stats.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">تأیید شده</p>
            <p className="text-2xl font-bold text-blue-600">{toPersianDigits(stats.confirmed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">تکمیل شده</p>
            <p className="text-2xl font-bold text-emerald-600">{toPersianDigits(stats.completed)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5" />
              {calendarTitle || "تقویم"}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={currentView === "dayGridMonth" ? "default" : "outline"} onClick={() => setView("dayGridMonth")}>ماه</Button>
              <Button variant={currentView === "timeGridWeek" ? "default" : "outline"} onClick={() => setView("timeGridWeek")}>هفته</Button>
              <Button variant={currentView === "timeGridDay" ? "default" : "outline"} onClick={() => setView("timeGridDay")}>روز</Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>سرویس‌دهنده</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger><SelectValue placeholder="همه سرویس‌دهندگان" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه سرویس‌دهندگان</SelectItem>
                  {members.map((member) => {
                    const id = member.user?.id || member.userId || member.id;
                    return <SelectItem key={id} value={id}>{providerName(member)}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>سرویس</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger><SelectValue placeholder="همه سرویس‌ها" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه سرویس‌ها</SelectItem>
                  {services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>وضعیت</Label>
              <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as AppointmentStatus | "ALL")}>
                <SelectTrigger><SelectValue placeholder="همه وضعیت‌ها" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                    <SelectItem key={status} value={status}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="bazar-fullcalendar rounded-xl border bg-background p-2">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={currentView}
              locale={getCalendarLocale(locale)}
              direction={direction}
              headerToolbar={false}
              height="auto"
              nowIndicator
              selectable
              allDaySlot={false}
              slotMinTime="07:00:00"
              slotMaxTime="23:00:00"
              slotDuration="00:15:00"
              eventDisplay="block"
              events={events}
              loading={(isLoading) => setLoading(isLoading)}
              datesSet={(arg) => {
                setCalendarTitle(arg.view.title);
                setCurrentRange({ start: arg.start, end: arg.end });
              }}
              eventClick={(arg) => {
                const appointment = appointments.find((item) => item.id === arg.event.id);
                if (appointment) setSelectedAppointment(appointment);
              }}
              eventContent={(arg) => {
                const status = getStatusFromEvent(arg.event);
                const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
                return (
                  <div className={`rounded-lg border px-2 py-1 text-xs shadow-sm ${config.className}`}>
                    <div className="flex items-center gap-1 font-semibold">
                      <span className={`h-2 w-2 rounded-full ${config.dotClassName}`} />
                      <span className="truncate">{arg.event.extendedProps.serviceName as string}</span>
                    </div>
                    <div className="mt-1 truncate text-[11px] opacity-85">
                      {arg.event.extendedProps.customerName as string}
                    </div>
                  </div>
                );
              }}
              select={(arg) => {
                setError(`برای ثبت نوبت جدید در ${formatPersianDate(arg.start, "short")} از صفحه نوبت‌دهی عمومی یا فرم نوبت‌ها استفاده کنید. انتخاب زمان: ${arg.start.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`);
              }}
            />
          </div>
          {loading && <p className="mt-3 text-sm text-muted-foreground">در حال بارگذاری تقویم...</p>}
        </CardContent>
      </Card>

      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>جزئیات نوبت</DialogTitle>
            <DialogDescription>
              اطلاعات مشتری، سرویس و وضعیت نوبت انتخاب‌شده
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{selectedAppointment.service.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedAppointment.service.category?.name || "بدون دسته‌بندی"}</p>
                  </div>
                  <Badge variant={STATUS_CONFIG[selectedAppointment.status]?.badgeVariant || "secondary"}>
                    {STATUS_CONFIG[selectedAppointment.status]?.label || selectedAppointment.status}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div className="flex items-center gap-2"><User className="h-4 w-4" /> {appointmentCustomerName(selectedAppointment)}</div>
                <div>{appointmentCustomerPhone(selectedAppointment)}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {new Date(selectedAppointment.startTime).toLocaleString("fa-IR")}</div>
                <div>{serviceProviderName(selectedAppointment.service)}</div>
              </div>

              {selectedAppointment.notes && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <strong>یادداشت:</strong> {selectedAppointment.notes}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="appointment-status-note">یادداشت وضعیت</Label>
                <Textarea
                  id="appointment-status-note"
                  value={statusNote}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="در صورت نیاز، توضیح کوتاه ثبت کنید..."
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-4">
                {STATUS_TRANSITIONS[selectedAppointment.status].includes("CONFIRMED") && (
                  <Button onClick={() => updateAppointmentStatus(selectedAppointment, "CONFIRMED")} disabled={refreshing}>
                    <CheckCircle className="h-4 w-4" /> تأیید
                  </Button>
                )}
                {STATUS_TRANSITIONS[selectedAppointment.status].includes("COMPLETED") && (
                  <Button variant="secondary" onClick={() => updateAppointmentStatus(selectedAppointment, "COMPLETED")} disabled={refreshing}>
                    <CheckCircle className="h-4 w-4" /> تکمیل
                  </Button>
                )}
                {STATUS_TRANSITIONS[selectedAppointment.status].includes("CANCELLED") && (
                  <Button variant="destructive" onClick={() => updateAppointmentStatus(selectedAppointment, "CANCELLED")} disabled={refreshing}>
                    <XCircle className="h-4 w-4" /> لغو
                  </Button>
                )}
                {STATUS_TRANSITIONS[selectedAppointment.status].includes("NO_SHOW") && (
                  <Button variant="outline" onClick={() => updateAppointmentStatus(selectedAppointment, "NO_SHOW")} disabled={refreshing}>
                    <AlertCircle className="h-4 w-4" /> عدم حضور
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
