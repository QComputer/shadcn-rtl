"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { earlyDepartureBoundary, receptionArrivalTiming, receptionDepartureTiming, receptionClock } from "@/lib/hotel/domain/reception-professional";
import type { AmendmentPreview } from "./hotel-stay-actions";

export type ReceptionSchedule = { timezone: string; checkInTime: string; checkOutTime: string };
const copy = {
  fa: { in: "ثبت ورود", out: "ثبت خروج", earlyIn: "ورود قبل از ساعت مقرر است؛ با ثبت ورود، پذیرش آن را تأیید می‌کند.", before: "برای ورود قبل از تاریخ رزرو، ابتدا تاریخ اقامت را اصلاح کنید.", ended: "بازه رزرو پایان یافته است؛ ثبت ورود مجاز نیست.", lateIn: "ورود با تأخیر در بازه اقامت ثبت می‌شود.", earlyOut: "خروج زودهنگام؛ شب جاری آزاد نمی‌شود.", earlyOutTime: "خروج پیش از ساعت مقرر؛ مبلغ تغییر نمی‌کند.", lateOut: "خروج با تأخیر؛ هزینه خودکار اعمال نمی‌شود.", preview: "پیش‌نمایش مبلغ خروج زودهنگام", confirm: "تأیید مبلغ و ثبت خروج", keep: "ثبت خروج با حفظ تمام شب‌ها و مبلغ", keepHint: "در صورت حفظ شب‌ها، ظرفیت و مبلغ رزرو تغییر نمی‌کند؛ تسویه در فاز مالی انجام می‌شود.", previous: "مبلغ قبلی", revised: "مبلغ جدید", release: "شب قابل آزادسازی", actualIn: "زمان واقعی ورود", actualOut: "زمان واقعی خروج", schedule: "ساعت ورود / خروج هتل" },
  en: { in: "Check in", out: "Check out", earlyIn: "Arrival is before the scheduled time; checking in confirms early arrival.", before: "Amend the stay dates before arriving before the reserved day.", ended: "The reserved stay has ended; arrival is not allowed.", lateIn: "Late arrival within the reserved stay will be recorded.", earlyOut: "Early departure; the current night is retained.", earlyOutTime: "Departure before the scheduled time; the total is unchanged.", lateOut: "Late departure; no automatic charge is applied.", preview: "Preview early departure total", confirm: "Confirm total and check out", keep: "Check out and retain all nights and total", keepHint: "Retaining nights leaves inventory and the total unchanged; financial reconciliation is deferred.", previous: "Previous total", revised: "New total", release: "Nights to release", actualIn: "Actual arrival", actualOut: "Actual departure", schedule: "Hotel check-in / check-out time" },
  ar: { in: "تسجيل الوصول", out: "تسجيل المغادرة", earlyIn: "الوصول قبل الوقت المحدد؛ تسجيل الوصول يؤكد الموافقة.", before: "عدّل تواريخ الإقامة أولاً للوصول قبل يوم الحجز.", ended: "انتهت مدة الحجز؛ لا يسمح بتسجيل الوصول.", lateIn: "سيتم تسجيل الوصول المتأخر ضمن مدة الحجز.", earlyOut: "مغادرة مبكرة؛ تبقى الليلة الحالية محجوزة.", earlyOutTime: "مغادرة قبل الوقت المحدد؛ يبقى المبلغ دون تغيير.", lateOut: "مغادرة متأخرة؛ لا تضاف رسوم تلقائياً.", preview: "معاينة مبلغ المغادرة المبكرة", confirm: "تأكيد المبلغ وتسجيل المغادرة", keep: "تسجيل المغادرة مع حفظ الليالي والمبلغ", keepHint: "تبقى السعة والمبلغ دون تغيير؛ تؤجل التسوية المالية.", previous: "المبلغ السابق", revised: "المبلغ الجديد", release: "ليالٍ للتحرير", actualIn: "وقت الوصول الفعلي", actualOut: "وقت المغادرة الفعلي", schedule: "وقت الوصول / المغادرة في الفندق" },
} as const;

