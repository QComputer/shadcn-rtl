import { accommodationCategories, galleryForLocale, localeForPath, normalizePath, pageForPath, siteForLocale, roomForLocale, roomForPath } from "./content.js";
import { applyPublishedAccommodationCatalog, renderAccommodation, wireAccommodation } from "./accommodation.js";
import { renderHospitality } from "./hospitality.js";
import { renderDamoonAttractionsPage, mountDamoonAttractionsPage } from "./damoon-attractions-view.js";
import { renderDamoonAttractionDetailPage } from "./damoon-attractions-detail-view.js";
import { renderDamoonMap, mountDamoonMaps, hotelMapUrl } from "./damoon-leaflet-maps.js";
import { validateStayRange, todayLocalISO, jalaliAccessibleDay } from "./calendar.js";
import translations from "./translations.js";
import { palettes, readPalette, applyPalette } from "./themes.js";
import { mountBooking, readStaySelection } from "./booking.js";
import { parseChildAges, withStaySelection, createIdempotencyKey } from "./booking-flow.js";
import { allowedVirtualTourUrl, DAMOON_VTOUR_COPY, publishedDamoonTours, tourViewerMarkup } from "./virtual-tour.js";

const root = document.querySelector("#app");
if (!root) throw new Error("Damoon app mount #app was not found");

const safeText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let locale = "fa";
let site;
let gallery;
let ui;
const faUI = {
  skipToMain: "رفتن به محتوای اصلی", mainMenu: "منوی اصلی", mobileMenu: "منوی موبایل", appearanceSettings: "تنظیم ظاهر سایت", choosePalette: "انتخاب رنگ‌بندی", contactHotel: "تماس با هتل", openMenu: "بازکردن منو", closeMenu: "بستن منو", footerLinks: "پیوندهای پایانی", breadcrumb: "مسیر صفحه", detailsMore: "جزئیات بیشتر", generalHotel: "هتل دامون", additionalInformation: "اطلاعات بیشتر", coordinateWithHotel: "هماهنگی با هتل", pageNotFound: "این صفحه پیدا نشد", pageNotFoundText: "ممکن است نشانی صفحه تغییر کرده باشد.", backHome: "بازگشت به خانه", reception: "پذیرش", callReception: "تماس با پذیرش", directions: "مسیریابی روی نقشه", checkIn: "ورود", checkOut: "خروج", guests: "مهمانان", room: "اتاق", rooms: "اتاق‌ها", restaurant: "اطلاعات پذیرایی", cafe: "پذیرایی در اتاق", facilities: "خدمات مهمانان", gallery: "گالری", aboutDamoon: "دربارهٔ دامون", contact: "تماس", policies: "قوانین و حریم خصوصی", virtualTour: "تور مجازی", conceptImage: "تصویر مفهومی", conceptGallery: "گالری مفهومی", referenceImages: "تصاویر مرجع", zoomConceptImage: "بزرگ‌نمایی تصویر مفهومی", closeImageViewer: "بستن نمایش تصویر", previousImage: "تصویر قبلی", nextImage: "تصویر بعدی", imageNotActual: "تصویر مفهومی؛ عکس واقعی هتل نیست.", imageCount: "{current} از {total}", colorPalette: "رنگ‌بندی", switchToDark: "رفتن به تم تیره", switchToLight: "رفتن به تم روشن", footerReception: "پذیرش", noscript: "برای نمایش این نسخهٔ در حال تکمیل، جاوااسکریپت مرورگر را فعال کنید.", homeSubtitle: "اقامت در دامون", homeLead: "هتل دامون در شهرکرد ۳۱ واحد اقامتی دارد. برای برنامه‌ریزی اقامت با پذیرش هماهنگ کنید.", homeShortcuts: "دسترسی سریع", roomSpaces: "فضاهای اقامت", restaurantShort: "اطلاعات پذیرایی", tourShort: "گشت‌وگذار در فضاها", calmStay: "برای اقامتی آرام و لحظه‌هایی خوش", homeIntro: "هتل دامون در شهرکرد میزبان مهمانان و برنامه‌های اقامت شماست. برای هماهنگی با پذیرش در تماس باشید.", aboutMore: "بیشتر دربارهٔ هتل", accommodationSpaces: "فضاهای اقامت", aPlaceToRest: "جایی برای آسودن", browseRooms: "گروه‌های اقامتی هتل دامون را ببینید و برای انتخاب متناسب با برنامه‌تان هماهنگ کنید.", conceptCaption: "تصویر مفهومی", viewSpaces: "مشاهدهٔ فضاها", forYourStay: "برای اقامت شما", hotelSpaces: "فضاهای هتل", planYourStay: "برای برنامه‌ریزی اقامت", contactCoordination: "برای هماهنگی با هتل در تماس باشید", homeEyebrow: "اقامتی آرام در شهرکرد", guestComfort: "آسایش مهمانان", unitCount: "۳۱ واحد اقامتی", checkInLabel: "ورود", checkOutLabel: "خروج", notFound: "این صفحه پیدا نشد", notFoundText: "ممکن است نشانی صفحه تغییر کرده باشد.", paletteNames: { hermes: "کرم و نارنجی", forest: "سبز روشن و طبیعی", wood: "قهوه‌ای چوبی" },
};

function prefixFor(localeCode = locale) {
  if (localeCode !== "fa") return `/${localeCode}`;
  return /^\/fa(?:\/|$)/.test(window.location.pathname) ? "/fa" : "";
}
const routeHref = (href) => `${prefixFor()}${href === "/" ? "/" : href}`;
function stayHref(href) {
  const target = withStaySelection(new URL(routeHref(href), window.location.origin), readStaySelection());
  const room = roomForPath(normalizePath(window.location.pathname), locale)?.slug;
  if (room && normalizePath(target.pathname) === '/contact' && !target.searchParams.has('room')) target.searchParams.set('room', room);
  return target.pathname + target.search + target.hash;
}
const link = (href, label, className = "") => `<a class="${className}" href="${routeHref(href)}">${safeText(label)}</a>`;
function languageHref(code) {
  const path = normalizePath(window.location.pathname);
  const prefix = code === "fa" ? "" : `/${code}`;
  const url = withStaySelection(new URL(`${prefix}${path === "/" ? "/" : path}${window.location.search}${window.location.hash}`, window.location.origin), readStaySelection());
  return url.pathname + url.search + url.hash;
}

