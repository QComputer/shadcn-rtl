"use client";

import Image from "next/image";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  adaptPublishedHotelWebsite,
  publishedHotelWebsiteErrorState,
  type PublishedHotelWebsite,
} from "@/lib/hotel-website-public-adapter";
import type { HotelPublicLocale } from "@/lib/hotel/public-api-contract";
import type { HotelOrganizationSitePresentation } from "@/lib/hotel/organization-site-presentation";
import { HotelDataState } from "@/components/hotel-data-state";
import { RoomShowcase } from "@/components/rooms/room-showcase";
import type { ConceptRoomCardData } from "@/lib/rooms/room-showcase-model";
import { JalaliDateRangePicker } from "@/components/booking/jalali-date-range-picker";
import { GuestCompositionSelector } from "@/components/booking/guest-composition-selector";
import { todayLocalISO, type StayRange } from "@/lib/booking/jalali-calendar";
import { initialGuests, validateSearchDraft, type GuestCompositionDraft } from "@/lib/booking/search-form-model";
import styles from "./published-hotel-website-page.module.css";

type LoadState =
  | Readonly<{ status: "LOADING" }>
  | Readonly<{ status: "ERROR"; code: "UNAVAILABLE_PROPERTY" | "PUBLICATION_DISABLED" | "TEMPORARY_UNAVAILABLE" | "MISSING_TRANSLATION" }>
  | Readonly<{ status: "UNPUBLISHED" }>
  | Readonly<{ status: "READY"; website: PublishedHotelWebsite; source: "PUBLISHED" | "AUTHENTICATED_CMS_PREVIEW" | "SYNTHETIC_PREVIEW" }>;
type ScopedLoadState = Readonly<{ scopeKey: string; value: LoadState }>;

const labels = {
  fa: { home: "صفحهٔ اصلی", nav: "پیمایش اصلی", about: "دربارهٔ ما", rooms: "دسته‌های اقامت", gallery: "گالری", booking: "پیش‌نمایش تاریخ", title: "بررسی تاریخ‌ها", dates: "تاریخ ورود و خروج", guests: "ترکیب مهمانان", noBooking: "رزرو و بررسی موجودی در این صفحه فعال نیست.", previewOnly: "فرم فقط برای پیش‌نمایش رابط کاربری است؛ هیچ درخواستی ارسال نمی‌شود.", invalid: "لطفاً تاریخ‌ها و ترکیب مهمانان را بررسی کنید.", noGallery: "تصویر تأییدشده‌ای برای نمایش در این بخش منتشر نشده است.", imageUnavailable: "تصویر منتشرشده موقتاً در دسترس نیست." },
  en: { home: "Home", nav: "Primary navigation", about: "About", rooms: "Accommodation", gallery: "Gallery", booking: "Date preview", title: "Review dates", dates: "Arrival and departure", guests: "Guest composition", noBooking: "Booking and availability checks are not active here.", previewOnly: "This form is UI preview only; no request will be sent.", invalid: "Please review the dates and guest composition.", noGallery: "No approved image has been published for this section.", imageUnavailable: "This published image is temporarily unavailable." },
  ar: { home: "الرئيسية", nav: "التنقل الرئيسي", about: "عن الفندق", rooms: "فئات الإقامة", gallery: "المعرض", booking: "معاينة التواريخ", title: "مراجعة التواريخ", dates: "الوصول والمغادرة", guests: "تكوين الضيوف", noBooking: "الحجز والتحقق من التوفر غير مفعّلين هنا.", previewOnly: "هذا النموذج لمعاينة الواجهة فقط؛ لن يتم إرسال أي طلب.", invalid: "يرجى مراجعة التواريخ وتكوين الضيوف.", noGallery: "لم تُنشر صورة معتمدة لهذا القسم.", imageUnavailable: "الصورة المنشورة غير متاحة مؤقتًا." },
} satisfies Record<HotelPublicLocale, Record<string, string>>;

function direction(locale: HotelPublicLocale) { return locale === "en" ? "ltr" : "rtl"; }

