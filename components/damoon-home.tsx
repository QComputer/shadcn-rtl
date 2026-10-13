"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Menu,
  X,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import styles from "../app/page.module.css";
import { JalaliDateRangePicker } from "./booking/jalali-date-range-picker";
import { todayLocalISO, type StayRange } from "../lib/booking/jalali-calendar";
import { GuestCompositionSelector } from "./booking/guest-composition-selector";
import { initialGuests, validateSearchDraft, type GuestCompositionDraft, type SearchIssue } from "../lib/booking/search-form-model";
import { conceptGallery, conceptRooms } from "../lib/preview-content";
import { previewHotelRooms } from "../lib/hotel-public-read-adapter";
import { RoomShowcase } from "./rooms/room-showcase";
import { toConceptCards } from "../lib/rooms/room-showcase-model";

const previewRoomCards = previewHotelRooms(toConceptCards(conceptRooms)).roomCards;

const navigation = [
  { href: "#home", label: "صفحه‌ی اصلی" },
  { href: "#about", label: "درباره‌ی دامون" },
  { href: "#rooms", label: "فضاهای اقامت" },
  { href: "#gallery", label: "تصاویر" },
];

const searchErrors: Record<SearchIssue, string> = {
  DATES_REQUIRED: "برای پیش‌نمایش، تاریخ ورود و خروج را انتخاب کنید.",
  INVALID_DATE: "تاریخ انتخاب‌شده معتبر نیست.",
  DATE_ORDER: "تاریخ خروج باید پس از تاریخ ورود باشد.",
  PAST_PREVIEW_DATE: "برای پیش‌نمایش، تاریخ ورود گذشته را انتخاب نکنید؛ قانون هتل هنوز دریافت نشده است.",
  MIN_ARRIVAL: "تاریخ ورود پیش از حد مجاز ملک است.",
  MAX_ARRIVAL: "تاریخ ورود پس از بازهٔ مجاز ملک است.",
  MIN_STAY: "مدت اقامت از حداقل مجاز ملک کمتر است.",
  MAX_STAY: "مدت اقامت از حداکثر مجاز بیشتر است.",
  UNAVAILABLE_DATE: "یک روز از بازهٔ انتخابی در دسترس نیست.",
  INVALID_POLICY: "قوانین اقامت معتبر نیستند یا هنوز کامل نشده‌اند.",
  INVALID_ADULTS: "تعداد بزرگسالان باید بین ۱ تا ۱۲ باشد.",
  INVALID_CHILDREN: "تعداد کودکان باید بین ۰ تا ۱۲ باشد.",
  INVALID_CHILD_AGE: "سن هر کودک باید عددی بین ۰ تا ۱۷ باشد.",
  INCOMPLETE_CHILD_AGES: "اگر سن یک کودک را وارد می‌کنید، سن همهٔ کودکان را وارد کنید.",
  CHILD_AGES_REQUIRED: "سن همهٔ کودکان برای این جست‌وجو لازم است.",
  INVALID_PROPERTY: "شناسهٔ ملک معتبر نیست.",
};

function persianNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);
}