function readTheme() {
  try { return localStorage.getItem("damoon-theme") === "dark" ? "dark" : "light"; }
  catch { return "light"; }
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("damoon-theme", theme); } catch { /* Theme still works for this visit. */ }
  const button = document.querySelector("[data-theme-toggle]");
  if (button) {
    button.setAttribute("aria-label", theme === "dark" ? ui.switchToLight : ui.switchToDark);
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.innerHTML = theme === "dark"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.2 15.3A8.6 8.6 0 0 1 8.7 3.8 8.7 8.7 0 1 0 20.2 15.3Z"/></svg>';
  }
}

function languageSwitcher(path) {
  const choices = [["fa", "فارسی"], ["en", "English"], ["ar", "العربية"]];
  const current = choices.find(([code]) => code === locale) || choices[0];
  return `<details class="language-switcher"><summary aria-label="${safeText(locale === "en" ? "Language" : locale === "ar" ? "اللغة" : "زبان سایت")}"><span>${current[0].toUpperCase()}</span><span aria-hidden="true">⌄</span></summary><div class="language-switcher__options">${choices.map(([code, label]) => `<a href="${safeText(languageHref(code))}" lang="${code}" hreflang="${code}"${locale === code ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</div></details>`;
}

function header(path) {
  const attractionsLabel = locale === "fa" ? "دیدنی‌های نزدیک" : locale === "ar" ? "معالم قريبة" : "Nearby attractions";
  const homeNavigation = [
    ["/", locale === "fa" ? "صفحه اصلی" : locale === "ar" ? "الرئيسية" : "Home"],
    ["/rooms", locale === "fa" ? "اقامت" : locale === "ar" ? "الإقامة" : "Stay"],
    ["/attractions", attractionsLabel],
    ["/policies", ui.policies],
    ["/gallery", ui.gallery], ["/facilities", ui.facilities], ["/about", ui.aboutDamoon], ["/contact", ui.contact],
  ];
  const navItems = normalizePath(window.location.pathname) === "/" ? homeNavigation : site.nav;
  const nav = navItems.map(([href, label]) => {
    const active = href === path || (href === "/rooms" && path.startsWith("/rooms/")) || (href === "/attractions" && path.startsWith("/attractions/"));
    return `<a class="site-nav__link${active ? " is-active" : ""}" href="${routeHref(href)}"${active ? ' aria-current="page"' : ""}>${safeText(label)}</a>`;
  }).join("");
  const brandLabel = locale === "fa" ? `${site.name}، صفحهٔ اصلی` : `${site.name}, home`;
  const paletteNames = ui.paletteNames || faUI.paletteNames;
  return `<a class="skip-link" href="#main">${safeText(ui.skipToMain)}</a>
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="${routeHref("/")}" aria-label="${safeText(brandLabel)}">
          <span class="brand__mark" aria-hidden="true">${locale === "fa" ? "د" : "D"}</span><span class="brand__text"><strong>${safeText(site.name)}</strong><small>${locale === "fa" ? "هتل و اقامت" : locale === "ar" ? "فندق وإقامة" : "Hotel and accommodation"} · ${safeText(site.city)}</small></span>
        </a>
        <nav class="site-nav" aria-label="${safeText(ui.mainMenu)}">${nav}</nav>
        <div class="site-header__actions">
          ${languageSwitcher(path)}
          <div class="theme-controls" id="theme-controls" role="group" aria-label="${safeText(ui.appearanceSettings)}">
            <div class="palette-switcher" role="group" aria-label="${safeText(ui.choosePalette)}">
              ${palettes.map(p => `<button class="palette-choice" type="button" data-palette="${p.id}" aria-label="${safeText(`${ui.colorPalette}: ${paletteNames[p.id] || p.label}`)}" aria-pressed="false"><span></span></button>`).join("")}
            </div>
            <button class="theme-toggle" type="button" data-theme-toggle aria-label="${safeText(ui.switchToDark)}" aria-pressed="false"><span aria-hidden="true">◐</span></button>
          </div>
          ${link("/contact", ui.contactHotel, "button button--small button--outline")}
          <button class="menu-toggle" type="button" aria-label="${safeText(ui.openMenu)}" aria-expanded="false" aria-controls="mobile-menu" data-menu-toggle><span></span><span></span></button>
        </div>
      </div>
      <nav id="mobile-menu" class="mobile-menu" aria-label="${safeText(ui.mobileMenu)}" hidden>${nav}${link("/contact", ui.contactHotel, "mobile-menu__cta")}</nav>
    </header>`;
}

function footer() {
  const attractionsLabel = locale === "fa" ? "دیدنی‌های نزدیک" : locale === "ar" ? "معالم قريبة" : "Nearby attractions";
  const footerLinks = [["/rooms", ui.rooms], ["/attractions", attractionsLabel], ["/facilities", ui.facilities], ["/gallery", ui.gallery], ["/about", ui.aboutDamoon], ["/contact", ui.contact], ["/policies", ui.policies], ["/virtual-tour", ui.virtualTour]];
  const alwaysOpen = locale === "fa" ? "هماهنگی با پذیرش" : locale === "ar" ? "التنسيق مع الاستقبال" : "Coordinate with reception";
  return `<footer class="site-footer"><div class="site-footer__main"><div class="site-footer__brand"><span class="brand__mark" aria-hidden="true">${locale === "fa" ? "د" : "D"}</span><div><strong>${safeText(site.name)}</strong><p>${safeText(site.city)}</p></div></div><p class="site-footer__note">${safeText(site.address)} · ${alwaysOpen}</p><nav class="footer-links" aria-label="${safeText(ui.footerLinks)}">${footerLinks.map(([href, label]) => link(href, label)).join("")}</nav></div><div class="site-footer__bottom"><span>© ${new Date().getFullYear()} ${safeText(site.name)}</span><a href="tel:${site.phone}">${safeText(ui.reception)}: <bdi>${safeText(site.phoneDisplay)}</bdi></a></div></footer>`;
}

function breadcrumb(path, title) {
  if (path === "/") return "";
  return `<nav class="breadcrumb" aria-label="${safeText(ui.breadcrumb)}"><a href="${routeHref("/")}">${safeText(ui.rooms === "Rooms" ? "Home" : locale === "ar" ? "الرئيسية" : locale === "en" ? "Home" : "خانه")}</a><span aria-hidden="true">/</span><span aria-current="page">${safeText(title)}</span></nav>`;
}

function hero(page, path) {
  const isHome = path === "/";
  const src = isHome ? "/damoon-front/assets/hero-reference-v2.png" : page.image || (path.startsWith("/rooms/") ? "/damoon-front/assets/room-concept-1.webp" : "/damoon-front/assets/gallery-concept-1.webp");
  const note = page.imageNote || (path === "/" ? site.imageNote : ui.imageNotActual);
  const visual = isHome
    ? `<picture><source type="image/webp" srcset="/damoon-front/assets/hero-reference-v2-640.webp 640w, /damoon-front/assets/hero-reference-v2-1280.webp 1280w, /damoon-front/assets/hero-reference-v2-1920.webp 1920w" sizes="(max-width: 760px) 100vw, (max-width: 1400px) 64vw, 896px"><img src="${safeText(src)}" width="2243" height="701" alt="${safeText(note)}" fetchpriority="high" decoding="async"></picture>`
    : `<img src="${safeText(src)}" alt="${safeText(note)}" fetchpriority="high" decoding="async">`;
  const actions = (page.actions || []).map(([href, label], index) => link(href, label, `button ${index ? "button--outline" : "button--primary"}`)).join("");
  const homeEyebrow = locale === "fa" ? "اقامتی آرام<br class=\"home-eyebrow-break\">در قلب شهرکرد" : safeText(ui.homeEyebrow);
  const homeSubtitle = safeText(ui.homeSubtitle);
  const homeLead = safeText(ui.homeLead);
  return `<section class="page-hero${isHome ? " page-hero--home" : ""}" aria-labelledby="page-title">
    <div class="page-hero__copy">${breadcrumb(path, page.title)}<p class="eyebrow">${isHome ? homeEyebrow : safeText(site.eyebrow)}</p>${page.badge ? `<p class="status-badge">${safeText(page.badge)}</p>` : ""}<h1 id="page-title">${safeText(isHome ? site.name : page.intro || page.title)}</h1>${isHome ? `<p class="home-subtitle">${homeSubtitle}</p>` : ""}<p class="page-hero__lead">${isHome ? homeLead : safeText(page.text || "")}</p><div class="page-hero__actions">${isHome ? link("/rooms", locale === "fa" ? "برنامه‌ریزی اقامت" : locale === "ar" ? "خطط لإقامتك" : "Plan your stay", "button button--primary") : actions || link("/contact", ui.coordinateWithHotel, "button button--primary")}</div></div>
    <figure class="page-hero__visual">${visual}<figcaption>${safeText(note)}</figcaption></figure>
  </section>`;
}

function cards(sections = []) {
  if (!sections.length) return "";
  return `<section class="content-section" aria-label="${safeText(ui.additionalInformation)}"><div class="section-heading"><p class="eyebrow">${safeText(ui.generalHotel)}</p><h2>${safeText(ui.detailsMore)}</h2></div><div class="info-grid">${sections.map((item) => `<article class="info-card">${item.image ? `<a class="info-card__image" href="${routeHref(item.link || "/gallery")}" aria-label="${safeText(item.heading)}"><img src="${safeText(item.image)}" alt="${safeText(item.note || ui.imageNotActual)}" loading="lazy"><span class="image-caption">${safeText(item.note || ui.imageNotActual)}</span></a>` : ""}<div class="info-card__body">${item.badge ? `<span class="status-badge">${safeText(item.badge)}</span>` : ""}<h3>${safeText(item.heading)}</h3><p>${safeText(item.text)}</p>${item.link ? link(item.link, item.label || ui.additionalInformation, "text-link") : ""}</div></article>`).join("")}</div></section>`;
}

function homeContent() {
  const roomTiles = accommodationCategories.map(({ slug }) => roomForLocale(slug, locale));
  const slides = gallery.slice(0, 4);
  return `<section class="home-intro" aria-label="${safeText(ui.homeIntro)}"><div class="home-intro__copy"><p class="eyebrow">${safeText(locale === "fa" ? "درباره هتل دامون" : ui.aboutMore)}</p><h2 id="home-intro-title">${safeText(locale === "fa" ? "جایی متعادل برای سفر و آرامش" : ui.calmStay)}</h2><p>${safeText(ui.homeIntro)}</p><a class="text-link" href="${routeHref("/about")}">${safeText(ui.aboutMore)} ←</a><a class="text-link" href="${routeHref("/virtual-tour")}#tour-lobby">${safeText(DAMOON_VTOUR_COPY[locale]?.lobbyLink || DAMOON_VTOUR_COPY.en.lobbyLink)} ↗</a></div><div class="home-lobby" aria-label="${safeText(ui.gallery)}"><img data-home-slide src="/damoon-front/assets/lobby-concept.webp" alt="${safeText(ui.imageNotActual)}" loading="lazy"><button type="button" data-home-prev aria-label="${safeText(ui.previousImage)}">‹</button><button type="button" data-home-next aria-label="${safeText(ui.nextImage)}">›</button><div class="home-lobby__dots">${slides.map((_, i) => `<button type="button" data-home-dot="${i}" aria-label="${safeText(ui.gallery)} ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("")}</div></div><div class="home-side"><div class="home-room-list"><h2>${safeText(locale === "fa" ? "اتاق‌ها و سوئیت‌ها" : ui.rooms)}</h2><div class="home-room-list__grid">${roomTiles.map((room, index) => `<a href="${routeHref(`/rooms/${room.slug}`)}" data-room-sprite="${index}"><img src="${room.image}" alt="${safeText(ui.imageNotActual)}" loading="lazy"><strong>${safeText(room.title)}<small>${safeText(ui.viewSpaces)}</small></strong></a>`).join("")}</div></div><div class="home-gallery-list"><h2>${safeText(locale === "fa" ? "تصاویر هتل" : ui.gallery)}</h2><div>${slides.map((image, i) => `<a href="${routeHref("/gallery")}" data-gallery-sprite="${i}"><img src="${safeText(image.src)}" alt="${safeText(image.alt)}" loading="lazy"></a>`).join("")}</div></div></div></section>
    <div class="home-features"><span><svg viewBox="0 0 32 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 38C11 30 2 20 2 14a14 14 0 1 1 28 0c0 6-9 16-14 24Z"/><circle cx="16" cy="14" r="5"/></svg><strong>${safeText(ui.guestComfort)}</strong><small>${safeText(site.city)}</small></span><span><svg viewBox="0 0 40 36" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 29h34M6 25a14 14 0 0 1 28 0H6Zm14-17V4m-5 0h10M2 33h36"/></svg><strong>${safeText(ui.unitCount)}</strong></span><span><svg viewBox="0 0 32 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 38V2h22v36M1 38h30M12 38V28h8v10M10 8h3m6 0h3M10 14h3m6 0h3M10 20h3m6 0h3"/></svg><strong>${safeText(ui.checkInLabel)} · 14:00</strong><small>${safeText(ui.checkOutLabel)} · 12:00</small></span></div>`;
}

function galleryGrid() {
  return `<section class="content-section"><div class="section-heading"><p class="eyebrow">${safeText(ui.referenceImages)}</p><h2>${safeText(ui.conceptGallery)}</h2><p>${safeText(locale === "fa" ? "این تصاویر برای نمایش ترکیب‌بندی هستند؛ هیچ‌کدام عکس واقعی هتل دامون نیستند." : locale === "ar" ? "هذه التصاميم لتوضيح التكوين؛ ولا تمثل صوراً حقيقية لفندق دامون." : "These images illustrate layout and are not actual photographs of Damoon Hotel.")}</p><a class="text-link" href="${routeHref("/virtual-tour")}">${safeText(ui.virtualTour)} ↗</a></div><div class="gallery-grid">${gallery.map((image, index) => `<button class="gallery-tile" type="button" data-gallery-index="${index}" aria-label="${safeText(`${ui.zoomConceptImage} ${index + 1}`)}"><img src="${safeText(image.src)}" alt="${safeText(image.alt)}" loading="lazy"><span>${safeText(ui.conceptImage)}</span></button>`).join("")}</div></section>`;
}

function virtualTourPage(page, path) {
  const selection = roomForLocale(new URLSearchParams(window.location.search).get("room"), locale);
  const contact = selection ? `/contact?room=${encodeURIComponent(selection.slug)}` : "/contact";
  const back = selection
    ? [`/rooms/${selection.slug}`, `${locale === "fa" ? "بازگشت به" : locale === "ar" ? "العودة إلى" : "Back to"} ${selection.title}`]
    : page.actions[0];
  return `${hero({ ...page, actions: [[contact, ui.contactHotel], back] }, path)}${virtualTourSection()}`;
}

function virtualTourSection() {
  const tours = publishedDamoonTours();
  const copy = DAMOON_VTOUR_COPY[locale] || DAMOON_VTOUR_COPY.en;
  if (tours.length) return `<section class="content-section vtour-gallery" data-vtour-gallery><div class="section-heading"><p class="eyebrow">${safeText(ui.virtualTour)}</p><h2>${safeText(copy.galleryTitle)}</h2><p>${safeText(copy.galleryIntro)}</p></div><div class="vtour-gallery__cards">${tours.map((tour) => {
    const title = tour.title?.[locale] || tour.title?.en || tour.id;
    const description = tour.description?.[locale] || tour.description?.en || "";
    const directUrl = allowedVirtualTourUrl(tour.url);
    const roomLink = tour.roomSlugs.includes("vip-suite") ? `<a class="vtour-card__room" href="${safeText(routeHref("/rooms/vip-suite"))}">${safeText(copy.roomLink)} ↗</a>` : "";
    return `<article class="vtour-card" id="tour-${safeText(tour.id)}"><span class="vtour-card__mark" aria-hidden="true">360°</span><div class="vtour-card__body"><h3>${safeText(title)}</h3><p>${safeText(description)}</p><div class="vtour-card__actions"><button type="button" class="button button--primary" data-vtour-open="${safeText(tour.id)}">${safeText(copy.openEmbed)}</button><a class="vtour-card__direct" href="${safeText(directUrl)}" target="_blank" rel="noopener noreferrer">${safeText(copy.openDirect)}</a>${roomLink}</div></div></article>`;
  }).join("")}</div><section class="vtour-active" data-vtour-active hidden aria-labelledby="vtour-active-title"><div class="vtour-active__heading"><div><p class="eyebrow">${safeText(ui.virtualTour)}</p><h3 id="vtour-active-title" tabindex="-1" data-vtour-active-title></h3></div><button type="button" class="button button--outline" data-vtour-close>${safeText(copy.close)}</button></div><div data-vtour-active-player></div></section></section>`;
  return `<section class="content-section"><div class="section-heading"><p class="eyebrow">${safeText(ui.virtualTour)}</p><h2>${safeText(ui.virtualTour)}</h2></div><p>${safeText(locale === "fa" ? "نمایش آنلاین تور مجازی در حال آماده‌سازی است. برای هماهنگی با پذیرش تماس بگیرید." : locale === "ar" ? "عرض الجولة الافتراضية قيد الإعداد." : "Online virtual tour display is being prepared.")}</p></section>`;
}

function wireVtourViewer(viewer, copy) {
  if (!viewer || viewer.dataset.vtourWired === "true") return;
  const iframe = viewer.querySelector("iframe");
  const status = viewer.querySelector("[data-vtour-status]");
  if (!iframe || !status) return;
  viewer.dataset.vtourWired = "true";
  let settled = false;
  const timer = window.setTimeout(() => { if (!settled) status.textContent = copy.slow; }, 12000);
  iframe.addEventListener("load", () => { settled = true; window.clearTimeout(timer); status.textContent = copy.loaded; }, { once: true });
  iframe.addEventListener("error", () => { settled = true; window.clearTimeout(timer); status.textContent = copy.failed; }, { once: true });
  viewer.querySelector("[data-vtour-fullscreen]")?.addEventListener("click", async () => {
    try {
      if (typeof iframe.requestFullscreen !== "function") throw new Error("Fullscreen unavailable");
      await iframe.requestFullscreen();
    } catch {
      status.textContent = copy.fullscreenFailed;
    }
  });
}

function wireVtourGallery() {
  const galleryRoot = root.querySelector("[data-vtour-gallery]");
  if (!galleryRoot || galleryRoot.dataset.vtourWired === "true") return;
  const copy = DAMOON_VTOUR_COPY[locale] || DAMOON_VTOUR_COPY.en;
  const tours = publishedDamoonTours();
  const active = galleryRoot.querySelector("[data-vtour-active]");
  const activeTitle = galleryRoot.querySelector("[data-vtour-active-title]");
  const player = galleryRoot.querySelector("[data-vtour-active-player]");
  if (!active || !activeTitle || !player) return;
  galleryRoot.dataset.vtourWired = "true";
  const openTour = (id) => {
    const tour = tours.find((item) => item.id === id);
    const url = allowedVirtualTourUrl(tour?.url);
    if (!tour || !url) return;
    player.replaceChildren();
    const title = tour.title?.[locale] || tour.title?.en || tour.id;
    activeTitle.textContent = title;
    active.hidden = false;
    player.innerHTML = tourViewerMarkup(tour, title, undefined, locale);
    const viewer = player.querySelector(".vtour-viewer");
    wireVtourViewer(viewer, copy);
    active.scrollIntoView({ behavior: "smooth", block: "start" });
    activeTitle.focus({ preventScroll: true });
  };
  galleryRoot.querySelectorAll("[data-vtour-open]").forEach((button) => button.addEventListener("click", () => openTour(button.dataset.vtourOpen)));
  galleryRoot.querySelector("[data-vtour-close]")?.addEventListener("click", () => {
    player.replaceChildren();
    active.hidden = true;
  });
  if (window.location.hash === "#tour-lobby") openTour("lobby");
}
function render() {
  locale = localeForPath(window.location.pathname);
  if (!translations[locale] && locale !== "fa") locale = "fa";
  site = siteForLocale(locale);
  gallery = galleryForLocale(locale);
  ui = translations[locale]?.ui || faUI;
  const path = normalizePath(window.location.pathname);
  const reservationStart = path === "/hotel-reservations/start";
  const page = pageForPath(path, locale) || (reservationStart ? { path, title: locale === "fa" ? "درخواست هماهنگی اقامت" : locale === "ar" ? "طلب تنسيق الإقامة" : "Request stay coordination", text: locale === "fa" ? "تاریخ و ترکیب مهمانان را برای ارسال درخواست هماهنگی به پذیرش انتخاب کنید؛ این مسیر موجودی یا قیمت را بررسی و رزرو یا پرداخت انجام نمی‌دهد." : locale === "ar" ? "اختر التواريخ والضيوف لإرسال طلب تنسيق إلى الاستقبال؛ لا يتحقق هذا المسار من التوفر أو الأسعار ولا ينشئ حجزاً أو دفعة." : "Choose dates and guests to send a coordination request to reception. This route does not check availability, confirm a rate, hold a room, or take payment." } : null);
  document.documentElement.lang = locale;
  document.documentElement.dir = translations[locale]?.direction || "rtl";
  const noScript = document.querySelector("noscript");
  if (noScript) noScript.textContent = ui.noscript || faUI.noscript;
  document.title = page ? `${page.title} | ${site.name}` : `${ui.pageNotFound} | ${site.name}`;
  let description = document.querySelector('meta[name="description"]');
  if (!description) { description = document.createElement("meta"); description.name = "description"; document.head.append(description); }
  description.content = page?.text || ui.pageNotFoundText;
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.append(robots); }
  robots.content = "noindex, nofollow";
  const isAccommodation = path === '/rooms' || path.startsWith('/rooms/');
  let body;
  if (!page) body = `<section class="not-found"><p class="eyebrow">404</p><h1>${safeText(ui.pageNotFound)}</h1><p>${safeText(ui.pageNotFoundText)}</p>${link("/", ui.backHome, "button button--primary")}</section>`;
  else if (isAccommodation) body = renderAccommodation({ path, page, locale, site, routeHref, stayHref, escapeHtml: safeText });
  else if (reservationStart) body = `${hero(page, path)}<section class="content-section"><div class="section-heading"><p class="eyebrow">${safeText(page.title)}</p><h2>${safeText(page.title)}</h2><p>${safeText(page.text)}</p></div><div data-booking-slot></div></section>`;
  else if (path === '/') body = `<div class="home-top">${hero(page, path)}<div data-booking-slot></div></div>${homeContent()}`;
  else if (path === "/attractions") body = renderDamoonAttractionsPage(locale);
  else if (path.startsWith("/attractions/")) body = renderDamoonAttractionDetailPage(locale, path.slice("/attractions/".length));
  else if (path === "/virtual-tour") body = virtualTourPage(page, path); else body = renderHospitality({ path, page, locale, site, routeHref, escapeHtml: safeText }) || `${hero(page, path)}${cards(page.sections)}`;
  root.innerHTML = `${header(page?.path || path)}<main id="main" class="site-main${path === "/" ? " home-main" : ""}">${body}</main>${footer()}<div id="gallery-dialog-root"></div>`;
  if (path === "/rooms" || path.startsWith("/rooms/")) void refreshPublishedAccommodationCatalog(locale);
  const gallerySlot = root.querySelector('[data-hospitality-gallery-slot]');
  if (gallerySlot) gallerySlot.innerHTML = galleryGrid();
  wireInteractions();
}

async function refreshPublishedAccommodationCatalog(activeLocale) {
  try {
    const response = await fetch(`/api/hotel/v1/website/properties/damoon?locale=${encodeURIComponent(activeLocale)}`, {
      method: "GET", credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" },
    });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload?.mode !== "PUBLISHED" || payload.locale !== activeLocale || payload.propertySlug !== "damoon" || !payload.content?.accommodationCatalog) return;
    const accommodationPage = document.querySelector(".accommodation-listing, .accommodation-detail");
    if (accommodationPage && locale === activeLocale) applyPublishedAccommodationCatalog(accommodationPage, payload.content.accommodationCatalog, activeLocale);
  } catch {
    // Keep the bundled, owner-approved baseline visible when CMS reads are unavailable.
  }
}

function wireInteractions() {
  wireAccommodation(root);
  root.querySelectorAll(".vtour-viewer").forEach((viewer) => wireVtourViewer(viewer, DAMOON_VTOUR_COPY[locale] || DAMOON_VTOUR_COPY.en));
  wireVtourGallery();
  if (root.querySelector("[data-da-filter]")) mountDamoonAttractionsPage(root);
  const stayLinks = [...root.querySelectorAll('a[href]')].filter(a => a.origin === window.location.origin && !a.closest('.language-switcher') && !a.getAttribute('href').startsWith('#'));
  const syncStayLinks = () => {
    stayLinks.forEach(a => {
      if (!a.dataset.stayPath) a.dataset.stayPath = normalizePath(a.pathname) + a.search + a.hash;
      a.href = stayHref(a.dataset.stayPath);
    });
    root.querySelectorAll('.language-switcher a[hreflang]').forEach(a => { a.href = languageHref(a.hreflang); });
  };
  document.addEventListener('damoon:stay-change', syncStayLinks);
  syncStayLinks();
  const languageControl = document.querySelector('.language-switcher');
  document.addEventListener('click', (event) => {
    if (languageControl?.open && !languageControl.contains(event.target)) languageControl.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && languageControl?.open) {
      languageControl.open = false;
      languageControl.querySelector('summary')?.focus();
    }
  });
  setTheme(readTheme());
  let paletteStorage;
  try { paletteStorage = window.localStorage; } catch { /* Private browsing can disable persistence. */ }
  applyPalette(readPalette(paletteStorage), document, paletteStorage);
  document.querySelectorAll("button[data-palette]").forEach(button => button.addEventListener("click", () => applyPalette(button.dataset.palette, document, paletteStorage)));
  const bookingSlot = document.querySelector("[data-booking-slot]");
  const reservationEntry = window.location.pathname.replace(/\/+$/, "").endsWith("/hotel-reservations/start");
  if (bookingSlot) mountBooking(bookingSlot, { routeHref, locale, coordinationOnly: false, requestOnly: !reservationEntry, reservationEntry, demoMode: new URLSearchParams(window.location.search).get("mode") === "DEMO_BOOKING" });
  const homeSlides = gallery.slice(1, 5);
  const homeImage = document.querySelector("[data-home-slide]");
  if (homeImage && homeSlides.length) {
    let slide = 0;
    const showSlide = () => {
      const item = homeSlides[slide];
      document.querySelector(".home-lobby")?.classList.toggle("is-live", slide !== 0);
      homeImage.src = item.src;
      homeImage.alt = item.alt;
      document.querySelectorAll("[data-home-dot]").forEach((dot, index) => dot.toggleAttribute("aria-current", index === slide));
    };
    document.querySelector("[data-home-prev]")?.addEventListener("click", () => { slide = (slide - 1 + homeSlides.length) % homeSlides.length; showSlide(); });
    document.querySelector("[data-home-next]")?.addEventListener("click", () => { slide = (slide + 1) % homeSlides.length; showSlide(); });
    document.querySelectorAll("[data-home-dot]").forEach(dot => dot.addEventListener("click", () => { slide = Number(dot.dataset.homeDot); showSlide(); }));
  }
  if (normalizePath(window.location.pathname) === "/contact" && !root.querySelector(".hospitality-contact-details")) {
    const contact = document.createElement("section");
    contact.className = "contact-actions content-section";
    contact.innerHTML = `<h2>${safeText(`${ui.reception} ${site.name}`)}</h2><p>${safeText(site.address)}</p><div class="page-hero__actions"><a class="button button--primary" href="tel:${site.phone}">${safeText(ui.callReception)} <bdi>${safeText(site.phoneDisplay)}</bdi></a><a class="button button--outline" href="${hotelMapUrl()}" target="_blank" rel="noopener noreferrer">${safeText(locale === "fa" ? "نمایش موقعیت تقریبی" : locale === "ar" ? "عرض الموقع التقريبي" : "View approximate location")}</a></div>${renderDamoonMap({ kind: "hotel", locale })}`;
    document.querySelector("main").append(contact);
  }
  mountDamoonMaps(root);
  if (normalizePath(window.location.pathname) === '/contact') {
    const contactNotice = document.createElement('p');
    contactNotice.className = 'hospitality-note';
    contactNotice.dataset.contactApproval = 'pending';
    contactNotice.textContent = locale === 'fa'
      ? 'شماره و نشانی از منابع عمومی گردآوری شده‌اند و تأیید نهایی مدیریت هتل در انتظار است. هنگام تماس، صحت مقصد را بررسی کنید.'
      : locale === 'ar'
        ? 'جُمعت بيانات الهاتف والعنوان من مصادر عامة، ولا يزال تأكيد إدارة الفندق قيد الانتظار. تحقّق من الجهة عند الاتصال.'
        : 'The phone and address come from public sources and await hotel management confirmation. Verify the destination when calling.';
    root.querySelector('.hospitality-contact-details')?.append(contactNotice);
    const { range, guests, children, childAges } = readStaySelection();
    const selectedRoom = roomForLocale(new URLSearchParams(location.search).get('room'), locale);
    if (selectedRoom || validateStayRange(range, todayLocalISO()) === 'OK') {
      const summary = document.createElement('section');
      summary.className = 'hospitality-stay-context';
      const heading = locale === 'fa' ? 'برنامهٔ اقامت شما' : locale === 'ar' ? 'خطة إقامتك' : 'Your stay plans';
      const hint = locale === 'fa' ? 'این اطلاعات را هنگام تماس با پذیرش مطرح کنید؛ انتخاب شما رزرو قطعی نیست.' : locale === 'ar' ? 'اذكر هذه التفاصيل عند الاتصال بالاستقبال؛ اختيارك ليس حجزاً مؤكداً.' : 'Share these details when calling reception; this selection is not a confirmed reservation.';
      const dates = validateStayRange(range, todayLocalISO()) === 'OK' ? `${jalaliAccessibleDay(range.checkIn, locale)} — ${jalaliAccessibleDay(range.checkOut, locale)}` : '';
      const number = (value) => new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
      const adultCount = locale === 'fa' ? `${number(guests)} بزرگسال` : locale === 'ar' ? `${number(guests)} ${guests === 1 ? 'بالغ' : 'بالغين'}` : `${number(guests)} ${guests === 1 ? 'adult' : 'adults'}`;
      const childCount = children > 0 ? locale === 'fa' ? `${number(children)} کودک` : locale === 'ar' ? `${number(children)} ${children === 1 ? 'طفل' : 'أطفال'}` : `${number(children)} ${children === 1 ? 'child' : 'children'}` : '';
      const parsedAges = parseChildAges(childAges, children);
      const ageLabel = locale === 'fa' ? 'سن کودکان' : locale === 'ar' ? 'أعمار الأطفال' : 'Child ages';
      const unknownAge = locale === 'fa' ? 'نامشخص' : locale === 'ar' ? 'غير محدد' : 'not specified';
      const ageValues = parsedAges.ok ? parsedAges.ages.map(number) : Array.from({ length: children }, (_, index) => {
        const age = parseChildAges([childAges?.[index]], 1);
        return age.ok ? number(age.ages[0]) : unknownAge;
      });
      const ages = children > 0 ? ` · ${ageLabel}: ${ageValues.join(', ')}` : '';
      const party = `${adultCount}${childCount ? ` · ${childCount}${ages}` : ''}`;
      const staySummary = [selectedRoom?.title, dates, party, hint].filter(Boolean).join("\n");
      const copyLabel = locale === 'fa' ? 'کپی خلاصهٔ اقامت' : locale === 'ar' ? 'نسخ ملخص الإقامة' : 'Copy stay summary';
      const copiedMessage = locale === 'fa' ? 'خلاصهٔ اقامت کپی شد.' : locale === 'ar' ? 'تم نسخ ملخص الإقامة.' : 'Stay summary copied.';
      const copyFailedMessage = locale === 'fa' ? 'کپی خودکار انجام نشد. متن را انتخاب و دستی کپی کنید.' : locale === 'ar' ? 'تعذر النسخ تلقائياً. حدّد النص وانسخه يدوياً.' : 'Automatic copying failed. Select and copy the text manually.';
      const manualLabel = locale === 'fa' ? 'خلاصهٔ اقامت برای کپی دستی' : locale === 'ar' ? 'ملخص الإقامة للنسخ اليدوي' : 'Stay summary for manual copying';
      summary.innerHTML = `<h2>${safeText(heading)}</h2>${selectedRoom ? `<p>${safeText(selectedRoom.title)}</p>` : ''}<p>${safeText(dates)} · ${safeText(party)}</p><p>${safeText(hint)}</p><button type="button" class="button button--outline" data-copy-stay>${safeText(copyLabel)}</button><p role="status" aria-live="polite" data-copy-status></p><label data-copy-manual-label hidden>${safeText(manualLabel)}<textarea readonly data-copy-manual></textarea></label>`;
      const copyButton = summary.querySelector('[data-copy-stay]');
      const copyStatus = summary.querySelector('[data-copy-status]');
      const manualLabelElement = summary.querySelector('[data-copy-manual-label]');
      const manualText = summary.querySelector('[data-copy-manual]');
      copyButton.addEventListener('click', async () => {
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
          await navigator.clipboard.writeText(staySummary);
          manualLabelElement.hidden = true;
          copyStatus.textContent = copiedMessage;
        } catch {
          manualText.value = staySummary;
          manualLabelElement.hidden = false;
          copyStatus.textContent = copyFailedMessage;
          manualText.focus();
          manualText.select();
        }
      });
      const edit = document.createElement('a');
      edit.className = 'hospitality-text-link';
      edit.href = stayHref(selectedRoom ? `/rooms/${selectedRoom.slug}` : '/rooms');
      edit.textContent = locale === 'fa' ? 'ویرایش برنامهٔ اقامت' : locale === 'ar' ? 'تعديل خطة الإقامة' : 'Edit stay plans';
      summary.append(edit);
      root.querySelector('.hospitality-contact-details')?.after(summary);

      if (validateStayRange(range, todayLocalISO()) === 'OK' && parsedAges.ok) {
        const labels = locale === 'fa'
          ? {title:'درخواست اقامت', name:'نام و نام خانوادگی', phone:'شماره تماس', send:'ارسال درخواست', note:'این درخواست رزرو قطعی نیست و قیمت و موجودی هنوز تأیید نشده است.', reference:'کد پیگیری', fail:'ارسال ناموفق بود. بعداً دوباره تلاش کنید.', track:'پیگیری درخواست', check:'بررسی وضعیت'}
          : locale === 'ar'
            ? {title:'طلب إقامة', name:'الاسم الكامل', phone:'رقم الهاتف', send:'إرسال الطلب', note:'هذا الطلب ليس حجزاً مؤكداً ولم يتم تأكيد السعر أو التوفر.', reference:'رمز المتابعة', fail:'تعذر إرسال الطلب. حاول لاحقاً.', track:'متابعة الطلب', check:'التحقق من الحالة'}
            : {title:'Request accommodation', name:'Full name', phone:'Phone number', send:'Send request', note:'This is not a confirmed booking; price and availability have not been confirmed.', reference:'Tracking reference', fail:'The request could not be submitted. Please try again.', track:'Track a request', check:'Check status'};
        const panel = document.createElement('section');
        panel.className = 'hospitality-stay-context';
        panel.innerHTML = `<h2>${safeText(labels.title)}</h2><p>${safeText(labels.note)}</p><form data-coordination-request><label>${safeText(labels.name)} <input name="fullName" required minlength="2" maxlength="120" autocomplete="name"></label><label>${safeText(labels.phone)} <input name="phone" type="tel" required minlength="8" maxlength="24" autocomplete="tel"></label><button type="submit">${safeText(labels.send)}</button></form><p role="status" aria-live="polite" data-request-result></p><form data-coordination-track><label>${safeText(labels.track)} <input name="reference" required minlength="40" autocomplete="off"></label><button type="submit">${safeText(labels.check)}</button></form><p role="status" aria-live="polite" data-track-result></p>`;
        summary.after(panel);
        let attempt;
        panel.querySelector('[data-coordination-request]').addEventListener('submit', async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const button = form.querySelector('button');
          const output = panel.querySelector('[data-request-result]');
          const preferredCategory = ['vip-suite', 'standard-room', 'studio-suite'].includes(selectedRoom?.slug) ? selectedRoom.slug : undefined;
          const payload = { kind: 'coordination', property: 'damoon-hotel', checkIn: range.checkIn, checkOut: range.checkOut, occupancy: { adults: guests, children, childAges: parsedAges.ages }, contact: { fullName: form.elements.fullName.value.trim(), phone: form.elements.phone.value.trim() }, ...(preferredCategory ? { preferredCategory } : {}) };
          const fingerprint = JSON.stringify(payload);
          try {
            if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, key: createIdempotencyKey() };
            button.disabled = true;
            const response = await fetch('/api/hotel/v1/requests', { method: 'POST', headers: { 'content-type': 'application/json', 'Idempotency-Key': attempt.key }, body: fingerprint });
            const result = await response.json();
            if (!response.ok || typeof result.reference !== 'string') throw new Error('request failed');
            output.textContent = `${labels.reference}: ${result.reference}`;
            panel.querySelector('[data-coordination-track] input').value = result.reference;
          } catch { output.textContent = labels.fail; } finally { button.disabled = false; }
        });
        panel.querySelector('[data-coordination-track]').addEventListener('submit', async (event) => {
          event.preventDefault();
          const output = panel.querySelector('[data-track-result]');
          try {
            const response = await fetch('/api/hotel/v1/requests/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reference: event.currentTarget.elements.reference.value.trim() }) });
            const result = await response.json();
            if (!response.ok || !['RECEIVED', 'IN_REVIEW', 'DECLINED', 'CLOSED'].includes(result.status)) throw new Error('tracking failed');
            const statuses = locale === 'fa' ? { RECEIVED: 'دریافت‌شده', IN_REVIEW: 'در حال بررسی', DECLINED: 'پذیرفته نشد', CLOSED: 'بسته‌شده' } : locale === 'ar' ? { RECEIVED: 'تم الاستلام', IN_REVIEW: 'قيد المراجعة', DECLINED: 'مرفوض', CLOSED: 'مغلق' } : { RECEIVED: 'Received', IN_REVIEW: 'Under review', DECLINED: 'Declined', CLOSED: 'Closed' };
            output.textContent = statuses[result.status];
          } catch { output.textContent = labels.fail; }
        });
      }

      // The inventory-free coordination form is already available on this page.
      // Keep Damoon guests out of the retired, disabled tenant guest portal.
    }
  }
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  const menuButton = document.querySelector("[data-menu-toggle]");
  const mobileMenu = document.querySelector("#mobile-menu");
  const closeMenu = () => { if (!menuButton || !mobileMenu) return; menuButton.setAttribute("aria-expanded", "false"); menuButton.setAttribute("aria-label", ui.openMenu); mobileMenu.hidden = true; };
  menuButton?.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? ui.closeMenu : ui.openMenu);
    mobileMenu.hidden = !open;
    if (open) mobileMenu.querySelector("a")?.focus();
  });
  mobileMenu?.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") { closeMenu(); menuButton.focus(); } });
  document.querySelectorAll("[data-gallery-index]").forEach((button) => button.addEventListener("click", () => openGallery(Number(button.dataset.galleryIndex))));
}

