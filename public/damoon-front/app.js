import { galleryForLocale, localeForPath, normalizePath, pageForPath, siteForLocale } from "./content.js";
import translations from "./translations.js";
import { palettes, readPalette, applyPalette } from "./themes.js";
import { mountBooking } from "./booking.js";

const root = document.querySelector("#app");
if (!root) throw new Error("Damoon app mount #app was not found");

const safeText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let locale = "fa";
let site;
let gallery;
let ui;
const faUI = {
  skipToMain: "رفتن به محتوای اصلی", mainMenu: "منوی اصلی", mobileMenu: "منوی موبایل", appearanceSettings: "تنظیم ظاهر سایت", choosePalette: "انتخاب رنگ‌بندی", contactHotel: "تماس با هتل", openMenu: "بازکردن منو", closeMenu: "بستن منو", footerLinks: "پیوندهای پایانی", breadcrumb: "مسیر صفحه", detailsMore: "جزئیات بیشتر", generalHotel: "هتل دامون", additionalInformation: "اطلاعات بیشتر", coordinateWithHotel: "هماهنگی با هتل", pageNotFound: "این صفحه پیدا نشد", pageNotFoundText: "ممکن است نشانی صفحه تغییر کرده باشد.", backHome: "بازگشت به خانه", reception: "پذیرش", callReception: "تماس با پذیرش", directions: "مسیریابی روی نقشه", checkIn: "ورود", checkOut: "خروج", guests: "مهمانان", room: "اتاق", rooms: "اتاق‌ها", restaurant: "رستوران", cafe: "کافی‌شاپ", facilities: "امکانات", gallery: "گالری", aboutDamoon: "دربارهٔ دامون", contact: "تماس", policies: "قوانین و حریم خصوصی", virtualTour: "تور مجازی", conceptImage: "تصویر مفهومی", conceptGallery: "گالری مفهومی", referenceImages: "تصاویر مرجع", zoomConceptImage: "بزرگ‌نمایی تصویر مفهومی", closeImageViewer: "بستن نمایش تصویر", previousImage: "تصویر قبلی", nextImage: "تصویر بعدی", imageNotActual: "تصویر مفهومی؛ عکس واقعی هتل نیست.", imageCount: "{current} از {total}", colorPalette: "رنگ‌بندی", switchToDark: "رفتن به تم تیره", switchToLight: "رفتن به تم روشن", footerReception: "پذیرش", noscript: "برای نمایش این نسخهٔ در حال تکمیل، جاوااسکریپت مرورگر را فعال کنید.", homeSubtitle: "اقامت و مهمان‌نوازی در شهرکرد", homeLead: "برای اقامت و دورهمی خود، فضاهای هتل را ببینید و برای هماهنگی با ما در تماس باشید.", homeShortcuts: "دسترسی سریع", roomSpaces: "فضاهای اقامت", restaurantShort: "برای وعده‌های دل‌پذیر", tourShort: "گشت‌وگذار در فضاها", calmStay: "برای اقامتی آرام و لحظه‌هایی خوش", homeIntro: "هتل دامون در شهرکرد میزبان برنامه‌های اقامت و دورهمی شماست. فضاهای هتل را ببینید و برای هماهنگی، با ما در تماس باشید.", aboutMore: "بیشتر دربارهٔ هتل", accommodationSpaces: "فضاهای اقامت", aPlaceToRest: "جایی برای آسودن", browseRooms: "گروه‌های اقامتی هتل دامون را ببینید و برای انتخاب متناسب با برنامه‌تان هماهنگ کنید.", conceptCaption: "تصویر مفهومی", viewSpaces: "مشاهدهٔ فضاها", forYourStay: "برای اقامت شما", hotelSpaces: "فضاهای هتل", planYourStay: "برای برنامه‌ریزی اقامت", contactCoordination: "برای هماهنگی با هتل در تماس باشید", homeEyebrow: "اقامتی آرام در شهرکرد", notFound: "این صفحه پیدا نشد", notFoundText: "ممکن است نشانی صفحه تغییر کرده باشد.", paletteNames: { hermes: "کرم و نارنجی", forest: "سبز روشن و طبیعی", wood: "قهوه‌ای چوبی" },
};

