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
import type { HotelPublicLocale } from "../../lib/hotel/public-api-contract";

export interface GuestCompositionSelectorProps {
  value: GuestCompositionDraft;
  onChange: (next: GuestCompositionDraft) => void;
  locale?: HotelPublicLocale;
}

const labels = {
  fa: { open: "انتخاب ترکیب مهمانان", close: "بستن انتخاب مهمانان", preview: "مهمانان · نمونه", adults: "بزرگسال", children: "کودک", adultGroup: "تعداد بزرگسالان", childGroup: "تعداد کودکان", decreaseAdult: "کاهش بزرگسال", increaseAdult: "افزایش بزرگسال", decreaseChild: "کاهش کودک", increaseChild: "افزایش کودک", guestMix: "ترکیب مهمانان", none: "کودکی انتخاب نشده است.", ageHint: "سن کودک در قرارداد فعلی اختیاری است؛ اگر برای یکی وارد شود، برای همه لازم است.", age: "سن کودک", unset: "انتخاب نشده", years: "سال", done: "تأیید مهمانان" },
  en: { open: "Choose guest composition", close: "Close guest selector", preview: "Guests · preview", adults: "Adults", children: "Children", adultGroup: "Number of adults", childGroup: "Number of children", decreaseAdult: "Decrease adults", increaseAdult: "Increase adults", decreaseChild: "Decrease children", increaseChild: "Increase children", guestMix: "Guest composition", none: "No children selected.", ageHint: "Child age is optional in the current contract; if entered for one child, enter it for every child.", age: "Child age", unset: "Not selected", years: "years", done: "Apply guests" },
  ar: { open: "اختيار تكوين الضيوف", close: "إغلاق محدد الضيوف", preview: "الضيوف · معاينة", adults: "بالغون", children: "أطفال", adultGroup: "عدد البالغين", childGroup: "عدد الأطفال", decreaseAdult: "تقليل البالغين", increaseAdult: "زيادة البالغين", decreaseChild: "تقليل الأطفال", increaseChild: "زيادة الأطفال", guestMix: "تكوين الضيوف", none: "لم يتم اختيار أطفال.", ageHint: "عمر الطفل اختياري في العقد الحالي؛ إذا تم إدخاله لطفل، فيجب إدخاله لكل الأطفال.", age: "عمر الطفل", unset: "غير محدد", years: "سنة", done: "تطبيق الضيوف" },
} as const satisfies Record<HotelPublicLocale, { [key: string]: string }>;

export function GuestCompositionSelector({ value, onChange, locale = "fa" }: GuestCompositionSelectorProps) {
  const text = labels[locale];
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
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

  return <div className={styles.root} dir={locale === "en" ? "ltr" : "rtl"} data-testid="guest-selector">
    <button
      type="button"
      ref={triggerRef}
      className={styles.trigger}
      aria-haspopup="dialog"
      aria-controls={open ? id : undefined}
      aria-expanded={open}
      aria-label={text.open}
      onClick={() => setOpen((wasOpen) => !wasOpen)}
    >
      <UsersRound size={22} aria-hidden="true" className={styles.icon} />
      <span className={styles.triggerText}><small>{text.preview}</small><strong>{number.format(value.adults)} {text.adults}{value.childAges.length ? ` · ${number.format(value.childAges.length)} ${text.children}` : ""}</strong></span>
      <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
    </button>
    {open && createPortal(<div id={id} ref={popupRef} className={styles.popup} style={position} role="dialog" aria-modal="false" aria-label={text.guestMix} dir={locale === "en" ? "ltr" : "rtl"} onKeyDown={handleKeys}>
      <div className={styles.heading}><strong>{text.guestMix}</strong><button type="button" aria-label={text.close} onClick={() => close()}><X size={19} /></button></div>
      <div className={styles.row}>
        <span>{text.adults}</span>
        <div className={styles.stepper} role="group" aria-label={text.adultGroup}>
          <button type="button" aria-label={text.decreaseAdult} disabled={value.adults <= 1} onClick={() => onChange(setAdultCount(value, value.adults - 1))}><Minus size={17} /></button>
          <output aria-label={text.adultGroup}>{number.format(value.adults)}</output>
          <button ref={adultsIncrementRef} type="button" aria-label={text.increaseAdult} disabled={value.adults >= 12} onClick={() => onChange(setAdultCount(value, value.adults + 1))}><Plus size={17} /></button>
        </div>
      </div>
      <div className={styles.row}>
        <span>{text.children}</span>
        <div className={styles.stepper} role="group" aria-label={text.childGroup}>
          <button type="button" aria-label={text.decreaseChild} disabled={value.childAges.length === 0} onClick={() => onChange(removeChild(value))}><Minus size={17} /></button>
          <output aria-label={text.childGroup}>{number.format(value.childAges.length)}</output>
          <button type="button" aria-label={text.increaseChild} disabled={value.childAges.length >= 12} onClick={() => onChange(addChild(value))}><Plus size={17} /></button>
        </div>
      </div>
      {value.childAges.length === 0 ? <p className={styles.hint}>{text.none}</p> : <>
        <p className={styles.hint}>{text.ageHint}</p>
        <div className={styles.ageList}>
          {value.childAges.map((age, index) => <label key={index} className={styles.ageRow}>
            <span>{text.age} {number.format(index + 1)}</span>
            <select aria-label={`${text.age} ${number.format(index + 1)}`} value={age ?? ""} onChange={(event) => onChange(setChildAge(value, index, event.target.value === "" ? null : Number(event.target.value)))}>
              <option value="">{text.unset}</option>
              {Array.from({ length: 18 }, (_, year) => <option key={year} value={year}>{number.format(year)} {text.years}</option>)}
            </select>
          </label>)}
        </div>
      </>}
      <button type="button" className={styles.done} onClick={() => close()}>{text.done}</button>
    </div>, document.body)}
  </div>;
}