export function DamoonHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [guests, setGuests] = useState<GuestCompositionDraft>(initialGuests);
  const [stayDates, setStayDates] = useState<StayRange>({ checkIn: "", checkOut: "" });
  const { checkIn, checkOut } = stayDates;
  const [bookingMessage, setBookingMessage] = useState("");
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setClientReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateSearchDraft({ checkIn, checkOut, guests }, {
      policy: { source: "UNAVAILABLE" },
      browserToday: todayLocalISO(),
    });
    if ("issue" in result) { setBookingMessage(searchErrors[result.issue]); return; }
    setBookingMessage("این فرم فقط پیش‌نمایش طراحی است؛ قوانین محلی ملک هنوز در دسترس نیستند، موجودی بررسی نشد و هیچ درخواستی ارسال نشد.");
  }

  function moveGallery(direction: -1 | 1) {
    setGalleryIndex((current) => (current + direction + conceptGallery.length) % conceptGallery.length);
  }

  function handleGalleryKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") moveGallery(1);
    if (event.key === "ArrowRight") moveGallery(-1);
  }

  return (
    <main className={styles.site} id="home" data-provenance="PREVIEW">
      <div className={styles.previewNotice} role="note">
        <span>پیش‌نمایش داخلی طراحی</span>
        <span>متن، تصاویر و اطلاعات هتل هنوز تأیید انتشار نشده‌اند</span>
      </div>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.brand} href="#home" aria-label="هتل دامون، صفحه‌ی اصلی">
            <span className={styles.brandTitle}>هتل دامون</span>
            <span className={styles.brandCaption}>پیش‌نمایش طراحی · لوگوی رسمی ارائه نشده</span>
          </a>

          <nav className={styles.desktopNav} aria-label="پیمایش اصلی">
            {navigation.map((item, index) => (
              <a key={item.href} className={index === 0 ? styles.navActive : undefined} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <a className={styles.headerCta} href="#booking">
            بررسی تاریخ‌ها <ArrowLeft size={17} aria-hidden="true" />
          </a>

          <button
            className={styles.menuButton}
            type="button"
            aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
        <nav id="mobile-navigation" className={`${styles.mobileNav} ${menuOpen ? styles.mobileNavOpen : ""}`} aria-label="پیمایش موبایل" hidden={!menuOpen}>
          {navigation.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
          ))}
          <a className={styles.mobileNavCta} href="#booking" onClick={() => setMenuOpen(false)}>بررسی تاریخ‌ها</a>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroArt} data-testid="hero-art">
          <Image
            data-testid="hero-image"
            src="/images/architecture-concept.webp"
            alt="بخشی از تصویرسازی معماری در مرجع طراحی؛ عکس مستند هتل نیست"
            fill
            priority
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 68vw, 72vw"
            className={styles.heroImage}
          />
          <span className={styles.heroImageLabel}>تصویر مفهومی مرجع · نه عکس واقعی هتل</span>
          <span className={styles.botanical} aria-hidden="true"><Leaf /></span>
        </div>

        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><i aria-hidden="true" /> روایتی روشن از دامون</span>
          <h1 id="hero-title">هتل دامون</h1>
          <p className={styles.heroLead}>آرامش در قاب نور و طبیعت</p>
          <p className={styles.heroText}>سادگیِ رنگ‌های روشن و گرمای چوب، الهام این روایت تصویری است.</p>
          <a className={styles.primaryCta} href="#booking">انتخاب تاریخ اقامت <ArrowLeft size={19} aria-hidden="true" /></a>
        </div>

        <form id="booking" className={styles.searchPanel} onSubmit={submitSearch} noValidate>
          {clientReady ? (
            <>
          <JalaliDateRangePicker
            value={stayDates}
            onChange={(next) => { setStayDates(next); setBookingMessage(""); }}
          />
          <div className={styles.guestField}>
            <GuestCompositionSelector value={guests} onChange={(next) => { setGuests(next); setBookingMessage(""); }} />
          </div>
          <button className={styles.searchButton} type="submit">بررسی تاریخ‌ها <ArrowLeft size={18} aria-hidden="true" /></button>
            </>
          ) : (
            <div className={styles.searchSkeleton} aria-hidden="true">
              <span /><span /><span /><span />
            </div>
          )}
          {bookingMessage && <p className={styles.bookingMessage} role="status">{bookingMessage}</p>}
          <p className={styles.noBookingNote}>اتصال به موجودی و رزرو فعال نیست؛ این کنترل هیچ رزرو یا درخواستی ایجاد نمی‌کند.</p>
        </form>
      </section>

      <section className={styles.showcase} aria-label="معرفی و تصاویر مفهومی">
        <article className={styles.aboutCopy} id="about">
          <span className={styles.eyebrow}><i aria-hidden="true" /> الهام از دامون</span>
          <h2>گرمای چوب،<br />سادگی و نور</h2>
          <p>در این روایت تصویری، نور نرم و بافت‌های طبیعی فضایی آرام و دلنشین می‌سازند.</p>
          <a className={styles.outlineCta} href="#gallery">دیدن تصاویر <ArrowLeft size={18} aria-hidden="true" /></a>
        </article>

        <figure className={styles.lobbyFigure}>
          <Image
            src="/images/lobby-concept.webp"
            alt="تصویرسازی فضای داخلی از مرجع طراحی؛ فضای واقعی هتل تأیید نشده است"
            fill
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 60vw, 43vw"
            className={styles.showcaseImage}
          />
          <figcaption>تصویر مفهومی از مرجع طراحی · تصویر واقعی یا تأییدشده‌ی هتل نیست</figcaption>
          <div className={styles.lobbyControls} aria-label="کنترل‌های تصویر مفهومی">
            <button type="button" aria-label="رفتن به بخش اتاق‌ها" onClick={() => document.getElementById("rooms")?.scrollIntoView({ behavior: "smooth" })}><ChevronRight size={20} /></button>
            <button type="button" aria-label="رفتن به گالری مفهومی" onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}><ChevronLeft size={20} /></button>
          </div>
        </figure>

        <div className={styles.roomsAndGallery}>
          <section id="rooms" className={styles.roomSection} aria-labelledby="rooms-title">
            <div className={styles.sectionHeading}>
              <div><span className={styles.sectionKicker}>محتوای تصویری نمونه</span><h2 id="rooms-title">دسته‌های اقامت</h2></div>
              <a href="#booking" aria-label="رفتن به فرم پیش‌نمایش">پیش‌نمایش <ArrowLeft size={15} /></a>
            </div>
            <RoomShowcase rooms={previewRoomCards} />
          </section>

          <section id="gallery" className={styles.gallerySection} aria-labelledby="gallery-title">
            <div className={styles.sectionHeading}>
              <div><span className={styles.sectionKicker}>الهام از تصویر مرجع</span><h2 id="gallery-title">گالری مفهومی</h2></div>
              <span className={styles.galleryCount} data-testid="gallery-count">{persianNumber(galleryIndex + 1).padStart(2, "۰")} / {persianNumber(conceptGallery.length)}</span>
            </div>
            <div className={styles.galleryCarousel} onKeyDown={handleGalleryKeys} tabIndex={0} role="region" aria-roledescription="چرخ‌وفلک" aria-label="گالری تصاویر مفهومی">
              <Image src={conceptGallery[galleryIndex].image} alt={conceptGallery[galleryIndex].label} fill sizes="(max-width: 700px) 100vw, 30vw" className={styles.galleryImage} />
              <span className={styles.galleryCaption}>{conceptGallery[galleryIndex].label} · نه تصویر واقعی هتل</span>
              <div className={styles.galleryControls}>
                <button type="button" aria-label="تصویر مفهومی بعدی" onClick={() => moveGallery(1)}><ChevronLeft size={19} /></button>
                <button type="button" aria-label="تصویر مفهومی قبلی" onClick={() => moveGallery(-1)}><ChevronRight size={19} /></button>
              </div>
            </div>
            <div className={styles.galleryDots} role="group" aria-label="انتخاب تصویر مفهومی">
              {conceptGallery.map((item, index) => (
                <button key={item.id} type="button" className={index === galleryIndex ? styles.dotActive : ""} aria-label={`نمایش تصویر مفهومی ${index + 1}`} aria-pressed={index === galleryIndex} onClick={() => setGalleryIndex(index)} />
              ))}
            </div>
          </section>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerMark}><span>هتل دامون</span><small>پیش‌نمایش طراحی F1</small></div>
        <p>محتوا و تصاویر این صفحه صرفاً برای بازبینی طراحی هستند و برای معرفی عمومی هتل منتشر نشده‌اند.</p>
        <a href="#home">بازگشت به بالا <ArrowRight size={16} /></a>
      </footer>
      <span className={styles.edgeBotanical} aria-hidden="true"><Leaf /></span>
    </main>
  );
}
