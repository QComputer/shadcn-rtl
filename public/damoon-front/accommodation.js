import { rooms, roomForLocale } from "./content.js";

const copy = {
  fa: {
    catalog: "فضاهای اقامت", listingLead: "گروه‌های اقامتی هتل دامون را ببینید و برای انتخاب مناسب برنامه‌تان با پذیرش هماهنگ کنید.",
    concept: "تصویر مفهومی؛ عکس واقعی اتاق نیست", detail: "مشاهدهٔ جزئیات", allRooms: "همهٔ گروه‌های اقامتی",
    room: "اقامت", imageLabel: "نمای مفهومی", lobbyLabel: "فضای عمومی هتل · تصویر مفهومی لابی",
    coordination: "برای اقامتتان هماهنگ کنیم", coordinationText: "تاریخ سفر، تعداد مهمانان و نیازهایتان را با پذیرش در میان بگذارید تا ظرفیت، امکانات داخل واحد، نرخ و موجودی بررسی شود.",
    call: "تماس با پذیرش", contact: "راه‌های تماس", booking: "برنامه‌ریزی اقامت", general: "امکانات عمومی هتل", generalText: "پذیرش ۲۴ ساعته، اینترنت، آسانسور، خدمات تاکسی، پارکینگ و صبحانهٔ سلف‌سرویس رایگان در فهرست خدمات عمومی هتل ثبت شده‌اند.",
    timings: "زمان ورود و خروج", checkIn: "ورود از ساعت ۱۴", checkOut: "خروج تا ساعت ۱۲", askRoom: "امکانات اختصاصی این گروه را از پذیرش بپرسید.",
    imageOpen: "بزرگ‌نمایی تصویر مفهومی", close: "بستن تصویر", imageOf: "تصویر مفهومی {current} از {total}",
    crumbsHome: "خانه", crumbsRooms: "اتاق‌ها و سوئیت‌ها", related: "گروه‌های دیگر را هم ببینید",
  },
  en: {
    catalog: "Accommodation", listingLead: "Explore Damoon Hotel’s accommodation categories and contact reception to find an option for your plans.",
    concept: "Concept image; not an actual room photo", detail: "Explore this category", allRooms: "All accommodation", room: "Stay",
    imageLabel: "Concept view", lobbyLabel: "Shared hotel space · concept lobby illustration",
    coordination: "Let’s coordinate your stay", coordinationText: "Share your dates, guest count, and needs with reception so they can confirm capacity, in-room amenities, rates, and availability.",
    call: "Call reception", contact: "Contact details", booking: "Plan your stay", general: "General hotel facilities", generalText: "The hotel lists 24-hour reception, internet, an elevator, taxi service, parking, and free buffet breakfast among its general facilities.",
    timings: "Check-in and check-out", checkIn: "Check-in from 14:00", checkOut: "Check-out by 12:00", askRoom: "Ask reception which facilities are available in this category.",
    imageOpen: "Enlarge concept image", close: "Close image", imageOf: "Concept image {current} of {total}",
    crumbsHome: "Home", crumbsRooms: "Rooms and suites", related: "Explore other categories",
  },
  ar: {
    catalog: "الإقامة", listingLead: "تعرّف على فئات الإقامة في فندق دامون وتواصل مع الاستقبال لاختيار ما يناسب خطتك.",
    concept: "تصميم تصوري؛ ليست صورة فعلية للغرفة", detail: "استكشف هذه الفئة", allRooms: "جميع فئات الإقامة", room: "الإقامة",
    imageLabel: "مشهد تصوري", lobbyLabel: "مساحة مشتركة في الفندق · تصميم تصوري للردهة",
    coordination: "لننسق إقامتك", coordinationText: "أخبر الاستقبال بتاريخ السفر وعدد الضيوف واحتياجاتك للتحقق من السعة والتجهيزات داخل الوحدة والأسعار والتوفر.",
    call: "اتصل بالاستقبال", contact: "بيانات الاتصال", booking: "خطط لإقامتك", general: "مرافق الفندق العامة", generalText: "تشمل المرافق العامة المسجلة استقبالاً على مدار الساعة وإنترنت ومصعداً وخدمة سيارات أجرة ومواقف سيارات وإفطاراً مجانياً بنظام البوفيه.",
    timings: "تسجيل الدخول والمغادرة", checkIn: "الدخول من الساعة 14:00", checkOut: "المغادرة حتى الساعة 12:00", askRoom: "اسأل الاستقبال عن المرافق المتاحة في هذه الفئة.",
    imageOpen: "تكبير الصورة التصورية", close: "إغلاق الصورة", imageOf: "صورة تصورية {current} من {total}",
    crumbsHome: "الرئيسية", crumbsRooms: "الغرف والأجنحة", related: "استكشف الفئات الأخرى",
  },
};

