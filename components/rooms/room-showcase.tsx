"use client";

import Image from "next/image";
import { ArrowUpLeft, ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { RoomCardData } from "../../lib/rooms/room-showcase-model";
import { photoAt, photoIndexAfter } from "../../lib/rooms/room-showcase-model";
import styles from "./room-showcase.module.css";

export interface RoomShowcaseProps {
  rooms: readonly RoomCardData[];
  direction?: "rtl" | "ltr";
  /** Optional: only for published cards with separately approved destination behavior. */
  onPublishedRoomSelect?: (room: Extract<RoomCardData, { kind: "published" }>) => void;
}

const persian = (value: number) => new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);

export function RoomShowcase({ rooms, direction = "rtl", onPublishedRoomSelect }: RoomShowcaseProps) {
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
    return <p className={styles.empty} role="status">در حال حاضر اطلاعات تأییدشده‌ای برای نمایش اتاق‌ها موجود نیست.</p>;
  }

  return (
    <>
      <div className={styles.grid} aria-label="فهرست نمایشی فضاهای اقامت" data-testid="room-showcase">
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
                  />
                ) : (
                  <span className={styles.imageEmpty} role="img" aria-label="تصویر تأییدشده موجود نیست"><Images size={27} aria-hidden="true" /></span>
                )}
                <span className={styles.topBadge}>{concept ? "تصویر مفهومی" : "اطلاعات منتشرشده"}</span>
                <span className={styles.number} aria-hidden="true">{persian(index + 1).padStart(2, "۰")}</span>
              </div>
              <div className={styles.content}>
                <h3 className={styles.title}>{room.title}</h3>
                {concept ? (
                  <p className={styles.subtext}>فقط نمونه طراحی؛ مشخصات واقعی این فضا تأیید نشده است.</p>
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
                    aria-label={`مشاهده تصاویر ${room.title}`}
                  >
                    مشاهده تصاویر <Images size={15} aria-hidden="true" />
                  </button>
                  {room.kind === "published" && onPublishedRoomSelect && (
                    <button
                      className={styles.detailButton}
                      type="button"
                      onClick={() => onPublishedRoomSelect(room)}
                    >
                      جزئیات <ArrowUpLeft size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {rooms.some((room) => room.kind === "concept") && (
        <p className={styles.disclosure}>تصاویر مفهومی تنها برای بازبینی رابط کاربری هستند و به معنی تأیید نوع، تعداد، ظرفیت، قیمت یا امکانات اتاق‌های هتل نیستند.</p>
      )}
      {active && (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label={`نمایش تصاویر ${active.title}`}
            onKeyDown={onDialogKeys}
            data-testid="room-gallery-dialog"
            dir={direction}
          >
            <div className={styles.dialogHeader}>
              <div className={styles.dialogHeading}>
                <strong>{active.title}</strong>
                <span>{active.kind === "concept" ? "پیش‌نمایش مفهومی؛ نه تصویر واقعی هتل" : "تصاویر تأییدشده"}</span>
              </div>
              <button ref={closeRef} type="button" className={styles.closeButton} onClick={close} aria-label="بستن تصاویر اتاق"><X size={21} /></button>
            </div>
            <div className={styles.dialogVisual}>
              {currentImage ? (
                <Image
                  src={currentImage.src}
                  alt={currentImage.alt}
                  fill
                  sizes="(max-width: 700px) 96vw, 72vw"
                  className={styles.dialogPhoto}
                />
              ) : (
                <span className={styles.imageEmpty} role="img" aria-label="تصویر موجود نیست"><Images size={38} aria-hidden="true" /></span>
              )}
            </div>
            <div className={styles.dialogFooter}>
              <span aria-live="polite">{active.images.length ? `${persian(imageIndex + 1)} از ${persian(active.images.length)}` : "تصویری ثبت نشده است"}</span>
              <div className={styles.galleryButtons}>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => photoIndexAfter(i, -1, active.images.length))}
                  disabled={active.images.length < 2}
                  aria-label="تصویر قبلی اتاق"
                ><ChevronRight size={20} /></button>
                <button
                  type="button"
                  onClick={() => setImageIndex((i) => photoIndexAfter(i, 1, active.images.length))}
                  disabled={active.images.length < 2}
                  aria-label="تصویر بعدی اتاق"
                ><ChevronLeft size={20} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