export function HotelReceptionLifecycle({ locale, schedule, status, checkIn, checkOut, checkedInAt, checkedOutAt, assigned, busy, canPreview, onArrival, onDeparture, onPreview, onEarlyDeparture }: {
  locale: string; schedule: ReceptionSchedule; status: string; checkIn: string; checkOut: string; checkedInAt?: string | null; checkedOutAt?: string | null;
  assigned: boolean; busy: boolean; canPreview: boolean;
  onArrival: (allowEarlyArrival: boolean) => void; onDeparture: (retainBookedNights: boolean) => void;
  onPreview: (checkOut: string, receive: (preview: AmendmentPreview) => void) => void;
  onEarlyDeparture: (preview: AmendmentPreview) => void;
}) {
  const t = copy[locale as keyof typeof copy] ?? copy.fa;
  const [preview, setPreview] = useState<AmendmentPreview | null>(null);
  const { today, localTime } = receptionClock(schedule.timezone);
  const arrival = receptionArrivalTiming(checkIn, checkOut, today, localTime, schedule.checkInTime);
  const departure = receptionDepartureTiming(checkOut, today, localTime, schedule.checkOutTime);
  const boundary = earlyDepartureBoundary(today, checkOut);
  const dateFormat = new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : locale === "ar" ? "ar-u-ca-gregory" : "en-GB", { timeZone: schedule.timezone, dateStyle: "medium", timeStyle: "short" });
  if (!["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(status)) return null;
  return <div className="space-y-2 text-sm">
    {checkedInAt ? <p>{t.actualIn}: <time dateTime={checkedInAt}>{dateFormat.format(new Date(checkedInAt))}</time></p> : null}
    {checkedOutAt ? <p>{t.actualOut}: <time dateTime={checkedOutAt}>{dateFormat.format(new Date(checkedOutAt))}</time></p> : null}
    {status === "CONFIRMED" ? <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{t.schedule}: <bdi>{schedule.checkInTime} / {schedule.checkOutTime}</bdi></p>
      {arrival !== "ON_DAY" ? <p className="text-xs text-muted-foreground">{arrival === "EARLY" ? t.earlyIn : arrival === "BEFORE_STAY" ? t.before : arrival === "STAY_ENDED" ? t.ended : t.lateIn}</p> : null}
      <Button type="button" size="sm" variant="outline" disabled={busy || !assigned || arrival === "BEFORE_STAY" || arrival === "STAY_ENDED"} onClick={() => onArrival(arrival === "EARLY")}>{t.in}</Button>
    </div> : null}
    {status === "CHECKED_IN" ? <div className="space-y-2">
      {departure !== "ON_DAY" ? <p className="text-xs text-muted-foreground">{departure === "EARLY" ? (today < checkOut ? t.earlyOut : t.earlyOutTime) : t.lateOut}</p> : null}
      {boundary ? <>
        {canPreview ? <>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setPreview(null); onPreview(boundary, setPreview); }}>{t.preview}</Button>
          {preview && preview.checkOut === boundary ? <div className="space-y-2 rounded-md border p-2" role="status">
            <p>{t.previous}: <bdi>{preview.previousTotal} {preview.currency}</bdi></p>
            <p>{t.revised}: <bdi>{preview.total} {preview.currency}</bdi></p>
            <p>{t.release}: {preview.removed.length}</p>
            <Button type="button" size="sm" disabled={busy} onClick={() => onEarlyDeparture(preview)}>{t.confirm}</Button>
          </div> : null}
        </> : null}
        <p className="text-xs text-muted-foreground">{t.keepHint}</p>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onDeparture(true)}>{t.keep}</Button>
      </> : <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onDeparture(false)}>{t.out}</Button>}
    </div> : null}
  </div>;
}
