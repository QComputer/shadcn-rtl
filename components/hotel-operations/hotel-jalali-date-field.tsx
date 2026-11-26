"use client";

import { useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jalaliAccessibleDay, jalaliDayLabel, jalaliMonthGrid, jalaliMonthTitle, moveJalaliMonth, parseISODate, persianDigits, startOfJalaliMonth } from "@/lib/booking/jalali-calendar";

const copy = {
  fa: { picker: "تقویم شمسی", close: "بستن", previous: "ماه قبل", next: "ماه بعد", today: "امروز", weekdays: ["ش", "ی", "د", "س", "چ", "پ", "ج"] },
  en: { picker: "Jalali calendar", close: "Close", previous: "Previous month", next: "Next month", today: "Today", weekdays: ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"] },
  ar: { picker: "التقويم الشمسي", close: "إغلاق", previous: "الشهر السابق", next: "الشهر التالي", today: "اليوم", weekdays: ["س", "ح", "ن", "ث", "ر", "خ", "ج"] },
} as const;
// Leave room for neighboring days and month arithmetic in the shared calendar's 1900–2199 domain.
const firstDate = "1901-01-01", lastDate = "2198-12-31";

export function HotelJalaliDateField({ label, value, onChange, today, locale, min, max, disabled, inputClassName }: {
  label: string; value: string; onChange: (value: string) => void; today: string; locale: string;
  min?: string; max?: string; disabled?: boolean; inputClassName?: string;
}) {
  const language = locale === "en" || locale === "ar" ? locale : "fa";
  const t = copy[language];
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const lower = min && min > firstDate ? min : firstDate;
  const upper = max && max < lastDate ? max : lastDate;
  const boundsValid = Boolean(parseISODate(lower) && parseISODate(upper) && lower <= upper);
  const allowed = (day: string) => Boolean(parseISODate(day) && day >= lower && day <= upper);
  const [month, setMonth] = useState<string | null>(null);
  const monthValid = month !== null && Boolean(parseISODate(month)) && boundsValid;
  const days = monthValid ? jalaliMonthGrid(month!, lower, upper) : [];
  const previous = monthValid ? moveJalaliMonth(month!, -1) : null;
  const next = monthValid ? moveJalaliMonth(month!, 1) : null;
  function open() {
    if (!boundsValid || disabled) return;
    const candidate = allowed(value) ? value : allowed(today) ? today : lower;
    setMonth(startOfJalaliMonth(candidate));
    dialog.current?.showModal();
  }
  function choose(day: string) {
    if (disabled || !allowed(day)) return;
    onChange(day);
    dialog.current?.close();
  }
  return <div className="min-w-0 space-y-1 text-sm">
    <label id={`${id}-label`} htmlFor={`${id}-input`}>{label}</label>
    <Input id={`${id}-input`} type="date" value={value} min={min} max={max} disabled={disabled} className={inputClassName} onChange={event => onChange(event.target.value)} />
    <Button ref={trigger} type="button" variant="outline" size="sm" className="max-w-full whitespace-normal" disabled={disabled || !boundsValid} aria-label={t.picker} aria-describedby={`${id}-label`} aria-haspopup="dialog" onClick={open}>
      <CalendarDays aria-hidden="true" className="size-4" /> <span>{parseISODate(value) ? jalaliDayLabel(value, language) : t.picker}</span>
    </Button>
    <dialog ref={dialog} aria-label={t.picker} aria-describedby={`${id}-label`} dir={language === "en" ? "ltr" : "rtl"} onClose={() => trigger.current?.focus()} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,24rem)] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl backdrop:bg-black/50">
      {monthValid ? <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" aria-label={t.previous} disabled={!previous || previous < startOfJalaliMonth(lower)} onClick={() => previous && setMonth(previous)}>{language === "en" ? "‹" : "›"}</Button>
          <h3 className="text-center text-sm font-semibold" aria-live="polite">{jalaliMonthTitle(month!, language)}</h3>
          <Button type="button" variant="outline" size="sm" aria-label={t.next} disabled={!next || next > startOfJalaliMonth(upper)} onClick={() => next && setMonth(next)}>{language === "en" ? "›" : "‹"}</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {t.weekdays.map((day, i) => <span key={i} className="text-xs text-muted-foreground">{day}</span>)}
          {days.map(day => <button key={day.iso} type="button" data-date={day.iso} aria-label={jalaliAccessibleDay(day.iso, language)} aria-pressed={day.iso === value} aria-current={day.iso === today ? "date" : undefined} disabled={disabled || day.disabled} onClick={() => choose(day.iso)} className={`h-10 rounded-md border text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30 ${day.iso === value ? "bg-primary text-primary-foreground" : day.currentMonth ? "hover:bg-accent" : "text-muted-foreground hover:bg-accent"}`}>{persianDigits(day.jalaliDay, language)}</button>)}
        </div>
      </div> : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || !boundsValid || !allowed(today)} onClick={() => choose(today)}>{t.today}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => dialog.current?.close()}>{t.close}</Button>
      </div>
    </dialog>
  </div>;
}
