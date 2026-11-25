"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CellStatus = "VACANT" | "OUT_OF_SERVICE" | "RESERVED" | "OCCUPIED" | "OUT_OF_SERVICE_CONFLICT" | "MAINTENANCE" | "MAINTENANCE_CONFLICT";
type Board = { dates: string[]; rooms: Array<{ id: string; code: string; roomTypeId: string; isOutOfService: boolean; nights: Array<{ date: string; status: CellStatus; reference: string | null }> }>; unassignedReservationNights: number };
type Snapshot = { property: { id: string; name: string; timezone: string }; roomBoard: Board | null; demoProperty: boolean };

const copy = {
  fa: { title: "تقویم اشغال اتاق‌ها", range: "تاریخ شروع", previous: "هفته قبل", next: "هفته بعد", available: "خالی", reserved: "رزروشده", occupied: "اشغال‌شده", maintenance: "تعمیرات", unavailable: "خارج از سرویس", conflict: "تداخل", demo: "نمایشی", loading: "در حال بارگذاری تقویم…", failed: "تقویم در دسترس نیست؛ وضعیت ظرفیت و تعمیرات قابل بررسی نیست. هیچ اتاقی خالی فرض نمی‌شود.", empty: "اتاق فیزیکی فعالی برای نمایش وجود ندارد.", unassigned: "شب رزرو بدون تخصیص اتاق فیزیکی" },
  en: { title: "Room occupancy calendar", range: "Start date", previous: "Previous week", next: "Next week", available: "Available", reserved: "Reserved", occupied: "Occupied", maintenance: "Maintenance", unavailable: "Out of service", conflict: "Conflict", demo: "Demo", loading: "Loading calendar…", failed: "The calendar is unavailable; capacity and maintenance could not be verified. No room is assumed available.", empty: "No active physical rooms to display.", unassigned: "Reservation nights without a physical room assignment" },
  ar: { title: "تقويم إشغال الغرف", range: "تاريخ البداية", previous: "الأسبوع السابق", next: "الأسبوع التالي", available: "متاحة", reserved: "محجوزة", occupied: "مشغولة", maintenance: "صيانة", unavailable: "خارج الخدمة", conflict: "تعارض", demo: "تجريبي", loading: "جارٍ تحميل التقويم…", failed: "التقويم غير متاح؛ تعذر التحقق من السعة والصيانة. لن تُعتبر أي غرفة متاحة.", empty: "لا توجد غرف فعلية نشطة للعرض.", unassigned: "ليالي حجز دون تخصيص غرفة فعلية" },
} as const;