function initialLoadState(presentation: HotelOrganizationSitePresentation | undefined, expected: { propertySlug: string; locale: HotelPublicLocale; tenantKey?: string }): LoadState {
  if (!presentation) return { status: "LOADING" };
  if (presentation.propertySlug !== expected.propertySlug || presentation.locale !== expected.locale || (expected.tenantKey && (!('organizationId' in presentation) || presentation.organizationId !== expected.tenantKey))) {
    return { status: "ERROR", code: "UNAVAILABLE_PROPERTY" };
  }
  if (presentation.status === "PUBLISHED" && presentation.contentProvenance === "SYNTHETIC") return { status: "ERROR", code: "UNAVAILABLE_PROPERTY" };
  if (presentation.status === "PUBLISHED" || presentation.status === "PREVIEW") {
    return { status: "READY", website: presentation.website, source: presentation.status === "PUBLISHED" ? "PUBLISHED" : presentation.source };
  }
  if (presentation.status === "UNPUBLISHED") return { status: "UNPUBLISHED" };
  return { status: "ERROR", code: presentation.code };
}

function presentationOrganizationId(presentation?: HotelOrganizationSitePresentation) {
  return presentation && "organizationId" in presentation ? presentation.organizationId : undefined;
}

export type HotelWebsiteBranding = Readonly<{ displayName?: string | null; logoUrl?: string | null; themeColor?: string | null; backgroundColor?: string | null }>;

