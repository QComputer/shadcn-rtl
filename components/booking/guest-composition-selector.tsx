"use client";

import { ChevronDown, Minus, Plus, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  addChild,
  removeChild,
  setAdultCount,
  setChildAge,
  type GuestCompositionDraft,
} from "../../lib/booking/search-form-model";
import styles from "./guest-composition-selector.module.css";

export interface GuestCompositionSelectorProps {
  value: GuestCompositionDraft;
  onChange: (next: GuestCompositionDraft) => void;
}

const number = new Intl.NumberFormat("fa-IR", { useGrouping: false });

export function GuestCompositionSelector({ value, onChange }: GuestCompositionSelectorProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const adultsIncrementRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || window.innerWidth <= 700) { setPosition({}); return; }
    const width = Math.min(360, window.innerWidth - 28);
    const maximumHeight = Math.min(560, window.innerHeight * 0.7);
    setPosition({
      width,
      left: Math.max(14, Math.min(rect.right - width, window.innerWidth - width - 14)),
      top: Math.max(12, Math.min(rect.bottom + 11, window.innerHeight - maximumHeight - 12)),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => { updatePosition(); adultsIncrementRef.current?.focus(); });
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (popupRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const controls = Array.from(popupRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled)") ?? []);
    if (!controls.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }

  return <div className={styles.root} dir="rtl" data-testid="guest-selector">
    <button
      type="button"
      ref={triggerRef}
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-controls={open ? id : undefined}
      aria-expanded={open}
      aria-label="انتخاب ترکیب مهمانان"
      onClick={() => setOpen((wasOpen) => !wasOpen)}
    >
      <UsersRound size={22} aria-hidden="true" className={styles.icon} />
      <span className={styles.triggerText}><small>مهمانان · نمونه</small><strong>{number.format(value.adults)} بزرگسال{value.childAges.length ? `، ${number.format(value.childAges.length)} کودک` : ""}</strong></span>
      <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
    </button>
    {open && createPortal(<div id={id} ref={popupRef} className={styles.popup} style={position} role="dialog" aria-modal="false" aria-label="ترکیب مهمانان" dir="rtl" onKeyDown={handleKeys}>
      <div className={styles.heading}><strong>ترکیب مهمانان</strong><button type="button" aria-label="بستن انتخاب مهمانان" onClick={() => close()}><X size={19} /></button></div>
      <div className={styles.row}>
        <span>بزرگسال</span>
        <div className={styles.stepper} role="group" aria-label="تعداد بزرگسالان">
          <button type="button" aria-label="کاهش بزرگسال" disabled={value.adults <= 1} onClick={() => onChange(setAdultCount(value, value.adults - 1))}><Minus size={17} /></button>
          <output aria-label="تعداد بزرگسالان">{number.format(value.adults)}</output>
          <button ref={adultsIncrementRef} type="button" aria-label="افزایش بزرگسال" disabled={value.adults >= 12} onClick={() => onChange(setAdultCount(value, value.adults + 1))}><Plus size={17} /></button>
        </div>
      </div>
      <div className={styles.row}>
        <span>کودک</span>
        <div className={styles.stepper} role="group" aria-label="تعداد کودکان">
          <button type="button" aria-label="کاهش کودک" disabled={value.childAges.length === 0} onClick={() => onChange(removeChild(value))}><Minus size={17} /></button>
          <output aria-label="تعداد کودکان">{number.format(value.childAges.length)}</output>
          <button type="button" aria-label="افزایش کودک" disabled={value.childAges.length >= 12} onClick={() => onChange(addChild(value))}><Plus size={17} /></button>
        </div>
      </div>
      {value.childAges.length === 0 ? <p className={styles.hint}>کودکی انتخاب نشده است.</p> : <>
        <p className={styles.hint}>سن کودک در قرارداد فعلی اختیاری است؛ اگر برای یکی وارد شود، برای همه لازم است.</p>
        <div className={styles.ageList}>
          {value.childAges.map((age, index) => <label key={index} className={styles.ageRow}>
            <span>سن کودک {number.format(index + 1)}</span>
            <select aria-label={`سن کودک ${index + 1}`} value={age ?? ""} onChange={(event) => onChange(setChildAge(value, index, event.target.value === "" ? null : Number(event.target.value)))}>
              <option value="">انتخاب نشده</option>
              {Array.from({ length: 18 }, (_, year) => <option key={year} value={year}>{number.format(year)} سال</option>)}
            </select>
          </label>)}
        </div>
      </>}
      <button type="button" className={styles.done} onClick={() => close()}>تأیید مهمانان</button>
    </div>, document.body)}
  </div>;
}