function openGallery(startIndex) {
  let index = ((startIndex % gallery.length) + gallery.length) % gallery.length;
  const dialogRoot = document.querySelector("#gallery-dialog-root");
  const opener = document.activeElement;
  const draw = () => {
    const item = gallery[index];
    dialogRoot.innerHTML = `<div class="gallery-dialog-backdrop" data-dialog-backdrop><section class="gallery-dialog" role="dialog" aria-modal="true" aria-label="${safeText(ui.conceptImage)}" tabindex="-1"><button class="gallery-dialog__close" type="button" data-dialog-close aria-label="${safeText(ui.closeImageViewer)}">×</button><button class="gallery-dialog__prev" type="button" data-dialog-prev aria-label="${safeText(ui.previousImage)}">‹</button><figure><img src="${safeText(item.src)}" alt="${safeText(item.alt)}"><figcaption>${safeText(item.alt)} · ${safeText(ui.conceptImage)}</figcaption></figure><button class="gallery-dialog__next" type="button" data-dialog-next aria-label="${safeText(ui.nextImage)}">›</button><p class="gallery-dialog__count">${safeText(ui.imageCount.replace("{current}", String(index + 1)).replace("{total}", String(gallery.length)))}</p></section></div>`;
    const dialog = dialogRoot.querySelector("[role=dialog]");
    dialog.querySelector("[data-dialog-close]").addEventListener("click", close);
    dialog.querySelector("[data-dialog-next]").addEventListener("click", () => { index = (index + 1) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); });
    dialog.querySelector("[data-dialog-prev]").addEventListener("click", () => { index = (index - 1 + gallery.length) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); });
    dialogRoot.querySelector("[data-dialog-backdrop]").addEventListener("click", (event) => { if (event.target === event.currentTarget) close(); });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "ArrowRight") { index = (index - 1 + gallery.length) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); }
      if (event.key === "ArrowLeft") { index = (index + 1) % gallery.length; draw(); dialogRoot.querySelector("[data-dialog-close]").focus(); }
      if (event.key === "Tab") {
        const focusable = [...dialog.querySelectorAll("button")];
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    });
    dialog.querySelector("[data-dialog-close]").focus();
  };
  const close = () => { dialogRoot.innerHTML = ""; opener?.focus?.(); };
  draw();
}

render();