export function PublishedHotelWebsitePage({ propertySlug, locale, presentation, tenantKey, organizationSlug, syntheticRoomCards, branding }: { propertySlug: string; locale: HotelPublicLocale; presentation?: HotelOrganizationSitePresentation; tenantKey?: string; organizationSlug?: string; syntheticRoomCards?: readonly ConceptRoomCardData[]; branding?: HotelWebsiteBranding }) {
  const scopeKey = `${tenantKey ?? presentationOrganizationId(presentation) ?? organizationSlug ?? "host-scoped"}:${propertySlug}:${locale}`;
  const [storedState, setStoredState] = useState<ScopedLoadState>(() => ({ scopeKey, value: initialLoadState(presentation, { propertySlug, locale, tenantKey }) }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [unavailableImages, setUnavailableImages] = useState<ReadonlySet<string>>(() => new Set());
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const [dates, setDates] = useState<StayRange>({ checkIn: "", checkOut: "" });
  const [guests, setGuests] = useState<GuestCompositionDraft>(initialGuests);
  const [formMessage, setFormMessage] = useState("");
  const text = labels[locale];
  const reviewLabel = locale === "fa"
    ? "پیش‌نمایش خصوصی محتوا؛ این نسخه برای بازبینی است و صفحهٔ عمومی یا رزرو محسوب نمی‌شود."
    : locale === "ar"
      ? "معاينة خاصة للمحتوى؛ هذه النسخة للمراجعة وليست صفحة عامة أو حجزًا."
      : "Private content preview. This version is for review, not a public page or booking.";

  useEffect(() => {
    if (!menuOpen) return;
    const focusFrame = requestAnimationFrame(() => menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenuOpen(false);
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => { cancelAnimationFrame(focusFrame); window.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);

  function closeMobileMenu() {
    setMenuOpen(false);
    if (window.matchMedia("(max-width: 700px)").matches) {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }

  function markImageUnavailable(src: string) {
    setUnavailableImages((current) => new Set(current).add(src));
  }

  useEffect(() => {
    if (presentation) return;
    const controller = new AbortController();
    const setScopedState = (value: LoadState) => setStoredState({ scopeKey, value });
    async function load() {
      try {
        const base = `/api/hotel/v1/website/properties/${encodeURIComponent(propertySlug)}`;
        const options: RequestInit = {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: { accept: "application/json" },
          signal: controller.signal,
        };
        const tenantQuery = organizationSlug ? `&organizationSlug=${encodeURIComponent(organizationSlug)}` : "";
        const [websiteResponse, roomsResponse] = await Promise.all([
          fetch(`${base}?locale=${locale}${tenantQuery}`, options),
          fetch(`${base}/room-categories?locale=${locale}${tenantQuery}`, options),
        ]);
        const [websiteBody, roomsBody]: [unknown, unknown] = await Promise.all([
          websiteResponse.json().catch(() => null), roomsResponse.json().catch(() => null),
        ]);
        const failedResponse = !websiteResponse.ok ? websiteResponse : !roomsResponse.ok ? roomsResponse : null;
        if (failedResponse) {
          const errorBody = failedResponse === websiteResponse ? websiteBody : roomsBody;
          const code = publishedHotelWebsiteErrorState(failedResponse.status, errorBody);
          setScopedState({ status: "ERROR", code });
          return;
        }
        const snapshot = adaptPublishedHotelWebsite(websiteBody, roomsBody, { propertySlug, locale });
        if (snapshot.status === "UNPUBLISHED") {
          setScopedState({ status: "UNPUBLISHED" });
          return;
        }
        const website = snapshot.value;
        if (!website.content.title || !website.content.hero.heading || !website.content.introduction.body) {
          setScopedState({ status: "ERROR", code: "MISSING_TRANSLATION" });
          return;
        }
        setScopedState({ status: "READY", website, source: "PUBLISHED" });
      } catch {
        if (controller.signal.aborted) return;
        setScopedState({ status: "ERROR", code: "TEMPORARY_UNAVAILABLE" });
      }
    }
    void load();
    return () => controller.abort();
  }, [propertySlug, locale, organizationSlug, presentation, scopeKey]);

  function submitPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateSearchDraft({ checkIn: dates.checkIn, checkOut: dates.checkOut, guests }, { policy: { source: "UNAVAILABLE" }, browserToday: todayLocalISO() });
    setFormMessage("issue" in result ? text.invalid : text.previewOnly);
  }

  const visibleState = presentation
    ? initialLoadState(presentation, { propertySlug, locale, tenantKey })
    : storedState.scopeKey === scopeKey ? storedState.value : { status: "LOADING" as const };
  if (visibleState.status === "LOADING") return <main className={styles.shell} dir={direction(locale)}><HotelDataState code="LOADING" locale={locale} /></main>;
  if (visibleState.status === "UNPUBLISHED") return <main className={styles.shell} dir={direction(locale)}><HotelDataState code="NO_APPROVED_CONTENT" locale={locale} /></main>;
  if (visibleState.status === "ERROR") return <main className={styles.shell} dir={direction(locale)}><HotelDataState code={visibleState.code} locale={locale} /></main>;

  const { website } = visibleState;
  const image = website.heroDesktop;
  // Concept cards are an explicit private synthetic-preview input, never a
  // fallback for public or authenticated CMS content/inventory.
  const roomCards = visibleState.source === "SYNTHETIC_PREVIEW" && syntheticRoomCards ? syntheticRoomCards : website.roomCards;
  const roomCount = roomCards.length;

  return (
      <main className={styles.shell} dir={direction(locale)} data-provenance={visibleState.source} style={{
        ...(branding?.themeColor && /^#[0-9a-fA-F]{6}$/.test(branding.themeColor) ? { "--terra": branding.themeColor } : {}),
        ...(branding?.backgroundColor && /^#[0-9a-fA-F]{6}$/.test(branding.backgroundColor) ? { "--ivory": branding.backgroundColor } : {}),
      }}>
      {visibleState.source !== "PUBLISHED" && <aside className={styles.previewNotice} role="status" data-testid="hotel-owner-preview-label">{reviewLabel}</aside>}
      <header className={styles.header}>
        <a href="#home" className={styles.brand} aria-label={branding?.displayName || website.content.title || text.home}>
          {branding?.logoUrl ? <Image src={branding.logoUrl} alt={branding.displayName || website.content.title || text.home} width={168} height={48} unoptimized className={styles.brandLogo} /> : (branding?.displayName || website.content.title)}
        </a>
        <nav ref={menuRef} id="published-hotel-navigation" aria-label={text.nav} className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          <a href="#home" onClick={closeMobileMenu}>{text.home}</a><a href="#about" onClick={closeMobileMenu}>{text.about}</a><a href="#rooms" onClick={closeMobileMenu}>{text.rooms}</a>
          {website.propertyGallery.length > 0 && <a href="#gallery" onClick={closeMobileMenu}>{text.gallery}</a>}
        </nav>
        <a href="#booking" className={styles.cta}>{text.booking}</a>
        <button ref={menuButtonRef} className={styles.menuButton} type="button" aria-label={menuOpen ? (locale === "fa" ? "بستن فهرست" : locale === "ar" ? "إغلاق القائمة" : "Close navigation") : (locale === "fa" ? "بازکردن فهرست" : locale === "ar" ? "فتح القائمة" : "Open navigation")} aria-expanded={menuOpen} aria-controls="published-hotel-navigation" onClick={() => menuOpen ? closeMobileMenu() : setMenuOpen(true)}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
      </header>

      <section id="home" className={styles.hero}>
        <div className={styles.heroVisual}>
          {image && !unavailableImages.has(image.src) ? <picture className={styles.heroPicture}>{website.heroMobile && <source media="(max-width: 800px)" srcSet={website.heroMobile.src} />}<Image src={image.src} alt={image.alt} fill priority unoptimized sizes="(max-width: 800px) 100vw, 68vw" className={styles.heroImage} onError={() => markImageUnavailable(image.src)} /></picture> : <div className={styles.imageEmpty} role="status" data-testid={image ? "published-hero-image-unavailable" : undefined}>{image ? text.imageUnavailable : text.noGallery}</div>}
        </div>
        <div className={styles.heroCopy}>
          {website.content.hero.eyebrow && <p className={styles.eyebrow}>{website.content.hero.eyebrow}</p>}
          <h1>{website.content.hero.heading}</h1>
          {website.content.hero.subheading && <p className={styles.lead}>{website.content.hero.subheading}</p>}
          <a className={styles.cta} href="#booking">{text.booking}</a>
        </div>
      </section>

      <form id="booking" className={styles.booking} onSubmit={submitPreview} noValidate>
        <h2>{text.title}</h2>
        <p className={styles.previewNotice}>{text.noBooking} {text.previewOnly}</p>
        <div className={styles.bookingGrid}>
          <fieldset><legend>{text.dates}</legend><JalaliDateRangePicker value={dates} locale={locale} onChange={(next) => { setDates(next); setFormMessage(""); }} /></fieldset>
          <fieldset><legend>{text.guests}</legend><GuestCompositionSelector value={guests} locale={locale} onChange={(next) => { setGuests(next); setFormMessage(""); }} /></fieldset>
        </div>
        <button type="submit" className={styles.cta}>{text.title}</button>
        {formMessage && <p role="status" className={styles.formMessage}>{formMessage}</p>}
      </form>

      <section id="about" className={styles.about}>
        <div><p className={styles.eyebrow}>{website.content.introduction.heading ?? website.content.title}</p><h2>{website.content.introduction.heading ?? website.content.title}</h2><p>{website.content.introduction.body}</p></div>
        {(website.content.contact.phone || website.content.contact.email) && <address className={styles.propertyDescription}>{website.content.contact.phone && <a href={`tel:${website.content.contact.phone}`}>{website.content.contact.phone}</a>}{website.content.contact.email && <a href={`mailto:${website.content.contact.email}`}>{website.content.contact.email}</a>}</address>}
      </section>

      {roomCount > 0 ? <section id="rooms" className={styles.rooms}><p className={styles.eyebrow}>{text.rooms}</p><RoomShowcase rooms={roomCards} direction={direction(locale)} locale={locale} /></section> : <section id="rooms" className={styles.rooms}><HotelDataState code="NO_PUBLISHED_ROOMS" locale={locale} /></section>}

      {website.propertyGallery.length > 0 ? <section id="gallery" className={styles.gallery} aria-label={text.gallery}>{website.propertyGallery.map((photo) => <figure key={`${photo.src}:${photo.sortOrder}`}>{unavailableImages.has(photo.src) ? <div className={styles.galleryUnavailable} role="status" data-testid="published-media-unavailable">{text.imageUnavailable}</div> : <Image src={photo.src} alt={photo.alt} width={960} height={640} unoptimized sizes="(max-width: 700px) 100vw, 50vw" onError={() => markImageUnavailable(photo.src)} />}<figcaption>{photo.alt || text.gallery}</figcaption></figure>)}</section> : <section id="gallery" className={styles.galleryEmpty}><p>{text.noGallery}</p></section>}

      {website.content.sections.filter((section) => section.visible).sort((a, b) => a.order - b.order).map((section) => (
        <section className={styles.editorial} key={section.key}>
          {"heading" in section && section.heading && <h2>{section.heading}</h2>}
          {section.kind === "TEXT" && section.body && <p>{section.body}</p>}
          {section.kind === "FEATURE_LIST" && <ul>{section.items.flatMap((item) => item.label ? [<li key={item.key}><strong>{item.label}</strong>{item.description && <p>{item.description}</p>}</li>] : [])}</ul>}
          {section.kind === "FAQ" && <dl>{section.items.flatMap((item, index) => item.question && item.answer ? [<div key={`${section.key}-${index}`}><dt>{item.question}</dt><dd>{item.answer}</dd></div>] : [])}</dl>}
        </section>
      ))}
      <footer className={styles.footer}><span>{website.content.title}</span><p>{text.noBooking}</p></footer>
    </main>
  );
}
