"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  jalaliAccessibleDay,
  jalaliDayLabel,
  jalaliMonthGrid,
  jalaliMonthTitle,
  moveJalaliMonth,
  parseISODate,
  persianDigits,
  shiftISODate,
  selectStayDate,
  startOfJalaliMonth,
  todayLocalISO,
  type ISODate,
  type RangeSegment,
  type StayRange,
} from "../../lib/booking/jalali-calendar";
import styles from "./jalali-date-range-picker.module.css";

export interface JalaliDateRangePickerProps {
  value: StayRange;
  onChange: (next: StayRange) => void;
  /** ISO Gregorian date. Defaults to local today; dates before it are blocked. */
  minDate?: ISODate;
  /** Optional upper limit. ISO Gregorian date. */
  maxDate?: ISODate;
  disabled?: boolean;
  className?: string;
}

const weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export function JalaliDateRangePicker({ value, onChange, minDate, maxDate, disabled = false, className = "" }: JalaliDateRangePickerProps) {
  const identifier = useId();
  const dialogId = `${identifier}-dialog`;
  const checkInRef = useRef<HTMLButtonElement>(null);
  const checkOutRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<RangeSegment>("checkIn");
  const [month, setMonth] = useState<ISODate>(() => startOfJalaliMonth(todayLocalISO()));
  const [focusedDate, setFocusedDate] = useState<ISODate>(() => todayLocalISO());
  const [position, setPosition] = useState<CSSProperties>({});
  const minimum = minDate && parseISODate(minDate) ? minDate : todayLocalISO();
  const maximum = maxDate && parseISODate(maxDate) ? maxDate : undefined;
  const calendarDays = useMemo(() => jalaliMonthGrid(month, minimum, maximum), [month, minimum, maximum]);
  const today = todayLocalISO();

  const closePicker = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => restoreFocusRef.current?.focus());
  }, []);

  const updatePosition = useCallback(() => {
    const rect = (restoreFocusRef.current ?? checkInRef.current)?.getBoundingClientRect();
    if (!rect || window.innerWidth <= 700) { setPosition({}); return; }
    const width = Math.min(440, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const desiredHeight = 467;
    const below = window.innerHeight - rect.bottom;
    const top = below >= desiredHeight || rect.top < desiredHeight
      ? Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 150))
      : Math.max(12, rect.top - desiredHeight - 10);
    setPosition({ left, top, width });
  }, []);

  function openPicker(nextSegment: RangeSegment) {
    if (disabled) return;
    const trigger = nextSegment === "checkIn" ? checkInRef.current : checkOutRef.current;
    restoreFocusRef.current = trigger;
    const initial = nextSegment === "checkOut" && value.checkOut ? value.checkOut : value.checkIn || minimum;
    const validInitial = parseISODate(initial) && initial >= minimum ? initial : minimum;
    setSegment(nextSegment);
    setMonth(startOfJalaliMonth(validInitial));
    setFocusedDate(validInitial);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button[data-date]") ?? [])
        .find((button) => button.dataset.date === focusedDate && !button.disabled);
      (target ?? dialogRef.current?.querySelector<HTMLButtonElement>("button[data-date]:not(:disabled)"))?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, focusedDate, month]);

  function moveMonth(offset: -1 | 1) {
    const nextMonth = moveJalaliMonth(month, offset);
    if (offset < 0 && nextMonth < startOfJalaliMonth(minimum)) return;
    if (offset > 0 && maximum && nextMonth > startOfJalaliMonth(maximum)) return;
    setMonth(nextMonth);
    setFocusedDate(jalaliMonthGrid(nextMonth, minimum, maximum).find((day) => day.currentMonth && !day.disabled)?.iso ?? nextMonth);
  }

  function handleDay(iso: ISODate) {
    if (iso < minimum || (maximum && iso > maximum)) return;
    const selected = selectStayDate(value, iso, segment);
    onChange(selected.range);
    setFocusedDate(iso);
    if (selected.complete) closePicker();
    else setSegment(selected.nextSegment);
  }

  function handleDayKeyboard(event: KeyboardEvent<HTMLButtonElement>, iso: ISODate) {
    const offsets: Record<string, number> = { ArrowRight: -1, ArrowLeft: 1, ArrowDown: 7, ArrowUp: -7 };
    let next: ISODate | undefined;
    if (event.key in offsets) next = shiftISODate(iso, offsets[event.key]);
    if (event.key === "Home") next = shiftISODate(iso, -((new Date(`${iso}T12:00:00Z`).getUTCDay() + 1) % 7));
    if (event.key === "End") next = shiftISODate(iso, 6 - ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 1) % 7));
    if (!next) return;
    event.preventDefault();
    if (next < minimum) next = minimum;
    if (maximum && next > maximum) next = maximum;
    setMonth(startOfJalaliMonth(next));
    setFocusedDate(next);
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); closePicker(); return; }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const popup = open ? createPortal(
    <div className={styles.portal} dir="rtl">
      <div className={styles.backdrop} onMouseDown={closePicker} aria-hidden="true" />
      <div
        id={dialogId}
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="انتخاب تاریخ شمسی ورود و خروج"
        onKeyDown={handleDialogKeys}
        style={position}
        data-testid="jalali-calendar-dialog"
      >
        <div className={styles.dialogTop}>
          <div>
            <span className={styles.kicker}>تقویم شمسی</span>
            <h2>تاریخ اقامت</h2>
          </div>
          <button type="button" className={styles.closeButton} aria-label="بستن تقویم" onClick={closePicker}><X size={20} /></button>
        </div>
        <div className={styles.rangeSummary} aria-label="انتخاب بخش تاریخ">
          <button type="button" className={segment === "checkIn" ? styles.selectedSegment : ""} onClick={() => setSegment("checkIn")} aria-pressed={segment === "checkIn"}>
            <span>ورود</span><strong>{value.checkIn ? jalaliDayLabel(value.checkIn) : "انتخاب کنید"}</strong>
          </button>
          <span className={styles.summaryArrow} aria-hidden="true">←</span>
          <button type="button" className={segment === "checkOut" ? styles.selectedSegment : ""} onClick={() => setSegment("checkOut")} aria-pressed={segment === "checkOut"}>
            <span>خروج</span><strong>{value.checkOut ? jalaliDayLabel(value.checkOut) : "انتخاب کنید"}</strong>
          </button>
        </div>
        <div className={styles.monthNav}>
          <button type="button" aria-label="ماه قبل" title="ماه قبل" onClick={() => moveMonth(-1)} disabled={month <= startOfJalaliMonth(minimum)}><ChevronRight size={20} /></button>
          <strong aria-live="polite">{jalaliMonthTitle(month)}</strong>
          <button type="button" aria-label="ماه بعد" title="ماه بعد" onClick={() => moveMonth(1)} disabled={Boolean(maximum && moveJalaliMonth(month, 1) > startOfJalaliMonth(maximum))}><ChevronLeft size={20} /></button>
        </div>
        <div className={styles.weekdayRow} aria-hidden="true">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
        <div className={styles.dayGrid} role="group" aria-label={`روزهای ${jalaliMonthTitle(month)}`}>
          {calendarDays.map((day) => {
            const isStart = day.iso === value.checkIn;
            const isEnd = day.iso === value.checkOut;
            const inRange = Boolean(value.checkIn && value.checkOut && day.iso > value.checkIn && day.iso < value.checkOut);
            return <button
              key={day.iso}
              type="button"
              data-date={day.iso}
              data-testid={`jalali-day-${day.iso}`}
              aria-label={`${jalaliAccessibleDay(day.iso)}${isStart ? "، ورود" : isEnd ? "، خروج" : ""}`}
              aria-pressed={isStart || isEnd}
              tabIndex={focusedDate === day.iso ? 0 : -1}
              disabled={day.disabled}
              onClick={() => handleDay(day.iso)}
              onKeyDown={(event) => handleDayKeyboard(event, day.iso)}
              className={[styles.day, !day.currentMonth ? styles.otherMonth : "", day.friday ? styles.friday : "", day.iso === today ? styles.today : "", inRange ? styles.inRange : "", isStart || isEnd ? styles.rangeEdge : ""].filter(Boolean).join(" ")}
            >{persianDigits(day.jalaliDay)}</button>;
          })}
        </div>
        <div className={styles.dialogFooter}>
          <span role="status">{segment === "checkIn" ? "ابتدا روز ورود را انتخاب کنید" : "حالا روز خروج را انتخاب کنید"}</span>
          <button type="button" className={styles.clearButton} onClick={() => { onChange({ checkIn: "", checkOut: "" }); setSegment("checkIn"); }}>پاک‌کردن</button>
        </div>
        <p className={styles.previewNote}>انتخاب تاریخ صرفاً نمایشی است؛ موجودی اتاق بررسی نمی‌شود.</p>
      </div>
    </div>, document.body) : null;

  return (
    <div className={`${styles.root} ${className}`} data-testid="jalali-date-range-picker">
      <button type="button" className={styles.field} ref={checkInRef} data-iso-date={value.checkIn} aria-label="انتخاب تاریخ ورود شمسی" aria-haspopup="dialog" aria-controls={open ? dialogId : undefined} aria-expanded={open && segment === "checkIn"} onClick={() => openPicker("checkIn")} disabled={disabled}>
        <CalendarDays className={styles.icon} size={22} aria-hidden="true" />
        <span className={styles.fieldText}><small>تاریخ ورود</small><strong data-testid="date-checkin-display">{jalaliDayLabel(value.checkIn)}</strong></span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>
      <button type="button" className={styles.field} ref={checkOutRef} data-iso-date={value.checkOut} aria-label="انتخاب تاریخ خروج شمسی" aria-haspopup="dialog" aria-controls={open ? dialogId : undefined} aria-expanded={open && segment === "checkOut"} onClick={() => openPicker("checkOut")} disabled={disabled}>
        <CalendarDays className={styles.icon} size={22} aria-hidden="true" />
        <span className={styles.fieldText}><small>تاریخ خروج</small><strong data-testid="date-checkout-display">{jalaliDayLabel(value.checkOut)}</strong></span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>
      {popup}
    </div>
  );
}
