"use client";

import Image from "next/image";
import { ArrowUpLeft, ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { RoomCardData } from "../../lib/rooms/room-showcase-model";
import { photoAt, photoIndexAfter } from "../../lib/rooms/room-showcase-model";
import styles from "./room-showcase.module.css";
import type { HotelPublicLocale } from "../../lib/hotel/public-api-contract";

export interface RoomShowcaseProps {
  rooms: readonly RoomCardData[];
  direction?: "rtl" | "ltr";
  locale?: HotelPublicLocale;
  /** Optional: only for published cards with separately approved destination behavior. */
  onPublishedRoomSelect?: (room: Extract<RoomCardData, { kind: "published" }>) => void;
}

const labels = {
  fa: { empty: "در حال حاضر اطلاعات تأییدشده‌ای برای نمایش اتاق‌ها موجود نیست.", list: "فهرست دسته‌های اقامت", concept: "تصویر مفهومی", published: "اطلاعات منتشرشده", imageMissing: "تصویر تأییدشده موجود نیست", conceptNote: "فقط نمونه طراحی؛ مشخصات واقعی این فضا تأیید نشده است.", view: "مشاهده تصاویر", details: "جزئیات", conceptDisclosure: "تصاویر مفهومی تنها برای بازبینی رابط کاربری هستند و به معنی تأیید نوع، تعداد، ظرفیت، قیمت یا امکانات اتاق‌های هتل نیستند.", conceptDialog: "پیش‌نمایش مفهومی؛ نه تصویر واقعی هتل", publishedDialog: "تصاویر تأییدشده", close: "بستن تصاویر اتاق", noImage: "تصویری ثبت نشده است", previous: "تصویر قبلی اتاق", next: "تصویر بعدی اتاق", of: "از" },
  en: { empty: "No approved accommodation categories are currently available.", list: "Accommodation categories", concept: "Concept image", published: "Published information", imageMissing: "No approved image is available", conceptNote: "Design sample only; this is not verified room information.", view: "View images", details: "Details", conceptDisclosure: "Concept images are for interface review only and do not verify hotel room types, quantity, capacity, price, or amenities.", conceptDialog: "Concept preview; not an actual hotel photograph", publishedDialog: "Approved images", close: "Close room images", noImage: "No image has been published", previous: "Previous room image", next: "Next room image", of: "of" },
  ar: { empty: "لا تتوفر حاليًا فئات إقامة معتمدة للعرض.", list: "فئات الإقامة", concept: "صورة تصورية", published: "معلومات منشورة", imageMissing: "لا تتوفر صورة معتمدة", conceptNote: "عينة تصميم فقط؛ هذه ليست معلومات مؤكدة عن الغرفة.", view: "عرض الصور", details: "التفاصيل", conceptDisclosure: "الصور التصورية لمراجعة الواجهة فقط ولا تؤكد أنواع الغرف أو عددها أو سعتها أو أسعارها أو مرافقها.", conceptDialog: "معاينة تصورية؛ ليست صورة فعلية للفندق", publishedDialog: "صور معتمدة", close: "إغلاق صور الغرفة", noImage: "لم تُنشر صورة", previous: "صورة الغرفة السابقة", next: "صورة الغرفة التالية", of: "من" },
} as const satisfies Record<HotelPublicLocale, { [key: string]: string }>;

export function RoomShowcase({ rooms, direction = "rtl", locale = "fa", onPublishedRoomSelect }: RoomShowcaseProps) {
  const text = labels[locale];
  const formatNumber = (value: number) => new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const active = rooms.find((room) => room.id === activeId) ?? null;
  const currentImage = active ? photoAt(active.images, imageIndex) : null;

  function open(roomId: string, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setImageIndex(0);
    setActiveId(roomId);
  }

  function close() {
    setActiveId(null);
    openerRef.current?.focus();
  }

  useEffect(() => {
    if (!activeId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeId]);

  function onDialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowLeft" && active && active.images.length > 1) {
      event.preventDefault();
      setImageIndex((i) => photoIndexAfter(i, 1, active.images.length));
    }
    if (event.key === "ArrowRight" && active && active.images.length > 1) {
      event.preventDefault();
      setImageIndex((i) => photoIndexAfter(i, -1, active.images.length));
    }
    if (event.key === "Tab") {
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  if (rooms.length === 0) {
    return <p className={styles.empty} role="status">{text.empty}</p>;
  }

  return (
    <>
      <div className={styles.grid} aria-label={text.list} data-testid="room-showcase">
        {rooms.map((room, index) => {
          const cover = photoAt(room.images, 0);
          const concept = room.kind === "concept";
          return (
            <article className={styles.card} key={room.id} data-room-kind={room.kind}>
              <div className={styles.visual}>
                {cover ? (
                  <Image
                    src={cover.src}
                    alt={cover.alt}
                    fill
                    sizes="(max-width: 700px) 78vw, (max-width: 1150px) 22vw, 14vw"
                    className={styles.photo}
                    unoptimized={!concept}
                  />
                ) : (
                  <span className={styles.imageEmpty} role="img" aria-label={text.imageMissing}><Images size={27} aria-hidden="true" /></span>
                )}
                <span className={styles.topBadge}>{concept ? text.concept : text.published}</span>
                <span className={styles.number} aria-hidden="true">{formatNumber(index + 1).padStart(2, locale === "fa" ? "۰" : "0")}</span>
              </div>
              <div className={styles.content}>
                <h3 className={styles.title}>{room.title}</h3>
                {concept ? (
                  <p className={styles.subtext}>{text.conceptNote}</p>
                ) : (
                  <>
                    {room.description && <p className={styles.subtext}>{room.description}</p>}
                    {room.facts && room.facts.length > 0 && (
                      <dl className={styles.facts}>
                        {room.facts.map((fact) => (
                          <div key={`${fact.label}:${fact.value}`}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
                        ))}
                      </dl>
                    )}
                  </>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.viewButton}
                    onClick={(event) => open(room.id, event.currentTarget)}
                    aria-label={`${text.view} ${room.title}`}
                  >
                    {text.view} <Images size={15} aria-hidden="true" />
                  </button>
                  {room.kind === "published" && onPublishedRoomSelect && (
                    <button
                      className={styles.detailButton}
                      type="button"
                      onClick={() => onPublishedRoomSelect(room)}
                    >
                      {text.details} <ArrowUpLeft size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {rooms.some((room) => room.kind === "concept") && (
        <p className={styles.disclosure}>{text.conceptDisclosure}</p>
      )}
      {active && (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label={`${text.view} ${active.title}`}
            onKeyDown={onDialogKeys}
            data-testid="room-gallery-dialog"
            dir={direction}
          >
            <div className={styles.dialogHeader}>
              <div className={styles.dialogHeading}>
                <strong>{active.title}</strong>
                <span>{active.kind === "concept" ? text.conceptDialog : text.publishedDialog}</span>
              </div>
              <button ref={closeRef} type="button" className={styles.closeButton} onClick={close} aria-label={text.close}><X size={21} /></button>
            </div>
            <div className={styles.dialogVisual}>
              {currentImage ? (
                <Image
                  src={currentImage.src}
                  alt={currentImage.alt}
                  fill
                  sizes="(max-width: 700px) 96vw, 72vw"
                  className={styles.dialogPhoto}
                  unoptimized={active.kind === "published"}
                />
              ) : (
                <span className={styles.imageEmpty} role="img" aria-label={text.imageMissing}><Images size={38} aria-hidden="true" /></span>
              )}
            </div>
            <div className={styles.dialogFooter}>
              <span aria-live="polite">{active.images.length ? `${formatNumber(imageIndex + 1)} ${text.of} ${formatNumber(active.images.length)}` : text.noImage}</span>
              <div className={styles.galleryButtons}>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => photoIndexAfter(i, -1, active.images.length))}
                  disabled={active.images.length < 2}
                  aria-label={text.previous}
                ><ChevronRight size={20} /></button>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => photoIndexAfter(i, 1, active.images.length))}
                  disabled={active.images.length < 2}
                  aria-label={text.next}
                ><ChevronLeft size={20} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
