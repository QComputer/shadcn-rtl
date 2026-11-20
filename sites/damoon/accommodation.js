import { accommodationCategories, roomForLocale, roomForPath } from "./content.js";
import { publishedDamoonTours, tourViewerMarkup } from "./virtual-tour.js";

const copy = {
  fa: {
    listingLead: "گروه‌های اقامتی هتل دامون را ببینید و برای انتخاب مناسب برنامه‌تان با پذیرش هماهنگ کنید.",
    concept: "تصویر مفهومی؛ عکس واقعی اتاق نیست", detail: "مشاهدهٔ جزئیات", allRooms: "همهٔ گروه‌های اقامتی",
    lobbyLabel: "فضای عمومی هتل · تصویر مفهومی لابی",
    coordination: "برای اقامتتان هماهنگ کنیم", coordinationText: "تاریخ سفر، تعداد مهمانان و نیازهایتان را با پذیرش در میان بگذارید تا ظرفیت، امکانات داخل واحد، نرخ و موجودی بررسی شود.",
    call: "تماس با پذیرش", contact: "راه‌های تماس", general: "امکانات عمومی هتل", generalText: "سالن صبحانهٔ هتل آمادهٔ استفاده است و صبحانه برای مهمانان هتل رایگان ارائه می‌شود. ساعت سرو را از پذیرش بپرسید.",
    timings: "زمان ورود و خروج", checkIn: "ورود: ساعت ۱۴:۰۰", checkOut: "خروج: ساعت ۱۲:۰۰ ظهر", askRoom: "امکانات اختصاصی این گروه را از پذیرش بپرسید.",
    imageOpen: "بزرگ‌نمایی تصویر مفهومی", close: "بستن تصویر",
    crumbsHome: "خانه", crumbsRooms: "اتاق‌ها و سوئیت‌ها", related: "گروه‌های دیگر را هم ببینید",
  },
  en: {
    listingLead: "Explore Damoon Hotel’s accommodation categories and contact reception to find an option for your plans.",
    concept: "Concept image; not an actual room photo", detail: "Explore this category", allRooms: "All accommodation",
    lobbyLabel: "Shared hotel space · concept lobby illustration",
    coordination: "Let’s coordinate your stay", coordinationText: "Share your dates, guest count, and needs with reception so they can confirm capacity, in-room amenities, rates, and availability.",
    call: "Call reception", contact: "Contact details", general: "General hotel facilities", generalText: "The hotel breakfast hall is ready for use, and breakfast is complimentary for hotel guests. Ask reception for serving hours.",
    timings: "Check-in and check-out", checkIn: "Check-in: 14:00", checkOut: "Check-out: 12:00 noon", askRoom: "Ask reception which facilities are available in this category.",
    imageOpen: "Enlarge concept image", close: "Close image",
    crumbsHome: "Home", crumbsRooms: "Rooms and suites", related: "Explore other categories",
  },
  ar: {
    listingLead: "تعرّف على فئات الإقامة في فندق دامون وتواصل مع الاستقبال لاختيار ما يناسب خطتك.",
    concept: "تصميم تصوري؛ ليست صورة فعلية للغرفة", detail: "استكشف هذه الفئة", allRooms: "جميع فئات الإقامة",
    lobbyLabel: "مساحة مشتركة في الفندق · تصميم تصوري للردهة",
    coordination: "لننسق إقامتك", coordinationText: "أخبر الاستقبال بتاريخ السفر وعدد الضيوف واحتياجاتك للتحقق من السعة والتجهيزات داخل الوحدة والأسعار والتوفر.",
    call: "اتصل بالاستقبال", contact: "بيانات الاتصال", general: "مرافق الفندق العامة", generalText: "قاعة الإفطار في الفندق جاهزة للاستخدام، والإفطار مجاني لنزلاء الفندق. يُرجى سؤال الاستقبال عن ساعات التقديم.",
    timings: "تسجيل الدخول والمغادرة", checkIn: "تسجيل الدخول: ١٤:٠٠", checkOut: "تسجيل المغادرة: ١٢:٠٠ ظهراً", askRoom: "اسأل الاستقبال عن المرافق المتاحة في هذه الفئة.",
    imageOpen: "تكبير الصورة التصورية", close: "إغلاق الصورة",
    crumbsHome: "الرئيسية", crumbsRooms: "الغرف والأجنحة", related: "استكشف الفئات الأخرى",
  },
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
  const localizedRooms = accommodationCategories.map(({ slug }) => roomForLocale(slug, locale));
  if (path === "/rooms") {
    return `<div class="accommodation-page accommodation-listing" lang="${escapeHtml(locale)}" dir="${locale === "en" ? "ltr" : "rtl"}">
      <header class="accommodation-heading">${breadcrumb(ui.crumbsRooms, locale, routeHref, escapeHtml)}<h1>${escapeHtml(page?.title || ui.crumbsRooms)}</h1><p>${escapeHtml(ui.listingLead)}</p></header>
      <div class="accommodation-grid">${localizedRooms.map((room, index) => {
        const href = stayHref(`/rooms/${room.slug}`);
        return `<article class="accommodation-card">
          <figure class="accommodation-card__image">
            <img src="${escapeHtml(room.image)}" alt="" loading="${index ? "lazy" : "eager"}">
            <figcaption>${escapeHtml(ui.concept)}</figcaption>
          </figure>
          <div class="accommodation-card__body">
            <h2>${escapeHtml(room.title)}</h2>
            ${room.floor ? `<p class="accommodation-kicker">${escapeHtml(room.floor)}</p>` : ""}
            <p>${escapeHtml(room.description)}</p>
            <a class="accommodation-link" href="${escapeHtml(href)}" aria-label="${escapeHtml(`${ui.detail}: ${room.title}`)}">${escapeHtml(ui.detail)} <span aria-hidden="true">↗</span></a>
          </div>
        </article>`;
      }).join("")}</div>
      ${bookingSlot()}
    </div>`;
  }

  const room = roomForPath(path, locale);
  if (!room) return "";
  const { slug, image: heroImage } = room;
  const roomTours = publishedDamoonTours().filter((tour) => tour.roomSlugs.includes(slug));
  const generalAmenities = ui.generalText;
  return `<div class="accommodation-page accommodation-detail" lang="${escapeHtml(locale)}" dir="${locale === "en" ? "ltr" : "rtl"}">
    <header class="accommodation-detail__heading">${breadcrumb(room.title, locale, routeHref, escapeHtml, true)}<h1>${escapeHtml(room.title)}</h1>${room.floor ? `<p class="accommodation-kicker">${escapeHtml(room.floor)}</p>` : ""}<p>${escapeHtml(room.description)}</p></header>
    <section class="accommodation-detail__layout" aria-label="${escapeHtml(room.title)}">
      <div class="accommodation-gallery" data-accommodation-gallery>
        <button class="accommodation-gallery__main" type="button" data-accommodation-image="0" aria-label="${escapeHtml(`${ui.imageOpen}: ${room.title}`)}"><img src="${escapeHtml(heroImage)}" alt=""><span>${escapeHtml(ui.concept)}</span></button>
        <div class="accommodation-gallery__thumbs"><button type="button" data-accommodation-image="1" aria-label="${escapeHtml(`${ui.imageOpen}: ${ui.lobbyLabel}`)}"><img src="/assets/lobby-concept.webp" alt="" loading="lazy"><span>${escapeHtml(ui.lobbyLabel)}</span></button></div>
      </div>
      <aside class="accommodation-coordination"><h2>${escapeHtml(ui.coordination)}</h2><p>${escapeHtml(ui.coordinationText)}</p><div class="accommodation-coordination__actions"><a class="button button--primary" href="tel:${escapeHtml(site.phone)}">${escapeHtml(ui.call)} <bdi>${escapeHtml(site.phoneDisplay)}</bdi></a><a class="accommodation-link" href="${escapeHtml(stayHref(`/contact?room=${encodeURIComponent(slug)}`))}">${escapeHtml(ui.contact)}</a></div><div class="accommodation-times"><h3>${escapeHtml(ui.timings)}</h3><p>${escapeHtml(ui.checkIn)} <span aria-hidden="true">·</span> ${escapeHtml(ui.checkOut)}</p></div></aside>
    </section>
    <div class="accommodation-detail__after">${bookingSlot()}${roomTours.length ? `<section class="accommodation-tour"><h2>${escapeHtml(locale === "fa" ? "تور این گروه اقامتی" : locale === "ar" ? "جولة فئة الإقامة" : "Tour this room category")}</h2>${roomTours.map((tour) => tourViewerMarkup(tour, `${room.title} · ${tour.id}`, undefined, locale)).join("")}</section>` : ""}<section class="accommodation-general"><div><h2>${escapeHtml(ui.general)}</h2></div><div><p>${escapeHtml(generalAmenities)}</p><p class="accommodation-muted">${escapeHtml(ui.askRoom)}</p><a class="accommodation-link" href="${escapeHtml(stayHref("/facilities"))}">${escapeHtml(locale === "fa" ? "آشنایی با امکانات هتل" : locale === "ar" ? "تعرّف على مرافق الفندق" : "Explore hotel facilities")}</a></div></section></div>
    <section class="accommodation-related"><h2>${escapeHtml(ui.related)}</h2><div>${localizedRooms.filter((other) => other.slug !== slug).map((other) => { const href = stayHref(`/rooms/${other.slug}`); return `<a href="${escapeHtml(href)}">${escapeHtml(other.title)} <span aria-hidden="true">↗</span></a>`; }).join("")}</div><a class="accommodation-back" href="${escapeHtml(stayHref("/rooms"))}">← ${escapeHtml(ui.allRooms)}</a></section>
    <dialog class="accommodation-lightbox" data-accommodation-dialog aria-label="${escapeHtml(ui.concept)}"><button type="button" class="accommodation-lightbox__close" data-accommodation-close>${escapeHtml(ui.close)}</button><img data-accommodation-dialog-image src="${escapeHtml(heroImage)}" alt=""><p data-accommodation-dialog-caption>${escapeHtml(ui.concept)}</p></dialog>
  </div>`;
}

export function wireAccommodation(root) {
  if (!root || root.dataset.accommodationWired === "true") return;
  root.dataset.accommodationWired = "true";
  const dialog = root.querySelector("[data-accommodation-dialog]");
  if (!dialog) return;
  let opener;
  root.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-accommodation-image]");
    if (trigger) {
      const image = dialog.querySelector("[data-accommodation-dialog-image]");
      const caption = dialog.querySelector("[data-accommodation-dialog-caption]");
      image.src = trigger.querySelector("img").src;
      caption.textContent = trigger.querySelector("span").textContent;
      opener = trigger;
      dialog.showModal();
      return;
    }
    if (event.target.closest("[data-accommodation-close]")) dialog.close();
  });
  dialog.addEventListener("close", () => opener?.focus());
  dialog.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
}