function todayInTimezone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatCalendarDate(date: string, locale: string) {
  const language = locale === "fa" ? "fa-IR-u-ca-persian" : locale === "ar" ? "ar-u-ca-gregory" : "en-GB";
  return new Intl.DateTimeFormat(language, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00.000Z`));
}

export function HotelReservationOccupancyCalendar({ organizationId, propertyId, propertyTimezone, locale }: { organizationId: string; propertyId: string; propertyTimezone: string; locale: string }) {
  const text = copy[locale as keyof typeof copy] ?? copy.fa;
  const endpoint = useMemo(() => `/api/organizations/${encodeURIComponent(organizationId)}/hotels/${encodeURIComponent(propertyId)}/occupancy`, [organizationId, propertyId]);
  const [from, setFrom] = useState(() => todayInTimezone(propertyTimezone));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadedRange, setLoadedRange] = useState("");
  const to = addDays(from, 7);
  const rangeKey = `${from}|${to}`;
  const [failedRange, setFailedRange] = useState("");
  const rtl = locale === "fa" || locale === "ar";

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${endpoint}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.roomBoard) throw new Error("occupancy unavailable");
        if (controller.signal.aborted) return;
        setSnapshot(body as Snapshot);
        setLoadedRange(`${from}|${to}`);
        setFailedRange("");
      })
      .catch(() => { if (!controller.signal.aborted) { setSnapshot(null); setLoadedRange(""); setFailedRange(`${from}|${to}`); } });
    return () => controller.abort();
  }, [endpoint, from, to]);

  const data = loadedRange === rangeKey ? snapshot : null;
  const loading = loadedRange !== rangeKey && failedRange !== rangeKey;
  const failed = failedRange === rangeKey;
  const dateFormatter = useMemo(() => (date: string) => formatCalendarDate(date, locale), [locale]);

  function statusText(status: CellStatus) {
    if (status === "VACANT") return text.available;
    if (status === "RESERVED") return text.reserved;
    if (status === "OCCUPIED") return text.occupied;
    if (status === "MAINTENANCE") return text.maintenance;
    if (status === "OUT_OF_SERVICE") return text.unavailable;
    return `${text.conflict}: ${status === "MAINTENANCE_CONFLICT" ? text.maintenance : text.unavailable}`;
  }

  function statusStyle(status: CellStatus) {
    if (status === "MAINTENANCE_CONFLICT" || status === "OUT_OF_SERVICE_CONFLICT") return "bg-destructive text-destructive-foreground";
    if (status === "MAINTENANCE") return "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100";
    if (status === "OUT_OF_SERVICE" || status === "OCCUPIED") return "bg-muted text-muted-foreground";
    if (status === "RESERVED") return "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100";
    return "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100";
  }

  return <section className="space-y-3 rounded-xl border bg-card p-4" dir={rtl ? "rtl" : "ltr"} aria-labelledby="reservation-occupancy-title">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="reservation-occupancy-title" className="text-lg font-semibold">{text.title}</h2>{data?.demoProperty ? <span className="mt-1 inline-flex rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100">{text.demo}</span> : null}</div>
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="outline" size="sm" aria-label={text.previous} onClick={() => setFrom((value) => addDays(value, -7))}>‹</Button>
        <label className="space-y-1 text-xs"><span>{text.range}</span><Input className="h-9 w-40" type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label={text.range} /></label>
        <Button type="button" variant="outline" size="sm" aria-label={text.next} onClick={() => setFrom((value) => addDays(value, 7))}>›</Button>
      </div>
    </header>
    <ul className="flex flex-wrap gap-2 text-xs" aria-label={text.title}>
      {(["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE", "OUT_OF_SERVICE", "MAINTENANCE_CONFLICT"] as CellStatus[]).map((status) => <li key={status}><span className={`inline-flex rounded px-2 py-1 ${statusStyle(status)}`}>{statusText(status)}</span></li>)}
    </ul>
    {data?.roomBoard?.unassignedReservationNights ? <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{data.roomBoard.unassignedReservationNights} {text.unassigned}</p> : null}
    {loading && !data ? <p role="status" className="text-sm text-muted-foreground">{text.loading}</p> : null}
    {failed ? <p role="alert" className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">{text.failed}</p> : null}
    {data?.roomBoard ? <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-max border-collapse text-sm">
        <caption className="sr-only">{text.title}</caption>
        <thead><tr className="bg-muted"><th scope="col" className="sticky start-0 z-10 min-w-24 bg-muted p-2 text-start">{locale === "fa" ? "اتاق" : locale === "ar" ? "الغرفة" : "Room"}</th>{data.roomBoard.dates.map((date) => <th scope="col" key={date} className="min-w-28 whitespace-nowrap p-2"><time dateTime={date} title={date}>{dateFormatter(date)}</time></th>)}</tr></thead>
        <tbody>{data.roomBoard.rooms.map((room) => <tr key={room.id} className="border-t"><th scope="row" className="sticky start-0 z-10 bg-background p-2 text-start"><bdi dir="ltr">{room.code}</bdi></th>{room.nights.map((cell) => {
          const label = `${statusText(cell.status)}${data.demoProperty ? ` · ${text.demo}` : ""}`;
          return <td key={cell.date} className="p-1.5"><span className={`inline-flex min-h-8 min-w-24 items-center justify-center rounded px-2 text-center text-xs ${statusStyle(cell.status)}`} title={cell.reference ? `${label} · ${cell.reference}` : label} aria-label={`${room.code}, ${dateFormatter(cell.date)}: ${label}${cell.reference ? `, ${cell.reference}` : ""}`}><span>{statusText(cell.status)}{data.demoProperty ? <small className="ms-1">· {text.demo}</small> : null}</span></span></td>;
        })}</tr>)}</tbody>
      </table>
      {!data.roomBoard.rooms.length ? <p className="p-3 text-sm text-muted-foreground">{text.empty}</p> : null}
    </div> : null}
  </section>;
}