const roomImages = {
  single: "/damoon-front/assets/room-concept-1.webp",
  double: "/damoon-front/assets/room-concept-2.webp",
  "suite-3-bed": "/damoon-front/assets/room-concept-3.webp",
  "suite-4-5-bed": "/damoon-front/assets/room-concept-3.webp",
};

function t(locale) { return copy[locale] || copy.fa; }
function localizedPath(path, locale, routeHref) {
  return routeHref(path, locale);
}

function breadcrumb(label, locale, routeHref, escapeHtml, detail = false) {
  const ui = t(locale);
  return `<nav class="accommodation-crumbs" aria-label="${escapeHtml(locale === "ar" ? "مسار التنقل" : locale === "en" ? "Breadcrumb" : "مسیر صفحه")}"><a href="${escapeHtml(localizedPath("/", locale, routeHref))}">${escapeHtml(ui.crumbsHome)}</a><span aria-hidden="true">/</span>${detail ? `<a href="${escapeHtml(localizedPath("/rooms", locale, routeHref))}">${escapeHtml(ui.crumbsRooms)}</a><span aria-hidden="true">/</span>` : ""}<span aria-current="page">${escapeHtml(label)}</span></nav>`;
}

function bookingSlot() { return '<div class="accommodation-booking" data-booking-slot></div>'; }