function prefixFor(localeCode = locale) {
  if (localeCode !== "fa") return `/${localeCode}`;
  return /^\/fa(?:\/|$)/.test(window.location.pathname) ? "/fa" : "";
}
const routeHref = (href) => `${prefixFor()}${href === "/" ? "/" : href}`;
const link = (href, label, className = "") => `<a class="${className}" href="${routeHref(href)}">${safeText(label)}</a>`;
function languageHref(code) {
  const path = normalizePath(window.location.pathname);
  const prefix = code === "fa" ? "" : `/${code}`;
  const url = `${prefix}${path === "/" ? "/" : path}${window.location.search}${window.location.hash}`;
  return url || "/";
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
    button.innerHTML = theme === "dark" ? "<span aria-hidden=\"true\">☼</span>" : "<span aria-hidden=\"true\">◐</span>";
  }
}

function languageSwitcher(path) {
  const choices = [["fa", "فارسی"], ["en", "English"], ["ar", "العربية"]];
  return `<nav class="language-switcher" aria-label="${safeText(locale === "en" ? "Language" : locale === "ar" ? "اللغة" : "زبان سایت")}">${choices.map(([code, label]) => `<a href="${safeText(languageHref(code))}" lang="${code}" hreflang="${code}"${locale === code ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>`;
}

function header(path) {
  const nav = site.nav.map(([href, label]) => {
    const active = href === path || (href === "/rooms" && path.startsWith("/rooms/"));
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
  const footerLinks = [["/rooms", ui.rooms], ["/restaurant", ui.restaurant], ["/cafe", ui.cafe], ["/facilities", ui.facilities], ["/gallery", ui.gallery], ["/about", ui.aboutDamoon], ["/contact", ui.contact], ["/policies", ui.policies], ["/virtual-tour", ui.virtualTour]];
  const alwaysOpen = locale === "fa" ? "پذیرش شبانه‌روزی" : locale === "ar" ? "الاستقبال على مدار الساعة" : "24-hour reception";
  return `<footer class="site-footer"><div class="site-footer__main"><div class="site-footer__brand"><span class="brand__mark" aria-hidden="true">${locale === "fa" ? "د" : "D"}</span><div><strong>${safeText(site.name)}</strong><p>${safeText(site.city)}</p></div></div><p class="site-footer__note">${safeText(site.address)} · ${alwaysOpen}</p><nav class="footer-links" aria-label="${safeText(ui.footerLinks)}">${footerLinks.map(([href, label]) => link(href, label)).join("")}</nav></div><div class="site-footer__bottom"><span>© ${new Date().getFullYear()} ${safeText(site.name)}</span><a href="tel:${site.phone}">${safeText(ui.reception)}: <bdi>${safeText(site.phoneDisplay)}</bdi></a></div></footer>`;
}

function breadcrumb(path, title) {
  if (path === "/") return "";
  return `<nav class="breadcrumb" aria-label="${safeText(ui.breadcrumb)}"><a href="${routeHref("/")}">${safeText(ui.rooms === "Rooms" ? "Home" : locale === "ar" ? "الرئيسية" : locale === "en" ? "Home" : "خانه")}</a><span aria-hidden="true">/</span><span aria-current="page">${safeText(title)}</span></nav>`;
}

function hero(page, path) {
  const src = page.image || (path.startsWith("/rooms/") ? "/damoon-front/assets/room-concept-1.webp" : "/damoon-front/assets/gallery-concept-1.webp");
  const note = page.imageNote || (path === "/" ? site.imageNote : ui.imageNotActual);
  const isHome = path === "/";
  const actions = (page.actions || []).map(([href, label], index) => link(href, label, `button ${index ? "button--outline" : "button--primary"}`)).join("");
  return `<section class="page-hero${isHome ? " page-hero--home" : ""}" aria-labelledby="page-title">
    <div class="page-hero__copy">${breadcrumb(path, page.title)}<p class="eyebrow">${safeText(isHome ? ui.homeEyebrow : site.eyebrow)}</p>${page.badge ? `<p class="status-badge">${safeText(page.badge)}</p>` : ""}<h1 id="page-title">${safeText(isHome ? site.name : page.intro || page.title)}</h1>${isHome ? `<p class="home-subtitle">${safeText(ui.homeSubtitle)}</p>` : ""}<p class="page-hero__lead">${safeText(isHome ? ui.homeLead : page.text || "")}</p><div class="page-hero__actions">${actions || link("/contact", ui.coordinateWithHotel, "button button--primary")}</div></div>
    <figure class="page-hero__visual"><img src="${safeText(src)}" alt="${safeText(note)}" fetchpriority="high"><figcaption>${safeText(note)}</figcaption></figure>
  </section>`;
}

function cards(sections = []) {
  if (!sections.length) return "";
  return `<section class="content-section" aria-label="${safeText(ui.additionalInformation)}"><div class="section-heading"><p class="eyebrow">${safeText(ui.generalHotel)}</p><h2>${safeText(ui.detailsMore)}</h2></div><div class="info-grid">${sections.map((item) => `<article class="info-card">${item.image ? `<a class="info-card__image" href="${routeHref(item.link || "/gallery")}" aria-label="${safeText(item.heading)}"><img src="${safeText(item.image)}" alt="${safeText(item.note || ui.imageNotActual)}" loading="lazy"><span class="image-caption">${safeText(item.note || ui.imageNotActual)}</span></a>` : ""}<div class="info-card__body">${item.badge ? `<span class="status-badge">${safeText(item.badge)}</span>` : ""}<h3>${safeText(item.heading)}</h3><p>${safeText(item.text)}</p>${item.link ? link(item.link, item.label || ui.additionalInformation, "text-link") : ""}</div></article>`).join("")}</div></section>`;
}

function homeContent() {
  const shortcuts = [["/rooms", ui.rooms, ui.roomSpaces], ["/restaurant", ui.restaurant, ui.restaurantShort], ["/virtual-tour", ui.virtualTour, ui.tourShort]];
  const roomTiles = [
    { title: locale === "fa" ? "اقامت یک‌نفره" : locale === "ar" ? "إقامة لضيف واحد" : "Stay for one guest", image: "/damoon-front/assets/room-concept-1.webp", href: "/rooms/single" },
    { title: locale === "fa" ? "اقامت دونفره" : locale === "ar" ? "إقامة لضيفين" : "Stay for two guests", image: "/damoon-front/assets/room-concept-2.webp", href: "/rooms/double" },
    { title: locale === "fa" ? "سوئیت‌های اقامتی" : locale === "ar" ? "أجنحة الإقامة" : "Accommodation suites", image: "/damoon-front/assets/room-concept-3.webp", href: "/rooms" },
  ];
  const services = [[ui.rooms, "/rooms", "/damoon-front/assets/room-concept-1.webp"], [ui.restaurant, "/restaurant", "/damoon-front/assets/gallery-concept-2.webp"], [ui.cafe, "/cafe", "/damoon-front/assets/gallery-concept-3.webp"], [ui.virtualTour, "/virtual-tour", "/damoon-front/assets/lobby-concept.webp"]];
  return `<nav class="home-shortcuts" aria-label="${safeText(ui.homeShortcuts)}">${shortcuts.map(([href, title, note]) => `<a class="home-shortcut" href="${routeHref(href)}"><span><small>${safeText(note)}</small><strong>${safeText(title)}</strong></span><span class="home-shortcut__arrow" aria-hidden="true">←</span></a>`).join("")}</nav>
    <section class="home-intro" aria-labelledby="home-intro-title"><figure class="home-intro__visual"><img src="/damoon-front/assets/lobby-concept.webp" alt="${safeText(ui.imageNotActual)}" loading="lazy"><figcaption>${safeText(ui.imageNotActual)}</figcaption></figure><div class="home-intro__copy"><p class="eyebrow">${safeText(site.name)} · ${safeText(site.city)}</p><h2 id="home-intro-title">${safeText(ui.calmStay)}</h2><p>${safeText(ui.homeIntro)}</p><a class="text-link" href="${routeHref("/about")}">${safeText(ui.aboutMore)}</a></div></section>
    <section class="home-rooms" aria-labelledby="home-rooms-title"><div class="section-heading"><p class="eyebrow">${safeText(ui.accommodationSpaces)}</p><h2 id="home-rooms-title">${safeText(ui.aPlaceToRest)}</h2><p>${safeText(ui.browseRooms)}</p></div><div class="home-room-grid">${roomTiles.map((room) => `<a class="home-room-tile" href="${routeHref(room.href)}"><img src="${room.image}" alt="${safeText(ui.imageNotActual)}" loading="lazy"><span class="home-room-tile__caption">${safeText(ui.conceptCaption)}</span><strong>${safeText(room.title)}</strong><span class="home-room-tile__link">${safeText(ui.viewSpaces)} ←</span></a>`).join("")}</div></section>
    <section class="home-services" aria-labelledby="home-services-title"><div class="section-heading"><p class="eyebrow">${safeText(ui.forYourStay)}</p><h2 id="home-services-title">${safeText(ui.hotelSpaces)}</h2></div><div class="home-service-grid">${services.map(([title, href, image]) => `<a class="home-service" href="${routeHref(href)}"><img src="${image}" alt="" loading="lazy"><span>${safeText(title)}</span><span class="home-service__arrow" aria-hidden="true">←</span></a>`).join("")}</div></section>
    <section class="contact-strip"><div><p class="eyebrow">${safeText(ui.planYourStay)}</p><h2>${safeText(ui.contactCoordination)}</h2></div>${link("/contact", ui.contactHotel, "button button--primary")}</section>`;
}

function galleryGrid() {
  return `<section class="content-section"><div class="section-heading"><p class="eyebrow">${safeText(ui.referenceImages)}</p><h2>${safeText(ui.conceptGallery)}</h2><p>${safeText(locale === "fa" ? "این تصاویر برای نمایش ترکیب‌بندی هستند؛ هیچ‌کدام عکس واقعی هتل دامون نیستند." : locale === "ar" ? "هذه التصاميم لتوضيح التكوين؛ ولا تمثل صوراً حقيقية لفندق دامون." : "These images illustrate layout and are not actual photographs of Damoon Hotel.")}</p></div><div class="gallery-grid">${gallery.map((image, index) => `<button class="gallery-tile" type="button" data-gallery-index="${index}" aria-label="${safeText(`${ui.zoomConceptImage} ${index + 1}`)}"><img src="${safeText(image.src)}" alt="${safeText(image.alt)}" loading="lazy"><span>${safeText(ui.conceptImage)}</span></button>`).join("")}</div></section>`;
}

function render() {
  locale = localeForPath(window.location.pathname);
  if (!translations[locale] && locale !== "fa") locale = "fa";
  site = siteForLocale(locale);
  gallery = galleryForLocale(locale);
  ui = translations[locale]?.ui || faUI;
  const path = normalizePath(window.location.pathname);
  const page = pageForPath(path, locale);
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
  const hasBookingSlot = path === "/" || path === "/rooms" || path.startsWith("/rooms/");
  root.innerHTML = `${header(page?.path || path)}<main id="main" class="site-main">${page ? `${hero(page, path)}${hasBookingSlot ? '<div data-booking-slot></div>' : ""}${path === "/" ? homeContent() : path === "/gallery" ? galleryGrid() : cards(page.sections)}` : `<section class="not-found"><p class="eyebrow">404</p><h1>${safeText(ui.pageNotFound)}</h1><p>${safeText(ui.pageNotFoundText)}</p>${link("/", ui.backHome, "button button--primary")}</section>`}</main>${footer()}<div id="gallery-dialog-root"></div>`;
  wireInteractions();
}

function wireInteractions() {
  setTheme(readTheme());
  let paletteStorage;
  try { paletteStorage = window.localStorage; } catch { /* Private browsing can disable persistence. */ }
  applyPalette(readPalette(paletteStorage), document, paletteStorage);
  document.querySelectorAll("button[data-palette]").forEach(button => button.addEventListener("click", () => applyPalette(button.dataset.palette, document, paletteStorage)));
  const bookingSlot = document.querySelector("[data-booking-slot]");
  if (bookingSlot) mountBooking(bookingSlot, { routeHref, locale });
  if (normalizePath(window.location.pathname) === "/contact") {
    const contact = document.createElement("section");
    contact.className = "contact-actions content-section";
    contact.innerHTML = `<h2>${safeText(`${ui.reception} ${site.name}`)}</h2><p>${safeText(site.address)}</p><div class="page-hero__actions"><a class="button button--primary" href="tel:${site.phone}">${safeText(ui.callReception)} <bdi>${safeText(site.phoneDisplay)}</bdi></a><a class="button button--outline" href="${safeText(site.mapUrl)}" target="_blank" rel="noopener noreferrer">${safeText(ui.directions)}</a></div>`;
    document.querySelector("main").append(contact);
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