export function renderAccommodation({ path, page, locale = "fa", site, routeHref, stayHref, escapeHtml }) {
  const ui = t(locale);
  const slug = path.match(/^\/rooms\/([a-z0-9-]+)$/i)?.[1];
  if (!slug) {
    const localizedRooms = rooms.map((room) => roomForLocale(room.slug, locale) || room);
    return `<div class="accommodation-page accommodation-listing" lang="${escapeHtml(locale)}" dir="${locale === "en" ? "ltr" : "rtl"}">
      <header class="accommodation-heading">${breadcrumb(ui.crumbsRooms, locale, routeHref, escapeHtml)}<p class="accommodation-kicker">${escapeHtml(ui.room)}</p><h1>${escapeHtml(page?.title || ui.crumbsRooms)}</h1><p>${escapeHtml(ui.listingLead)}</p></header>
      ${bookingSlot()}
      <div class="accommodation-grid">${localizedRooms.map((room, index) => {
        const href = stayHref(`/rooms/${room.slug}`);
        return `<article class="accommodation-card"><a class="accommodation-card__image" href="${escapeHtml(href)}" aria-label="${escapeHtml(`${ui.detail}: ${room.title}`)}"><img src="${escapeHtml(roomImages[room.slug] || room.image)}" alt="${escapeHtml(room.title)} — ${escapeHtml(ui.concept)}" loading="${index > 1 ? "lazy" : "eager"}"><span>${escapeHtml(ui.concept)}</span></a><div class="accommodation-card__body"><p class="accommodation-kicker">${escapeHtml(ui.room)}</p><h2><a href="${escapeHtml(href)}">${escapeHtml(room.title)}</a></h2><p>${escapeHtml(room.description)}</p><a class="accommodation-link" href="${escapeHtml(href)}">${escapeHtml(ui.detail)} <span aria-hidden="true">↗</span></a></div></article>`;
      }).join("")}</div>
    </div>`;
  }

  const room = roomForLocale(slug, locale);
  if (!room) return "";
  const heroImage = roomImages[slug] || room.image;
  const generalAmenities = ui.generalText;
  return `<div class="accommodation-page accommodation-detail" lang="${escapeHtml(locale)}" dir="${locale === "en" ? "ltr" : "rtl"}">
    <header class="accommodation-detail__heading">${breadcrumb(room.title, locale, routeHref, escapeHtml, true)}<p class="accommodation-kicker">${escapeHtml(ui.room)}</p><h1>${escapeHtml(room.title)}</h1><p>${escapeHtml(room.description)}</p></header>
    <section class="accommodation-detail__layout" aria-label="${escapeHtml(room.title)}">
      <div class="accommodation-gallery" data-accommodation-gallery>
        <button class="accommodation-gallery__main" type="button" data-accommodation-image="0" aria-label="${escapeHtml(ui.imageOpen)}"><img src="${escapeHtml(heroImage)}" alt="${escapeHtml(`${room.title} · ${ui.imageLabel}`)}"><span>${escapeHtml(ui.concept)}</span></button>
        <div class="accommodation-gallery__thumbs"><button type="button" data-accommodation-image="0" aria-label="${escapeHtml(ui.imageOpen)}"><img src="${escapeHtml(heroImage)}" alt=""><span>${escapeHtml(ui.imageLabel)}</span></button><button type="button" data-accommodation-image="1" aria-label="${escapeHtml(ui.imageOpen)}"><img src="/damoon-front/assets/lobby-concept.webp" alt=""><span>${escapeHtml(ui.lobbyLabel)}</span></button></div>
      </div>
      <aside class="accommodation-coordination"><p class="accommodation-kicker">${escapeHtml(ui.coordination)}</p><h2>${escapeHtml(ui.coordination)}</h2><p>${escapeHtml(ui.coordinationText)}</p><div class="accommodation-coordination__actions"><a class="button button--primary" href="tel:${escapeHtml(site.phone)}">${escapeHtml(ui.call)} <bdi>${escapeHtml(site.phoneDisplay)}</bdi></a><a class="accommodation-link" href="${escapeHtml(stayHref(`/contact?room=${encodeURIComponent(slug)}`))}">${escapeHtml(ui.contact)}</a></div><div class="accommodation-times"><h3>${escapeHtml(ui.timings)}</h3><p>${escapeHtml(ui.checkIn)} <span aria-hidden="true">·</span> ${escapeHtml(ui.checkOut)}</p></div></aside>
    </section>
    <div class="accommodation-detail__after">${bookingSlot()}<section class="accommodation-general"><div><p class="accommodation-kicker">${escapeHtml(ui.general)}</p><h2>${escapeHtml(ui.general)}</h2></div><div><p>${escapeHtml(generalAmenities)}</p><p class="accommodation-muted">${escapeHtml(ui.askRoom)}</p><a class="accommodation-link" href="${escapeHtml(stayHref("/facilities"))}">${escapeHtml(locale === "fa" ? "آشنایی با امکانات هتل" : locale === "ar" ? "تعرّف على مرافق الفندق" : "Explore hotel facilities")}</a></div></section></div>
    <section class="accommodation-related"><h2>${escapeHtml(ui.related)}</h2><div>${rooms.filter((item) => item.slug !== slug).map((item) => { const other = roomForLocale(item.slug, locale) || item; const href = stayHref(`/rooms/${item.slug}`); return `<a href="${escapeHtml(href)}">${escapeHtml(other.title)} <span aria-hidden="true">↗</span></a>`; }).join("")}</div><a class="accommodation-back" href="${escapeHtml(stayHref("/rooms"))}">← ${escapeHtml(ui.allRooms)}</a></section>
    <dialog class="accommodation-lightbox" data-accommodation-dialog aria-label="${escapeHtml(ui.concept)}"><button type="button" class="accommodation-lightbox__close" data-accommodation-close>${escapeHtml(ui.close)}</button><img data-accommodation-dialog-image src="${escapeHtml(heroImage)}" alt=""><p data-accommodation-dialog-caption>${escapeHtml(ui.concept)}</p></dialog>
  </div>`;
}

export function wireAccommodation(root) {
  if (!root || root.dataset.accommodationWired === "true") return;
  root.dataset.accommodationWired = "true";
  root.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-accommodation-image]");
    const dialog = root.querySelector("[data-accommodation-dialog]");
    if (trigger && dialog) {
      const isLobby = trigger.dataset.accommodationImage === "1";
      const image = dialog.querySelector("[data-accommodation-dialog-image]");
      const caption = dialog.querySelector("[data-accommodation-dialog-caption]");
      const source = isLobby ? "/damoon-front/assets/lobby-concept.webp" : root.querySelector(".accommodation-gallery__main img")?.src;
      const alt = trigger.querySelector("span")?.textContent || trigger.getAttribute("aria-label") || "";
      image.src = source;
      image.alt = alt;
      caption.textContent = alt;
      dialog.showModal();
      dialog.querySelector("[data-accommodation-close]")?.focus();
      return;
    }
    if (event.target.closest("[data-accommodation-close]")) dialog?.close();
  });
  root.querySelector("[data-accommodation-dialog]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
}
